import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as url from 'url';
import * as readline from 'readline';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import * as dotenv from 'dotenv';
import { projectRoot, apiRoot } from '../src/config/project-root';

dotenv.config({ path: path.resolve(apiRoot(), '.env.local') });
dotenv.config({ path: path.resolve(apiRoot(), '.env') });
dotenv.config({ path: path.resolve(projectRoot(), '.env.local') });
dotenv.config({ path: path.resolve(projectRoot(), '.env') });

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/tasks',
];

const configuredCredentialsPath = process.env.GOOGLE_OAUTH_CREDENTIALS || './gcp-oauth.keys.json';
const credentialsPath = path.isAbsolute(configuredCredentialsPath)
  ? configuredCredentialsPath
  : path.resolve(projectRoot(), configuredCredentialsPath);

const configuredTokenPath =
  process.env.GOOGLE_CALENDAR_MCP_TOKEN_PATH || './.gcp-saved-tokens.json';
const tokenPath = path.isAbsolute(configuredTokenPath)
  ? configuredTokenPath
  : path.resolve(projectRoot(), configuredTokenPath);

interface InstalledCredentials {
  client_id: string;
  client_secret: string;
  redirect_uris?: string[];
  [key: string]: unknown;
}

interface CredentialsFile {
  installed?: InstalledCredentials;
  web?: InstalledCredentials;
  client_id?: string;
  client_secret?: string;
  redirect_uris?: string[];
}

function main(): void {
  console.log('\n======================================================');
  console.log('🔑 GOOGLE OAUTH 2.0 AUTHENTICATION SETUP HELPER');
  console.log('======================================================\n');

  if (!fs.existsSync(credentialsPath)) {
    console.error(`❌ Không tìm thấy file credentials tại: ${credentialsPath}`);
    console.error('\n👉 Hướng dẫn lấy file gcp-oauth.keys.json:');
    console.error('1. Truy cập https://console.cloud.google.com/apis/credentials');
    console.error('2. Tạo hoặc chọn Google Cloud Project.');
    console.error('3. Bật Google Calendar API & Google Tasks API trong Library.');
    console.error('4. Tạo "OAuth 2.0 Client IDs" (loại Desktop Application hoặc Web Application).');
    console.error(
      '5. Tải file JSON về và lưu tên là "gcp-oauth.keys.json" tại thư mục gốc của dự án.',
    );
    process.exit(1);
  }

  const credentialsRaw = fs.readFileSync(credentialsPath, 'utf8');
  const credentials = JSON.parse(credentialsRaw) as CredentialsFile;
  const keys = credentials.installed || credentials.web || credentials;

  const clientId = keys.client_id;
  const clientSecret = keys.client_secret;
  const redirectUri = 'http://localhost:3000/api/oauth2callback';

  if (!clientId || !clientSecret) {
    console.error('❌ File credentials không hợp lệ (thiếu client_id hoặc client_secret).');
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });

  console.log('🌐 Vui lòng mở đường dẫn sau trên trình duyệt để cấp quyền cho Bot:\n');
  console.log(`\x1b[36m${authUrl}\x1b[0m\n`);
  console.log('------------------------------------------------------');
  console.log('⏳ Đang đợi bạn hoàn tất đăng nhập trên trình duyệt...');
  console.log(
    '(Hoặc nếu bạn chạy trên server headless, bạn có thể dán mã code xác thực trực tiếp tại đây)\n',
  );

  // Start temporary local server to catch callback
  const server = http.createServer(async (req, res) => {
    try {
      if (
        req.url &&
        (req.url.startsWith('/api/oauth2callback') ||
          req.url.startsWith('/oauth2callback') ||
          req.url.includes('code='))
      ) {
        const parsedUrl = new url.URL(req.url, 'http://localhost:3000');
        const code = parsedUrl.searchParams.get('code');

        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(
            '<h2>✅ Xác thực Google thành công!</h2><p>Bạn có thể đóng tab này và quay lại terminal.</p>',
          );

          server.close();
          await exchangeCodeAndSave(oauth2Client, code);
          process.exit(0);
        } else {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<h2>❌ Không tìm thấy mã code xác thực.</h2>');
        }
      }
    } catch (err) {
      console.error('Lỗi callback:', err);
    }
  });

  server.listen(3000, () => {
    // Also provide fallback for manual code entry in terminal
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question('Nhập Authorization Code (nếu không tự động redirect): ', async (code) => {
      rl.close();
      if (code && code.trim()) {
        server.close();
        await exchangeCodeAndSave(oauth2Client, code.trim());
        process.exit(0);
      }
    });
  });
}

async function exchangeCodeAndSave(oauth2Client: OAuth2Client, code: string): Promise<void> {
  try {
    console.log('\n🔄 Đang đổi mã code lấy tokens từ Google...');
    const { tokens } = await oauth2Client.getToken(code);
    fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2), 'utf8');
    console.log(`\n🎉 THÀNH CÔNG! Token đã được lưu an toàn tại: ${tokenPath}`);
    console.log('Bây giờ bạn có thể khởi động bot bằng lệnh: npm start (hoặc npm run start:dev)\n');
  } catch (error) {
    const err = error as Error;
    console.error('❌ Lỗi khi lấy token từ Google:', err.message);
    process.exit(1);
  }
}

try {
  main();
} catch (error) {
  const err = error as Error;
  console.error('Lỗi thực thi:', err.message);
  process.exit(1);
}
