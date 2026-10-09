import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { google } from 'googleapis';
import { OAuth2Client, Credentials } from 'google-auth-library';
import { API_ROUTES } from '@zalobot/contracts';
import { UserTokenEntity } from '../database/entities/user-token.entity';
import { TokenEncryptionService } from './token-encryption.service';

export const GOOGLE_SCOPES = [
  // 1. Thông tin cơ bản người dùng (User Profile & Email)
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',

  // 2. Google Calendar (Toàn quyền quản lý lịch trình & sự kiện)
  'https://www.googleapis.com/auth/calendar',

  // 3. Google Tasks (quản lý To-Do list & công việc)
  'https://www.googleapis.com/auth/tasks',
];

@Injectable()
export class GoogleAuthService implements OnModuleInit {
  private readonly logger = new Logger(GoogleAuthService.name);
  private userClients: Map<string, OAuth2Client> = new Map();

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(UserTokenEntity)
    private readonly tokenRepo: Repository<UserTokenEntity>,
    private readonly encryption: TokenEncryptionService,
  ) {}

  public async onModuleInit(): Promise<void> {
    await this.preloadTokensFromDatabase();
  }

  private async preloadTokensFromDatabase(): Promise<void> {
    try {
      const allTokens = await this.tokenRepo.find();
      for (const t of allTokens) {
        if (t.accessToken || t.refreshToken) {
          const accessToken = this.encryption.decrypt(t.accessToken);
          const refreshToken = this.encryption.decrypt(t.refreshToken);
          if (!t.accessToken?.startsWith('enc:v1:') || !t.refreshToken?.startsWith('enc:v1:')) {
            t.accessToken = this.encryption.encrypt(accessToken);
            t.refreshToken = this.encryption.encrypt(refreshToken);
            await this.tokenRepo.save(t);
          }
          const client = this.createOAuth2Instance();
          if (client) {
            client.setCredentials({
              access_token: accessToken,
              refresh_token: refreshToken,
              scope: t.scope,
              token_type: t.tokenType,
              expiry_date: t.expiryDate ? Number(t.expiryDate) : undefined,
            });
            const numUserId = Number(t.userId);
            client.on('tokens', (refreshed: Credentials) => {
              void this.saveTokensForUser(numUserId, refreshed);
            });
            this.userClients.set(t.userId, client);
          }
        }
      }
      this.logger.log(`Preloaded ${allTokens.length} user Google OAuth token(s) from PostgreSQL.`);
    } catch (err) {
      const error = err as Error;
      this.logger.warn(`Could not preload tokens from database: ${error.message}`);
    }
  }

  public getClientKeys(): { clientId: string; clientSecret: string; redirectUri: string } | null {
    const appUrl = this.configService.getOrThrow<string>('appUrl');
    const defaultRedirectUri = `${appUrl.replace(/\/+$/, '')}${API_ROUTES.googleAuthCallback}`;

    return {
      clientId: this.configService.getOrThrow<string>('google.clientId'),
      clientSecret: this.configService.getOrThrow<string>('google.clientSecret'),
      redirectUri: defaultRedirectUri,
    };
  }

  public createOAuth2Instance(): OAuth2Client | null {
    const keys = this.getClientKeys();
    if (!keys) return null;
    return new google.auth.OAuth2(keys.clientId, keys.clientSecret, keys.redirectUri);
  }

  public getOAuth2Client(userId?: string | number): OAuth2Client | null {
    // If no userId passed, resolve to Admin's userId
    let targetUserId = userId !== undefined ? String(userId) : undefined;
    if (!targetUserId) {
      targetUserId = this.configService.get<string>('zalo.adminId');
    }

    if (!targetUserId) {
      const allowedIds = this.configService.get<string[]>('zalo.allowedUserIds');
      if (allowedIds && allowedIds.length > 0) targetUserId = allowedIds[0];
    }

    if (!targetUserId) return null;

    const strId = targetUserId.toString();
    return this.userClients.get(strId) || null;
  }

  public isAuthorized(userId?: string | number): boolean {
    const client = this.getOAuth2Client(userId);
    if (!client) return false;
    const creds = client.credentials;
    return !!(creds && (creds.access_token || creds.refresh_token));
  }

  public generateAuthUrl(userId: string | number): string {
    const client = this.createOAuth2Instance();
    if (!client) {
      throw new Error(
        'Google OAuth credentials chưa được cấu hình. Vui lòng thiết lập GOOGLE_CLIENT_ID và GOOGLE_CLIENT_SECRET.',
      );
    }

    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: GOOGLE_SCOPES,
      state: userId.toString(),
    });
  }

  public async exchangeCodeForTokens(userId: string | number, code: string): Promise<boolean> {
    const client = this.createOAuth2Instance();
    if (!client) {
      throw new Error(
        'Google OAuth credentials chưa được cấu hình. Vui lòng thiết lập GOOGLE_CLIENT_ID và GOOGLE_CLIENT_SECRET.',
      );
    }

    try {
      const { tokens } = await client.getToken(code.trim());
      await this.saveTokensForUser(userId, tokens);
      return true;
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Failed to exchange code for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  public async saveTokensForUser(userId: string | number, tokens: Credentials): Promise<void> {
    const strId = userId.toString();

    try {
      // 1. Save to PostgreSQL
      let dbToken = await this.tokenRepo.findOne({ where: { userId: strId } });
      if (!dbToken) {
        dbToken = this.tokenRepo.create({
          userId: strId,
          accessToken: this.encryption.encrypt(tokens.access_token || undefined),
          refreshToken: this.encryption.encrypt(tokens.refresh_token || undefined),
          scope: tokens.scope || undefined,
          tokenType: tokens.token_type || undefined,
          expiryDate: tokens.expiry_date || undefined,
        });
      } else {
        if (tokens.access_token) dbToken.accessToken = this.encryption.encrypt(tokens.access_token);
        if (tokens.refresh_token)
          dbToken.refreshToken = this.encryption.encrypt(tokens.refresh_token);
        if (tokens.scope) dbToken.scope = tokens.scope;
        if (tokens.token_type) dbToken.tokenType = tokens.token_type;
        if (tokens.expiry_date) dbToken.expiryDate = tokens.expiry_date;
      }
      await this.tokenRepo.save(dbToken);

      // 2. Update client in memory
      let client = this.userClients.get(strId);
      if (!client) {
        const newClient = this.createOAuth2Instance();
        if (newClient) {
          newClient.on('tokens', (refreshed: Credentials) => {
            void this.saveTokensForUser(userId, refreshed);
          });
          this.userClients.set(strId, newClient);
          client = newClient;
        }
      }
      if (client) {
        client.setCredentials({
          access_token: this.encryption.decrypt(dbToken.accessToken),
          refresh_token: this.encryption.decrypt(dbToken.refreshToken),
          scope: dbToken.scope,
          token_type: dbToken.tokenType,
          expiry_date: dbToken.expiryDate ? Number(dbToken.expiryDate) : undefined,
        });
      }
      this.logger.log(`Saved OAuth tokens for user ${userId} to PostgreSQL.`);
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Failed to save tokens for user ${userId}: ${error.message}`);
    }
  }

  public async revokeUserTokens(userId: number | string): Promise<void> {
    const strId = userId.toString();
    try {
      await this.tokenRepo.delete({ userId: strId });
      this.userClients.delete(strId);
      this.logger.log(
        `Revoked and deleted Google OAuth tokens for user ${userId} from PostgreSQL.`,
      );
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Failed to delete tokens for user ${userId}: ${error.message}`);
    }
  }
}
