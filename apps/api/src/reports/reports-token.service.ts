import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { Repository } from 'typeorm';
import { DashboardExchangeTokenEntity } from '../database/entities/dashboard-exchange-token.entity';

type TokenKind = 'access' | 'refresh';

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

  public async issueExchangeToken(userId: number | string): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.exchangeTokens.save(
      this.exchangeTokens.create({
        userId: userId.toString(),
        tokenHash: this.hashExchangeToken(token),
        expiresAt: new Date(Date.now() + 20 * 60 * 1000),
      }),
    );
    return token;
  }

  public async consumeExchangeToken(token: string): Promise<string | number> {
    if (!token) throw new UnauthorizedException();
    const now = new Date();
    const result = await this.exchangeTokens
      .createQueryBuilder()
      .update(DashboardExchangeTokenEntity)
      .set({ consumedAt: now })
      .where('token_hash = :tokenHash', { tokenHash: this.hashExchangeToken(token) })
      .andWhere('consumed_at IS NULL')
      .andWhere('expires_at > :now', { now })
      .execute();
    if (result.affected !== 1) throw new UnauthorizedException();
    const record = await this.exchangeTokens.findOneBy({
      tokenHash: this.hashExchangeToken(token),
    });
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
