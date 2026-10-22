import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { QueryFailedError, Repository } from 'typeorm';
import { DashboardExchangeTokenEntity } from '../database/entities/dashboard-exchange-token.entity';
import { generateDashboardAccessCode, hashDashboardAccessCode } from './dashboard-access-code';

type TokenKind = 'access' | 'refresh';

/** Retries when a fresh sign-in code collides with an old one (unique `code_hash`). */
const ISSUE_EXCHANGE_ATTEMPTS = 3;

export interface DashboardExchangeCredentials {
  /** One-time token for the `/api/access` link. */
  token: string;
  /** Sign-in code typed in the installed app; consumed together with the link. */
  code: string;
}

interface DashboardTokenPayload {
  expiresAt: number;
  kind: TokenKind;
  userId: number | string;
}

@Injectable()
export class ReportsTokenService {
  constructor(
    private readonly config: ConfigService,
    @InjectRepository(DashboardExchangeTokenEntity)
    private readonly exchangeTokens: Repository<DashboardExchangeTokenEntity>,
  ) {}

  public issueAccessToken(userId: number | string): { token: string; expiresAt: string } {
    return this.issue(userId, 'access', 24 * 60 * 60 * 1000);
  }

  public issueRefreshToken(userId: number | string): { token: string; expiresAt: string } {
    return this.issue(userId, 'refresh', 7 * 24 * 60 * 60 * 1000);
  }

  public async issueExchangeToken(userId: number | string): Promise<DashboardExchangeCredentials> {
    for (let attempt = 1; ; attempt += 1) {
      const token = randomBytes(32).toString('base64url');
      const code = generateDashboardAccessCode();
      try {
        await this.exchangeTokens.save(
          this.exchangeTokens.create({
            userId: userId.toString(),
            tokenHash: this.hashExchangeToken(token),
            codeHash: hashDashboardAccessCode(code),
            expiresAt: new Date(Date.now() + 20 * 60 * 1000),
          }),
        );
        return { token, code };
      } catch (error) {
        if (!(error instanceof QueryFailedError) || attempt >= ISSUE_EXCHANGE_ATTEMPTS) throw error;
      }
    }
  }

  public async consumeExchangeToken(token: string): Promise<string | number> {
    if (!token) throw new UnauthorizedException();
    return this.consumeExchange('token_hash', this.hashExchangeToken(token));
  }

  /** Same one-time rules as the link: using either the code or the link spends both. */
  public async consumeExchangeCode(code: string): Promise<string | number> {
    const codeHash = hashDashboardAccessCode(code);
    if (!codeHash) throw new UnauthorizedException();
    return this.consumeExchange('code_hash', codeHash);
  }

  private async consumeExchange(
    column: 'token_hash' | 'code_hash',
    hash: string,
  ): Promise<string | number> {
    const now = new Date();
    const result = await this.exchangeTokens
      .createQueryBuilder()
      .update(DashboardExchangeTokenEntity)
      .set({ consumedAt: now })
      .where(`${column} = :hash`, { hash })
      .andWhere('consumed_at IS NULL')
      .andWhere('expires_at > :now', { now })
      .execute();
    if (result.affected !== 1) throw new UnauthorizedException();
    const record = await this.exchangeTokens.findOneBy(
      column === 'token_hash' ? { tokenHash: hash } : { codeHash: hash },
    );
    if (!record || !record.userId) throw new UnauthorizedException();
    return Number.isSafeInteger(Number(record.userId)) ? Number(record.userId) : record.userId;
  }

  public verifyAccessToken(token: string): string | number {
    return this.verify(token, 'access');
  }

  public verifyRefreshToken(token: string): string | number {
    return this.verify(token, 'refresh');
  }

  private issue(
    userId: number | string,
    kind: TokenKind,
    ttlMs: number,
  ): { token: string; expiresAt: string } {
    const payload: DashboardTokenPayload = { userId, kind, expiresAt: Date.now() + ttlMs };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = this.sign(encodedPayload, kind);
    return {
      token: `${encodedPayload}.${signature}`,
      expiresAt: new Date(payload.expiresAt).toISOString(),
    };
  }

  private verify(token: string, expectedKind: TokenKind): string | number {
    const [encodedPayload, signature] = token.split('.');
    if (
      !encodedPayload ||
      !signature ||
      !this.isSignatureValid(encodedPayload, signature, expectedKind)
    ) {
      throw new UnauthorizedException();
    }
    try {
      const payload = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString('utf8'),
      ) as DashboardTokenPayload;
      if (
        payload.kind !== expectedKind ||
        (!Number.isSafeInteger(Number(payload.userId)) && !String(payload.userId).trim()) ||
        payload.expiresAt <= Date.now()
      )
        throw new UnauthorizedException();
      return Number.isSafeInteger(Number(payload.userId))
        ? Number(payload.userId)
        : String(payload.userId);
    } catch {
      throw new UnauthorizedException();
    }
  }

  private isSignatureValid(payload: string, signature: string, kind: TokenKind): boolean {
    const expected = this.sign(payload, kind);
    return (
      signature.length === expected.length &&
      timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    );
  }

  private sign(payload: string, kind: TokenKind): string {
    const secretKey =
      kind === 'access'
        ? 'reports.dashboardAccessTokenSecret'
        : 'reports.dashboardRefreshTokenSecret';
    const secret = this.config.get<string>(secretKey);
    if (!secret) throw new UnauthorizedException('Dashboard token secret is not configured.');
    return createHmac('sha256', secret).update(payload).digest('base64url');
  }

  private hashExchangeToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
