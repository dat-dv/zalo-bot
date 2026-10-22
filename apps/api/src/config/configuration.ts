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
    botName: string;
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
    /** Fixed sign-in code (`DASHBOARD_LOGIN_CODE`); signs in as the `dashboard-owner` admin. */
    dashboardLoginCode?: string;
  };
  security: { encryptionKey: string };
  llm: {
    provider: string;
    /** Tried in order after `provider` when it fails (`LLM_FALLBACK_PROVIDERS`). */
    fallbackProviders: string[];
    timeoutMs: number;
    router: {
      baseUrl: string;
      model: string;
      apiKey: string;
    };
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
    port: readNumberEnv('BE_PORT', 3005),
    appUrl,
    webOrigin: readEnv('WEB_ORIGIN', appUrl).replace(/\/+$/, ''),
    cors: { allowAll: readBooleanEnv('CORS_ALLOW_ALL', false) },
    database: {
      url: readEnv('DATABASE_URL'),
      ssl: readOptionalEnv('DATABASE_SSL') === 'true',
      synchronize: readOptionalEnv('TYPEORM_SYNCHRONIZE') === 'true',
    },
    redis: { url: readOptionalEnv('REDIS_URL') },
    zalo: {
      botName: readEnv('BOT_NAME', 'Bot'),
    },
    zca: {
      dataDir: readEnv('DATA_DIR', './data'),
      proxyUrl: readOptionalEnv('ZCA_PROXY_URL'),
      imei: readOptionalEnv('ZCA_IMEI'),
      cookie: readOptionalEnv('ZCA_COOKIE'),
      userAgent: readOptionalEnv('ZCA_USER_AGENT'),
      language: readOptionalEnv('ZCA_LANGUAGE'),
      selfListen: readBooleanEnv('ZCA_SELF_LISTEN', false),
      checkUpdate: readBooleanEnv('ZCA_CHECK_UPDATE', false),
      logging: readBooleanEnv('ZCA_LOGGING', false),
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
      dashboardLoginCode: readOptionalEnv('DASHBOARD_LOGIN_CODE'),
    },
    security: { encryptionKey: readEnv('DATA_ENCRYPTION_KEY', '0'.repeat(64)) },
    llm: {
      provider: readEnv('LLM_PROVIDER', 'gemini'),
      fallbackProviders: readEnv('LLM_FALLBACK_PROVIDERS')
        .split(',')
        .map((name) => name.trim().toLowerCase())
        .filter(Boolean),
      timeoutMs: readNumberEnv('LLM_TIMEOUT_MS', 30000),
      router: {
        baseUrl: readEnv('ROUTER_BASE_URL'),
        model: readEnv('ROUTER_MODEL'),
        apiKey: readOptionalEnv('ROUTER_API_KEY') || '',
      },
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
        baseUrl: readEnv('QWEN_BASE_URL', 'http://localhost:11434'),
        model: readEnv('QWEN_MODEL', 'qwen2.5:14b'),
        apiKey: readOptionalEnv('QWEN_API_KEY') || '',
      },
    },
  };
};
