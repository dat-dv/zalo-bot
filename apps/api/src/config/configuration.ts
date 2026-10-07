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
    secretToken?: string;
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
  llm: {
    provider: string;
    gemini: {
      apiKey: string;
      model: string;
    };
    openai: {
      apiKey: string;
      model: string;
      baseUrl: string;
    };
    qwen: {
      baseUrl: string;
      model: string;
      apiKey?: string;
    };
  };
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
      secretToken: readOptionalEnv('ZALO_WEBHOOK_SECRET_TOKEN'),
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
    llm: {
      provider: readEnv('LLM_PROVIDER', 'gemini'),
      gemini: {
        apiKey: readEnv('GEMINI_API_KEY'),
        model: readEnv('GEMINI_MODEL', 'gemini-2.5-flash'),
      },
      openai: {
        apiKey: readOptionalEnv('OPENAI_API_KEY') || '',
        model: readEnv('OPENAI_MODEL', 'gpt-4o-mini'),
        baseUrl: readEnv('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
      },
      qwen: {
        baseUrl: readEnv('QWEN_BASE_URL', readEnv('OLLAMA_BASE_URL', 'http://localhost:11434')),
        model: readEnv('QWEN_MODEL', readEnv('OLLAMA_MODEL', 'qwen2.5:14b')),
        apiKey: readOptionalEnv('QWEN_API_KEY') || readOptionalEnv('OLLAMA_API_KEY') || '',
      },
    },
  };
};
