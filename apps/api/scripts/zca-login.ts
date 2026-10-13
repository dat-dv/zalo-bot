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

  const fetchPolyfill = (url: any, opts: any) => {
    if (agent) {
      return nodefetch(url, opts).then((res) => {
        if (
          typeof (res.headers as any).getSetCookie !== 'function' &&
          typeof (res.headers as any).raw === 'function'
        ) {
          (res.headers as any).getSetCookie = () =>
            (res.headers as any).raw()['set-cookie'] || [];
        }
        return res;
      });
    }
    return globalThis.fetch(url, opts);
  };

  const userAgent =
    process.env.ZCA_USER_AGENT ||
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

  const zalo = new Zalo({
    agent,
    // @ts-expect-error polyfill: custom fetch polyfill ensuring getSetCookie
    polyfill: fetchPolyfill,
    selfListen: false,
    checkUpdate: false,
    logging: true,
  });

  const qrFilePath = path.resolve(process.cwd(), 'zca-qrcode.png');

  console.log('\n[1/3] Generating Zalo QR Code...');
  try {
    const api = await zalo.loginQR(
      {
        qrPath: qrFilePath,
        userAgent,
      },
      (event: LoginQRCallbackEvent) => {
        switch (event.type) {
          case LoginQRCallbackEventType.QRCodeGenerated:
            console.log(`\n[QR Generated] Please scan the QR code saved at:\n👉 ${qrFilePath}`);
            console.log(`👉 Raw QR string: ${event.data.code}`);
            break;
          case LoginQRCallbackEventType.QRCodeScanned:
            console.log('='.repeat(60));
            console.log(`\n[QR Scanned] 📱 Scanned by: ${event.data.display_name}.`);
            console.log('Please tap "Confirm Login" (Xác nhận đăng nhập) on your phone!');
            console.log('='.repeat(60));
            break;
          case LoginQRCallbackEventType.QRCodeExpired:
            console.log('\n[QR Expired] Retrying to generate a new QR...');
            event.actions.retry();
            break;
          case LoginQRCallbackEventType.QRCodeDeclined:
            console.log('\n[QR Declined] ❌ Login was declined on phone.');
            break;
          case LoginQRCallbackEventType.GotLoginInfo: {
            console.log('\n[2/3] 🔑 Login info captured successfully!');
            console.log('\nAdd these variables to your .env or .env.local file:');
            console.log('-'.repeat(60));
            console.log(`ZCA_IMEI=${event.data.imei}`);
            console.log(`ZCA_USER_AGENT=${event.data.userAgent}`);
            console.log(`ZCA_COOKIE='${JSON.stringify(event.data.cookie)}'`);
            console.log('-'.repeat(60));

            // Auto-save session to .zca-session.json
            try {
              const sessionPath = path.resolve(process.cwd(), '.zca-session.json');
              const fs = require('fs');
              fs.writeFileSync(
                sessionPath,
                JSON.stringify(
                  {
                    imei: event.data.imei,
                    cookie: event.data.cookie,
                    userAgent: event.data.userAgent,
                    savedAt: new Date().toISOString(),
                  },
                  null,
                  2,
                ),
                'utf-8',
              );
              console.log(`\n[Saved] Session automatically saved to: ${sessionPath}`);
            } catch (saveErr) {
              console.warn('\n[Warning] Could not auto-save .zca-session.json:', saveErr);
            }
            break;
          }
        }
      },
    );

    if (api) {
      const ownId = typeof api.getOwnId === 'function' ? api.getOwnId() : 'unknown';
      console.log(`\n[3/3] 🎉 Authenticated successfully with ZCA API! (Own ID: ${ownId})`);
      process.exit(0);
    }
  } catch (err) {
    console.error('\nLogin failed:', err instanceof Error ? err.stack || err.message : String(err));
    process.exit(1);
  }
}

void main();
