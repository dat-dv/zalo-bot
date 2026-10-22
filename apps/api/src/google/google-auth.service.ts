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

  // Việc cần làm chỉ lưu trong zalobot nên không xin quyền Google Tasks.

  // 3. Google Drive (quản lý và lưu trữ file/thư mục bill, ảnh, video do app tạo)
  'https://www.googleapis.com/auth/drive.file',

  // 4. Google Photos (tạo album và upload ảnh/video)
  'https://www.googleapis.com/auth/photoslibrary.appendonly',
];

@Injectable()
export class GoogleAuthService implements OnModuleInit {
  private readonly logger = new Logger(GoogleAuthService.name);
  private userClients: Map<string, OAuth2Client> = new Map();
  /** Owner of the shared Google account: pinned by `user_tokens.is_shared`, set only by a login. */
  private sharedUserId?: string;
  /** Keyed by client: a login builds a new client, so a new Google account never reuses an email. */
  private readonly accountEmails = new WeakMap<OAuth2Client, string>();

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
            client.on('tokens', (refreshed: Credentials) => {
              void this.saveTokensForUser(t.userId, refreshed);
            });
            this.userClients.set(t.userId, client);
            // Only the token marked `is_shared` is the storage account: after a sign-out there is
            // none, rather than silently another admin's Google account.
            if (t.isShared) {
              this.sharedUserId = t.userId;
            }
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

  public getSharedOAuth2Client(): OAuth2Client | null {
    if (!this.sharedUserId) return null;
    return this.userClients.get(this.sharedUserId) || null;
  }

  public getOAuth2Client(userId?: string | number): OAuth2Client | null {
    if (userId !== undefined) {
      const strId = String(userId);
      const specific = this.userClients.get(strId);
      if (specific) return specific;
    }
    return this.getSharedOAuth2Client();
  }

  public isAuthorized(userId?: string | number): boolean {
    const client = this.getOAuth2Client(userId);
    if (!client) return false;
    const creds = client.credentials;
    return !!(creds && (creds.access_token || creds.refresh_token));
  }

  public isSharedAuthorized(): boolean {
    const client = this.getSharedOAuth2Client();
    if (!client) return false;
    const creds = client.credentials;
    return !!(creds && (creds.access_token || creds.refresh_token));
  }

  public hasStorageScopes(userId?: string | number): boolean {
    const client = this.getOAuth2Client(userId);
    if (!client) return false;
    const scope = client.credentials?.scope || '';
    return scope.includes('drive') && scope.includes('photoslibrary');
  }

  public async getSharedAccountEmail(): Promise<string | null> {
    return this.getAccountEmail();
  }

  /** Email of the Google account behind `getOAuth2Client(userId)` (the shared one by default). */
  public async getAccountEmail(userId?: string | number): Promise<string | null> {
    const client = this.getOAuth2Client(userId);
    if (!client) return null;
    const cached = this.accountEmails.get(client);
    if (cached) return cached;
    try {
      const oauth2 = google.oauth2({ version: 'v2', auth: client });
      const res = await oauth2.userinfo.get();
      if (res.data?.email) {
        this.accountEmails.set(client, res.data.email);
        return res.data.email;
      }
    } catch (err) {
      this.logger.debug(`Could not retrieve Google account email: ${(err as Error).message}`);
    }
    return null;
  }

  public isAuthError(error: unknown): boolean {
    if (!error) return false;
    const err = error as {
      message?: string;
      status?: number;
      code?: number | string;
      response?: { status?: number; data?: { error?: string; error_description?: string } };
    };
    const status =
      err.response?.status || (typeof err.status === 'number' ? err.status : undefined);
    if (status === 401) return true;
    const msg = (err.message || '').toLowerCase();
    const respErr = String(err.response?.data?.error || '').toLowerCase();
    const respDesc = String(err.response?.data?.error_description || '').toLowerCase();
    return (
      msg.includes('invalid_grant') ||
      msg.includes('invalid_token') ||
      msg.includes('token has been expired or revoked') ||
      msg.includes('unauthorized') ||
      respErr.includes('invalid_grant') ||
      respErr.includes('invalid_client') ||
      respDesc.includes('token has been expired or revoked')
    );
  }

  public async handleAuthError(userId: string | number, error: unknown): Promise<boolean> {
    if (this.isAuthError(error)) {
      this.logger.warn(
        `Google OAuth token for user ${userId} is invalid or expired. Revoking stored tokens.`,
      );
      await this.revokeUserTokens(userId);
      return true;
    }
    return false;
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
      // Only an explicit login (re)chooses the shared account — never a token refresh.
      await this.saveTokensForUser(userId, tokens, { shared: true });
      return true;
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Failed to exchange code for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * `shared`: this login becomes the shared Google account (Drive/Photos storage). Token
   * refreshes omit it; before, every refresh re-pointed the shared account to whichever admin's
   * token refreshed last, so media flipped between Google accounts.
   */
  public async saveTokensForUser(
    userId: string | number,
    tokens: Credentials,
    options: { shared?: boolean } = {},
  ): Promise<void> {
    const strId = userId.toString();
    const shared = options.shared === true;

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
          isShared: shared,
        });
      } else {
        if (tokens.access_token) dbToken.accessToken = this.encryption.encrypt(tokens.access_token);
        if (tokens.refresh_token)
          dbToken.refreshToken = this.encryption.encrypt(tokens.refresh_token);
        if (tokens.scope) dbToken.scope = tokens.scope;
        if (tokens.token_type) dbToken.tokenType = tokens.token_type;
        if (tokens.expiry_date) dbToken.expiryDate = tokens.expiry_date;
        if (shared) dbToken.isShared = true;
      }
      await this.tokenRepo.save(dbToken);
      if (shared) await this.unmarkOtherSharedTokens(strId);

      // 2. Update client in memory. A login may switch Google account: a fresh client drops
      // everything cached for the previous account (email, Drive folder ids, Photos album ids).
      let client = shared ? undefined : this.userClients.get(strId);
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
      if (shared) {
        this.sharedUserId = strId;
      }
      this.logger.log(`Saved OAuth tokens for user ${userId} to PostgreSQL.`);
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Failed to save tokens for user ${userId}: ${error.message}`);
    }
  }

  private async unmarkOtherSharedTokens(sharedUserId: string): Promise<void> {
    await this.tokenRepo
      .createQueryBuilder()
      .update(UserTokenEntity)
      .set({ isShared: false })
      .where('"userId" <> :sharedUserId AND "is_shared" = true', { sharedUserId })
      .execute();
  }

  /**
   * Signs the shared storage account out: revokes the grant at Google (best effort, the local
   * sign-out still happens if Google is unreachable) and deletes its token. No other token takes
   * over; uploads stop until an admin signs in again.
   */
  public async disconnectSharedAccount(): Promise<void> {
    const sharedUserId = this.sharedUserId;
    if (!sharedUserId) return;
    const client = this.userClients.get(sharedUserId);
    if (client?.credentials?.access_token || client?.credentials?.refresh_token) {
      try {
        await client.revokeCredentials();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'unknown error';
        this.logger.warn(`Could not revoke the shared Google grant at Google: ${message}`);
      }
    }
    await this.revokeUserTokens(sharedUserId);
  }

  public async revokeUserTokens(userId: number | string): Promise<void> {
    const strId = userId.toString();
    try {
      await this.tokenRepo.delete({ userId: strId });
      this.userClients.delete(strId);
      if (this.sharedUserId === strId) {
        this.sharedUserId = undefined;
      }
      this.logger.log(
        `Revoked and deleted Google OAuth tokens for user ${userId} from PostgreSQL.`,
      );
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Failed to delete tokens for user ${userId}: ${error.message}`);
    }
  }
}
