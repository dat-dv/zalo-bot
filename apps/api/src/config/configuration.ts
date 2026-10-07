export interface AppConfig {
  port: number;
  appUrl: string;
  webOrigin: string;
  cors: { allowAll: boolean };
  database: {
    url: string;
    ssl: boolean;
    synchronize: boolean;
  };
  redis: {
    url?: string;
  };
  zalo: {
    botToken: string;
    webhookUrl: string;
    adminId?: string;
    allowedUserIds: string[];
  };
  gemini: {
    apiKey: string;
    model: string;
  };
  voice: {
    whisperUrl: string;
    timeoutMs: number;
    maxDurationSeconds: number;
    maxBytes: number;
  };
  receiptImage: {
    timeoutMs: number;
    maxBytes: number;
    langPath: string;
  };
  receiptStorage: {
    dir: string;
  };
  timezone: string;
  google: {
    clientId: string;
    clientSecret: string;
  };
  reports: {
    dashboardAccessTokenSecret: string;
    dashboardRefreshTokenSecret: string;
  };
  security: { encryptionKey: string };
}

function readEnv(name: string, fallback = ''): string {
  const value = process.env[name]
    ?.trim()
    .replace(/^['"]+|['"]+$/g, '')
    .trim();
  return value || fallback;
}

function readOptionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value
    ? value
        .trim()
        .replace(/^['"]+|['"]+$/g, '')
        .trim() || undefined
    : undefined;
}

function readBooleanEnv(name: string, fallback = false): boolean {
  const val = readEnv(name);
  return val ? val.toLowerCase() === 'true' : fallback;
}

function readNumberEnv(name: string, fallback = 0): number {
  const val = readEnv(name);
  return val ? Number(val) : fallback;
}

export default (): AppConfig => {
  const allowedUserIds = (readOptionalEnv('ZALO_ALLOWED_USER_IDS') ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  const adminId = readOptionalEnv('ZALO_ADMIN_ID');

  if (adminId && !allowedUserIds.includes(adminId)) {
    allowedUserIds.push(adminId);
  }

  const appUrl = readEnv('APP_URL').replace(/\/+$/, '');

  return {
    port: readNumberEnv('PORT', 3000),
    appUrl,
    webOrigin: readEnv('WEB_ORIGIN', appUrl).replace(/\/+$/, ''),
    cors: { allowAll: readBooleanEnv('CORS_ALLOW_ALL', true) },
    database: {
      url: readEnv('DATABASE_URL'),
      ssl: readOptionalEnv('DATABASE_SSL') === 'true',
      synchronize: readOptionalEnv('TYPEORM_SYNCHRONIZE') === 'true',
    },
    redis: { url: readOptionalEnv('REDIS_URL') },
    zalo: {
      botToken: readEnv('ZALO_BOT_TOKEN', readEnv('BOT_TOKEN')),
      webhookUrl: readEnv('ZALO_WEBHOOK_URL', readEnv('WEBHOOK_URL')),
      adminId,
      allowedUserIds,
    },
    gemini: {
      apiKey: readEnv('GEMINI_API_KEY'),
      model: readEnv('GEMINI_MODEL', 'gemini-2.5-flash'),
    },
    voice: {
      whisperUrl: readEnv('WHISPER_URL', 'http://127.0.0.1:8080'),
      timeoutMs: readNumberEnv('WHISPER_TIMEOUT_MS', 45000),
      maxDurationSeconds: readNumberEnv('VOICE_MAX_DURATION_SECONDS', 90),
      maxBytes: readNumberEnv('VOICE_MAX_BYTES', 8388608),
    },
    receiptImage: {
      timeoutMs: readNumberEnv('RECEIPT_IMAGE_TIMEOUT_MS', 45000),
      maxBytes: readNumberEnv('RECEIPT_IMAGE_MAX_BYTES', 10485760),
      langPath: readEnv('TESSERACT_LANG_PATH', './assets/tessdata'),
    },
    receiptStorage: {
      dir: readEnv('RECEIPT_STORAGE_DIR', './data/receipts'),
    },
    timezone: readEnv('DEFAULT_TIMEZONE', 'Asia/Ho_Chi_Minh'),
    google: {
      clientId: readEnv('GOOGLE_CLIENT_ID'),
      clientSecret: readEnv('GOOGLE_CLIENT_SECRET'),
    },
    reports: {
      dashboardAccessTokenSecret: readEnv('DASHBOARD_ACCESS_TOKEN_SECRET'),
      dashboardRefreshTokenSecret: readEnv('DASHBOARD_REFRESH_TOKEN_SECRET'),
    },
    security: { encryptionKey: readEnv('DATA_ENCRYPTION_KEY', '0'.repeat(64)) },
  };
};
