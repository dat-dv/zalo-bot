import * as path from 'path';
import * as dotenv from 'dotenv';
import { projectRoot } from '../src/config/project-root';

dotenv.config({ path: path.resolve(projectRoot(), '.env.local') });
dotenv.config({ path: path.resolve(projectRoot(), '.env') });

const token = process.env.ZALO_BOT_TOKEN || process.env.BOT_TOKEN;
const webhookUrl = process.env.ZALO_WEBHOOK_URL || process.env.WEBHOOK_URL;
const secretToken = process.env.ZALO_WEBHOOK_SECRET_TOKEN;

if (!token) {
  console.error('❌ Thiếu biến môi trường ZALO_BOT_TOKEN trong file .env');
  process.exit(1);
}

const baseUrl = `https://bot-api.zaloplatforms.com/bot${token}`;

async function getWebhookInfo() {
  console.log('📡 Đang kiểm tra thông tin cấu hình Webhook từ Zalo Platform...');
  const res = await fetch(`${baseUrl}/getWebhookInfo`);
  const data = await res.json();
  console.log('Kết quả getWebhookInfo:');
  console.log(JSON.stringify(data, null, 2));
  return data;
}

async function testWebhook() {
  console.log('🧪 Đang kiểm tra kết nối từ máy chủ Zalo tới Webhook endpoint...');
  const res = await fetch(`${baseUrl}/testWebhook`);
  const data = (await res.json()) as {
    ok?: boolean;
    result?: {
      ok?: boolean;
      url?: string;
      outcome?: string;
      hint?: string;
    };
  };
  console.log('Kết quả testWebhook:');
  console.log(JSON.stringify(data, null, 2));

  if (data?.result?.ok) {
    console.log('\n✅ KẾT NỐI THÀNH CÔNG! Zalo có thể gửi webhook tới server của bạn.');
  } else {
    console.log('\n❌ KẾT NỐI THẤT BẠI!');
    if (data?.result?.outcome === 'webhook.http.403') {
      console.log('👉 Lỗi HTTP 403 Forbidden:');
      console.log('   - Cloudflare đang chặn request từ Zalo (thường do Bot Fight Mode hoặc WAF rule).');
      console.log('   - Giải pháp: Vào Cloudflare Dashboard -> Security -> Bots -> Tắt "Bot Fight Mode".');
    }
    if (data?.result?.hint) {
      console.log(`👉 Gợi ý từ Zalo: ${data.result.hint}`);
    }
  }
  return data;
}

async function setWebhook() {
  if (!webhookUrl) {
    console.error('❌ Thiếu biến môi trường ZALO_WEBHOOK_URL trong file .env');
    process.exit(1);
  }

  console.log(`🚀 Đang đăng ký Webhook URL: ${webhookUrl}`);
  if (secretToken) {
    console.log(`🔒 Kèm secret_token: ${secretToken}`);
  }

  const payload: { url: string; secret_token?: string } = {
    url: webhookUrl,
  };
  if (secretToken) {
    payload.secret_token = secretToken;
  }

  const res = await fetch(`${baseUrl}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = (await res.json()) as {
    ok?: boolean;
    result?: {
      ok?: boolean;
      verification?: {
        ok?: boolean;
        outcome?: string;
        hint?: string;
      };
    };
  };

  console.log('Kết quả setWebhook:');
  console.log(JSON.stringify(data, null, 2));

  if (data?.ok && data?.result?.verification?.ok !== false) {
    console.log('\n🎉 Đăng ký Webhook thành công!');
  } else if (data?.result?.verification?.ok === false) {
    console.log('\n⚠️ Webhook đã được lưu nhưng Zalo xác thực thất bại:');
    console.log(`Outcome: ${data.result.verification.outcome}`);
    if (data.result.verification.hint) {
      console.log(`Hint: ${data.result.verification.hint}`);
    }
  }
  return data;
}

async function deleteWebhook() {
  console.log('🗑️ Đang xóa Webhook trên Zalo Platform...');
  const res = await fetch(`${baseUrl}/deleteWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  console.log('Kết quả deleteWebhook:');
  console.log(JSON.stringify(data, null, 2));
  return data;
}

async function main() {
  const command = process.argv[2] || 'status';

  try {
    switch (command) {
      case 'set':
        await setWebhook();
        break;
      case 'test':
        await testWebhook();
        break;
      case 'delete':
        await deleteWebhook();
        break;
      case 'status':
      default:
        await getWebhookInfo();
        console.log('--------------------------------------------------');
        await testWebhook();
        break;
    }
  } catch (err) {
    console.error('❌ Lỗi thực thi script:', (err as Error).message);
    process.exit(1);
  }
}

main();
