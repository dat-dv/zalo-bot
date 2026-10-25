import { config as loadDotenv } from 'dotenv';
import { isDashboardAccessCode, normalizeDashboardAccessCode } from '@zalobot/contracts';
import { fromProjectRoot } from './project-root';

/** The fixed code never expires, so it needs more guesses than the rate limit allows in practice. */
const DASHBOARD_LOGIN_CODE_MIN_LENGTH = 6;

export interface EnvValidationResult {
  isValid: boolean;
  errors: Array<{ key: string; reason: string; guide: string }>;
}

function readEnv(key: string): string {
  return (
    process.env[key]
      ?.trim()
      .replace(/^['"]+|['"]+$/g, '')
      .trim() ?? ''
  );
}

function addError(
  errors: EnvValidationResult['errors'],
  key: string,
  reason: string,
  guide: string,
): void {
  errors.push({ key, reason, guide });
}

function isPositiveInteger(value: string): boolean {
  return Number.isSafeInteger(Number(value)) && Number(value) > 0;
}

function isBoolean(value: string): boolean {
  return ['true', 'false'].includes(value.toLowerCase());
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isPostgresUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'postgres:' || url.protocol === 'postgresql:';
  } catch {
    return false;
  }
}

export function loadEnvironment(): void {
  loadDotenv({ path: fromProjectRoot('.env.local'), override: false, quiet: true });
  loadDotenv({ path: fromProjectRoot('.env'), override: false, quiet: true });
}

export function validateEnvironment(): EnvValidationResult {
  const errors: Array<{ key: string; reason: string; guide: string }> = [];

  const requiredKeys = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'DASHBOARD_ACCESS_TOKEN_SECRET',
    'DASHBOARD_REFRESH_TOKEN_SECRET',
  ];
  for (const key of requiredKeys) {
    if (!readEnv(key))
      addError(
        errors,
        key,
        'Biến môi trường bắt buộc đang trống.',
        'Khai báo giá trị trong file .env.local hoặc môi trường triển khai.',
      );
  }

  const rawLoginCode = readEnv('DASHBOARD_LOGIN_CODE');
  const loginCode = normalizeDashboardAccessCode(rawLoginCode);
  if (
    rawLoginCode &&
    (!isDashboardAccessCode(loginCode) || loginCode.length < DASHBOARD_LOGIN_CODE_MIN_LENGTH)
  ) {
    addError(
      errors,
      'DASHBOARD_LOGIN_CODE',
      `Phải gồm ít nhất ${DASHBOARD_LOGIN_CODE_MIN_LENGTH} chữ số (khoảng trắng, dấu gạch ngang tuỳ ý).`,
      'Khai báo mã dạng 1234-5678 hoặc bỏ trống để tắt đăng nhập bằng mã cố định.',
    );
  }

  // Optional keys below have defaults in configuration.ts; validate only when they are set.
  for (const key of ['BE_PORT', 'NGINX_PORT']) {
    const value = readEnv(key);
    if (value && !isPositiveInteger(value)) {
      addError(
        errors,
        key,
        'Phải là số nguyên dương.',
        `Khai báo số nguyên dương cho ${key} trong file .env hoặc bỏ trống để dùng mặc định.`,
      );
    }
  }

  if (!isHttpUrl(readEnv('APP_URL'))) {
    addError(
      errors,
      'APP_URL',
      'Phải là URL HTTP(S) hợp lệ.',
      'Khai báo URL đầy đủ, ví dụ https://example.com.',
    );
  }

  for (const key of ['WEB_ORIGIN', 'COGNEE_URL']) {
    const value = readEnv(key);
    if (value && !isHttpUrl(value)) {
      addError(
        errors,
        key,
        'Phải là URL HTTP(S) hợp lệ.',
        key === 'COGNEE_URL'
          ? 'Khai báo URL đầy đủ (ví dụ http://cognee:8000) hoặc bỏ trống để tắt Cognee.'
          : 'Khai báo URL đầy đủ hoặc bỏ trống để suy ra từ APP_URL.',
      );
    }
  }

  if (!isPostgresUrl(readEnv('DATABASE_URL'))) {
    addError(
      errors,
      'DATABASE_URL',
      'Phải là connection URL PostgreSQL hợp lệ.',
      'Khai báo theo dạng postgresql://user:password@host:5432/database.',
    );
  }

  const corsAllowAll = readEnv('CORS_ALLOW_ALL');
  if (corsAllowAll && !isBoolean(corsAllowAll)) {
    addError(
      errors,
      'CORS_ALLOW_ALL',
      'Chỉ nhận true hoặc false.',
      'Khai báo true hoặc false, hoặc bỏ trống (mặc định false).',
    );
  }

  if (!/^[0-9a-f]{64}$/i.test(readEnv('DATA_ENCRYPTION_KEY'))) {
    addError(
      errors,
      'DATA_ENCRYPTION_KEY',
      'Phải là khóa hexadecimal 64 ký tự.',
      'Tạo bằng openssl rand -hex 32 rồi lưu vào .env.local.',
    );
  }

  const timezone = readEnv('DEFAULT_TIMEZONE');
  if (timezone) {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
    } catch {
      addError(
        errors,
        'DEFAULT_TIMEZONE',
        'Timezone IANA không hợp lệ.',
        'Ví dụ: Asia/Ho_Chi_Minh.',
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function printEnvValidationBanner(
  errors: Array<{ key: string; reason: string; guide: string }>,
): void {
  const line = '═'.repeat(76);
  const border = '─'.repeat(76);

  console.error('\n\x1b[41m\x1b[37m' + `╔${line}╗` + '\x1b[0m');
  console.error(
    '\x1b[41m\x1b[37m' +
      `║${' '.repeat(20)}❌ THIẾU CẤU HÌNH BIẾN MÔI TRƯỜNG (.ENV)${' '.repeat(20)}║` +
      '\x1b[0m',
  );
  console.error('\x1b[41m\x1b[37m' + `╚${line}╝` + '\x1b[0m\n');

  console.error(
    '\x1b[33m⚠️  Ứng dụng không thể khởi động vì thiếu các thông tin cấu hình bắt buộc sau:\x1b[0m\n',
  );

  errors.forEach((err, index) => {
    console.error(`\x1b[1m\x1b[31m${index + 1}. [BIẾN]: ${err.key}\x1b[0m`);
    console.error(`   ❌ \x1b[31mLý do:\x1b[0m ${err.reason}`);
    console.error(`   👉 \x1b[32mCách lấy:\x1b[0m ${err.guide}`);
    console.error(`   ${border}`);
  });

  console.error(
    '\n\x1b[36m📘 Hướng dẫn chi tiết từng bước xem tại file:\x1b[0m \x1b[1mdocs/quick-setup-runbook.md\x1b[0m\n',
  );
}
