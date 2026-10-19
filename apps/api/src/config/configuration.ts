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
    botName: string;
    webhookUrl: string;
    secretToken?: string;
  };
  zca: {
    dataDir?: string;
    proxyUrl?: string;
    imei?: string;
    cookie?: string;
    userAgent?: string;
    language?: string;
    selfListen?: boolean;
    checkUpdate?: boolean;
    logging?: boolean;
    autoLogin?: boolean;
    enableWelcome?: boolean;
    welcomeImagePath?: string;
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
  const appUrl = readEnv('APP_URL').replace(/\/+$/, '');

  return {
    port: readNumberEnv('BE_PORT', readNumberEnv('PORT', 3005)),
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
      botName: readEnv('BOT_NAME', readEnv('ZALO_BOT_NAME', 'Bot')),
      webhookUrl: readEnv('ZALO_WEBHOOK_URL', readEnv('WEBHOOK_URL')),
      secretToken: readOptionalEnv('ZALO_WEBHOOK_SECRET_TOKEN'),
    },
    zca: {
      dataDir: readOptionalEnv('DATA_DIR') || readOptionalEnv('ZCA_DATA_DIR'),
      proxyUrl: readOptionalEnv('ZCA_PROXY_URL'),
      imei: readOptionalEnv('ZCA_IMEI'),
      cookie: readOptionalEnv('ZCA_COOKIE'),
      userAgent: readOptionalEnv('ZCA_USER_AGENT'),
      language: readOptionalEnv('ZCA_LANGUAGE'),
      selfListen: readBooleanEnv('ZCA_SELF_LISTEN', false),
      checkUpdate: readBooleanEnv('ZCA_CHECK_UPDATE', true),
      logging: readBooleanEnv('ZCA_LOGGING', false),
      autoLogin: readBooleanEnv('ZCA_AUTO_LOGIN', false),
      enableWelcome: readBooleanEnv('ZCA_ENABLE_WELCOME', false),
      welcomeImagePath: readOptionalEnv('ZCA_WELCOME_IMAGE_PATH'),
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
        model: readEnv('GEMINI_MODEL', 'gemini-3.5-flash-lite'),
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
