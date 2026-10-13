import * as path from 'path';
import * as dotenv from 'dotenv';
import { Zalo, LoginQRCallbackEventType, type LoginQRCallbackEvent } from 'zca-js';
import { HttpProxyAgent } from 'http-proxy-agent';
import nodefetch from 'node-fetch';
import { projectRoot } from '../src/config/project-root';

dotenv.config({ path: path.resolve(projectRoot(), '.env.local') });
dotenv.config({ path: path.resolve(projectRoot(), '.env') });

async function main(): Promise<void> {
  const proxyUrl = process.env.ZCA_PROXY_URL;
  const agent = proxyUrl ? new HttpProxyAgent(proxyUrl) : undefined;

  console.log('='.repeat(60));
  console.log('           ZCA (zca-js) QR LOGIN UTILITY           ');
  console.log('='.repeat(60));
  if (proxyUrl) {
    console.log(`Using Proxy: ${proxyUrl}`);
  } else {
    console.log('Direct connection (no proxy configured)');
  }

  const zalo = new Zalo({
    agent,
    // @ts-expect-error polyfill: nodefetch
    polyfill: nodefetch,
    selfListen: false,
    checkUpdate: false,
    logging: false,
  });

  const qrFilePath = path.resolve(process.cwd(), 'zca-qrcode.png');

  console.log('\n[1/3] Generating Zalo QR Code...');
  try {
    const api = await zalo.loginQR(
      {
        qrPath: qrFilePath,
      },
      (event: LoginQRCallbackEvent) => {
        switch (event.type) {
          case LoginQRCallbackEventType.QRCodeGenerated:
            console.log(`\n[QR Generated] Please scan the QR code saved at:\n👉 ${qrFilePath}`);
            break;
          case LoginQRCallbackEventType.QRCodeScanned:
            console.log(
              `\n[QR Scanned] Scanned by: ${event.data.display_name}. Please confirm on your phone.`,
            );
            break;
          case LoginQRCallbackEventType.QRCodeExpired:
            console.log('\n[QR Expired] Retrying to generate a new QR...');
            event.actions.retry();
            break;
          case LoginQRCallbackEventType.QRCodeDeclined:
            console.log('\n[QR Declined] Login was declined on phone.');
            break;
          case LoginQRCallbackEventType.GotLoginInfo:
            console.log('\n[2/3] Login info captured successfully!');
            console.log('\nAdd these variables to your .env or .env.local file:');
            console.log('-'.repeat(60));
            console.log(`ZCA_IMEI=${event.data.imei}`);
            console.log(`ZCA_USER_AGENT=${event.data.userAgent}`);
            console.log(`ZCA_COOKIE='${JSON.stringify(event.data.cookie)}'`);
            console.log('-'.repeat(60));
            break;
        }
      },
    );

    if (api) {
      console.log('\n[3/3] Authenticated successfully with ZCA API!');
      process.exit(0);
    }
  } catch (err) {
    console.error('\nLogin failed:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

void main();
