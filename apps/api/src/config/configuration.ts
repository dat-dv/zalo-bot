import * as path from 'node:path';

/**
 * Multilingual sentence embeddings (384 dimensions), ONNX build for transformers.js. Changing it
 * means re-embedding every message (`zca_message_embeddings.model` tells which rows are stale).
 */
export const DEFAULT_EMBEDDING_MODEL = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';

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
  /** The provider chain itself lives in the `llm_providers` table (dashboard Settings). */
  llm: {
    timeoutMs: number;
  };
  /**
   * Long-term chat memory: sentence embeddings computed inside the API (no LLM, no remote call
   * once the model files are there). `modelDir` holds them; the Docker image ships them baked in.
   */
  memory: {
    embeddingModel: string;
    embeddingModelDir: string;
  };
  webhook: {
    apiKey: string;
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
      timeoutMs: readNumberEnv('LLM_TIMEOUT_MS', 30000),
    },
    memory: {
      embeddingModel: readEnv('EMBEDDING_MODEL', DEFAULT_EMBEDDING_MODEL),
      embeddingModelDir: readEnv(
        'EMBEDDING_MODEL_DIR',
        path.join(readEnv('DATA_DIR', './data'), 'models'),
      ),
    },
    webhook: {
      // Empty turns the outbound webhook off (404).
      apiKey: readEnv('WEBHOOK_API_KEY'),
    },
  };
};
