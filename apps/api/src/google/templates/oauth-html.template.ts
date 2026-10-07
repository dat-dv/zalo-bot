export function renderSuccessHtml(botUsername?: string): string {
  const returnUrl = botUsername ? `https://zalo.me/${botUsername}` : 'https://zalo.me';

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kết Nối Google Thành Công | Zalo Bot</title>
  <style>
    :root {
      --primary: #4285F4;
      --success: #34A853;
      --bg: #0f172a;
      --card: #1e293b;
      --text: #f8fafc;
      --subtext: #94a3b8;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    body {
      background-color: var(--bg);
      color: var(--text);
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 20px;
    }
    .card {
      background: var(--card);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 24px;
      padding: 40px 32px;
      max-width: 440px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
      animation: fadeIn 0.6s ease-out;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .icon-wrapper {
      width: 80px;
      height: 80px;
      background: rgba(52, 168, 83, 0.15);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      border: 2px solid var(--success);
      color: var(--success);
      font-size: 40px;
    }
    h1 {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 12px;
      color: #ffffff;
    }
    p {
      color: var(--subtext);
      font-size: 15px;
      line-height: 1.6;
      margin-bottom: 32px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      padding: 14px 24px;
      background: #0068FF;
      color: white;
      text-decoration: none;
      font-weight: 600;
      font-size: 16px;
      border-radius: 14px;
      transition: all 0.2s ease;
      box-shadow: 0 4px 14px rgba(0, 104, 255, 0.4);
    }
    .btn:hover {
      background: #0052cc;
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0, 104, 255, 0.6);
    }
    .footer {
      margin-top: 24px;
      font-size: 13px;
      color: var(--subtext);
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-wrapper">✓</div>
    <h1>Kết Nối Thành Công!</h1>
    <p>Tài khoản Google Workspace của bạn đã được kết nối an toàn với trợ lý cá nhân. Bạn có thể quay lại Zalo ngay bây giờ.</p>
    <a href="${returnUrl}" class="btn">👉 Mở Lại Zalo</a>
    <div class="footer">Bạn có thể an tâm đóng tab trình duyệt này.</div>
  </div>
</body>
</html>`;
}

export function renderErrorHtml(errorMessage: string): string {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lỗi Kết Nối Google | Zalo Bot</title>
  <style>
    :root {
      --error: #EA4335;
      --bg: #0f172a;
      --card: #1e293b;
      --text: #f8fafc;
      --subtext: #94a3b8;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    body {
      background-color: var(--bg);
      color: var(--text);
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 20px;
    }
    .card {
      background: var(--card);
      border: 1px solid rgba(234, 67, 53, 0.2);
      border-radius: 24px;
      padding: 40px 32px;
      max-width: 440px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    }
    .icon-wrapper {
      width: 80px;
      height: 80px;
      background: rgba(234, 67, 53, 0.15);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      border: 2px solid var(--error);
      color: var(--error);
      font-size: 40px;
    }
    h1 {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 12px;
      color: #ffffff;
    }
    p {
      color: var(--subtext);
      font-size: 15px;
      line-height: 1.6;
      margin-bottom: 32px;
    }
    .error-box {
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.05);
      padding: 12px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 13px;
      color: #fca5a5;
      margin-bottom: 24px;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-wrapper">✕</div>
    <h1>Kết Nối Thất Bại</h1>
    <p>Đã xảy ra sự cố trong quá trình xác thực với Google. Vui lòng thử lại sau.</p>
    <div class="error-box">${errorMessage}</div>
  </div>
</body>
</html>`;
}
