# ZCA Logout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement full ZCA (Zalo Personal Account) logout capabilities across the system, including stopping the WebSocket listener, purging local session files and Redis keys, exposing the REST endpoint, adding the Web UI button, and introducing the `/zca-logout` bot chat command for Admins.

**Architecture:** 
- In `ZcaService`, introduce an idempotent `logout()` method that stops active listeners, cleans in-memory state and thread caches, deletes disk session files (`.zca-session.json`), and purges the Redis session key (`zca:session`).
- Expose `POST /api/zca/logout` on `ZcaController`, registered in `@zalobot/contracts`.
- On Web Frontend (`apps/web`), add `logoutZca` API, `useLogoutZcaMutation`, and add an interactive "Đăng xuất" action in the ZCA connection status card with confirmation.
- On Chat Bot (`apps/api/src/zalo`), add `ZaloLogoutToolStrategy` allowing Admins to disconnect ZCA via `/zca-logout`, `/zalo-logout`, or `/zlogout`.

**Tech Stack:** NestJS, TypeScript, React / Next.js, TanStack Query, Redis (ioredis), `zca-js`, Node.js test runner (`tsx --test`).

## Global Constraints

- Never break existing ZCA features (`login-qr`, message listening, thread configs, reactions, undo).
- `logout()` must be idempotent: calling it when not logged in or when session files don't exist must not throw errors.
- Session cleanup must delete both `sessionFilePath` and legacy `.zca-session.json` in process cwd if present, plus Redis key `zca:session`.
- Bot command `/zca-logout` must require Admin privileges (`usersService.isAdmin(context.senderId)`).

## Review Focus

1. **Idempotence when already logged out**: Calling `logout()` when `this.api === null` should return cleanly without throwing exceptions.
2. **Double session file locations**: If `.zca-session.json` exists in `dataDir` and/or root directory, both must be safely unlinked.
3. **Web UI Cache Invalidation**: Logging out on the web dashboard must immediately update the connection status to "Chưa đăng nhập" and invalidate thread lists so old threads aren't retained in UI state.
4. **Listener shutdown**: `stopListener()` must cleanly disconnect the WebSocket listener so no zombie listeners continue running in the background.
5. **Non-admin security on Bot Command**: A regular user sending `/zca-logout` or `/zalo-logout` must be blocked with an access denied message.

---

### Task 1: Contracts & Shared Types

**Files:**
- Modify: `packages/contracts/src/index.ts`

**Interfaces:**
- Produces: `API_ROUTES.zcaLogout: '/api/zca/logout'`
- Produces: i18n keys for ZCA logout

- [x] **Step 1: Add `zcaLogout` to `API_ROUTES` and i18n in `packages/contracts/src/index.ts`**

Add route:
```typescript
zcaLogout: '/api/zca/logout',
```

Add i18n strings for both `vi` and `en`:
- `vi`: `'zca.logout': 'Đăng xuất ZCA'`, `'zca.logoutConfirm': 'Bạn có chắc chắn muốn ngắt kết nối và đăng xuất tài khoản Zalo cá nhân (ZCA) này không?'`, `'zca.logoutSuccess': 'Đã đăng xuất tài khoản ZCA thành công.'`
- `en`: `'zca.logout': 'Logout ZCA'`, `'zca.logoutConfirm': 'Are you sure you want to disconnect and logout this ZCA personal account?'`, `'zca.logoutSuccess': 'ZCA account logged out successfully.'`

- [x] **Step 2: Build / verify contracts package**

Run: `npm run build --workspace=@zalobot/contracts`
Expected: PASS

- [x] **Step 3: Commit**

```bash
git add packages/contracts/src/index.ts
git commit -m "feat(contracts): add zcaLogout route and i18n keys"
```

---

### Task 2: Backend `ZcaService.logout()` implementation & unit tests

**Files:**
- Modify: `apps/api/src/zca/zca.service.ts`
- Modify: `apps/api/src/zca/zca.service.spec.ts`

**Interfaces:**
- Produces: `ZcaService.logout(): Promise<{ success: boolean; message: string }>`

- [x] **Step 1: Write failing unit test in `apps/api/src/zca/zca.service.spec.ts`**

Test that calling `logout()`:
- Calls `stopListener()`.
- Sets `isLoggedIn()` to `false` and `getApi()` to `null`.
- Deletes `.zca-session.json` from disk.
- Deletes `zca:session` from Redis.
- Clears thread cache and resets `qrLoginStatus`.
- Is idempotent (does not throw if called twice).

- [x] **Step 2: Run test to verify it fails**

Run: `npx tsx --tsconfig apps/api/tsconfig.json --test apps/api/src/zca/zca.service.spec.ts`
Expected: FAIL with `service.logout is not a function`.

- [x] **Step 3: Implement `logout()` in `apps/api/src/zca/zca.service.ts`**

```typescript
public async logout(): Promise<{ success: boolean; message: string }> {
  this.logger.log('[ZCA] Đang thực hiện đăng xuất và ngắt kết nối tài khoản ZCA...');

  // 1. Dừng listener
  try {
    this.stopListener();
  } catch (err) {
    this.logger.warn(`[ZCA] Lỗi khi dừng listener: ${formatErrorMessage(err)}`);
  }

  // 2. Reset trạng thái bộ nhớ
  this.api = null;
  this.isListening = false;
  this.latestQrImageBase64 = null;
  this.latestQrCode = null;
  this.cachedAvailableThreads = [];
  this.cachedThreadsExpiresAt = 0;
  this.qrLoginStatus = {
    phase: 'idle',
    message: 'Chưa có yêu cầu đăng nhập QR nào',
    updatedAt: Date.now(),
  };

  // 3. Xóa session file trên disk
  try {
    if (fs.existsSync(this.sessionFilePath)) {
      fs.unlinkSync(this.sessionFilePath);
      this.logger.log(`[ZCA] Đã xóa file phiên: ${this.sessionFilePath}`);
    }
    const legacyPath = path.resolve(process.cwd(), '.zca-session.json');
    if (legacyPath !== this.sessionFilePath && fs.existsSync(legacyPath)) {
      fs.unlinkSync(legacyPath);
      this.logger.log(`[ZCA] Đã xóa file phiên cũ: ${legacyPath}`);
    }
  } catch (err) {
    this.logger.warn(`[ZCA] Lỗi khi xóa file phiên ZCA: ${formatErrorMessage(err)}`);
  }

  // 4. Xóa session trong Redis
  try {
    if (this.redisService) {
      await this.redisService.del('zca:session');
      this.logger.log('[ZCA] Đã xóa phiên ZCA khỏi Redis (key: zca:session)');
    }
  } catch (err) {
    this.logger.warn(`[ZCA] Lỗi khi xóa session khỏi Redis: ${formatErrorMessage(err)}`);
  }

  return {
    success: true,
    message: 'Đã đăng xuất tài khoản ZCA và xóa phiên làm việc thành công.',
  };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx tsx --tsconfig apps/api/tsconfig.json --test apps/api/src/zca/zca.service.spec.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add apps/api/src/zca/zca.service.ts apps/api/src/zca/zca.service.spec.ts
git commit -m "feat(zca): implement logout in ZcaService with session purge"
```

---

### Task 3: Backend `ZcaController` `@Post('logout')` endpoint & tests

**Files:**
- Modify: `apps/api/src/zca/zca.controller.ts`
- Create: `apps/api/src/zca/zca.controller.spec.ts`

**Interfaces:**
- Produces: `POST /api/zca/logout`

- [x] **Step 1: Write test for `ZcaController.logout` in `apps/api/src/zca/zca.controller.spec.ts`**

Test that calling `controller.logout()` invokes `zcaService.logout()` and returns standard `{ data: { success: true, message: string } }`.

- [x] **Step 2: Run test to verify it fails**

Run: `npx tsx --tsconfig apps/api/tsconfig.json --test apps/api/src/zca/zca.controller.spec.ts`
Expected: FAIL with `controller.logout is not a function`.

- [x] **Step 3: Implement `logout` in `apps/api/src/zca/zca.controller.ts`**

```typescript
@Post('logout')
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Đăng xuất và xóa phiên tài khoản Zalo cá nhân (ZCA)' })
public async logout(): Promise<{ data: { success: boolean; message: string } }> {
  const result = await this.zcaService.logout();
  return { data: result };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx tsx --tsconfig apps/api/tsconfig.json --test apps/api/src/zca/zca.controller.spec.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add apps/api/src/zca/zca.controller.ts apps/api/src/zca/zca.controller.spec.ts
git commit -m "feat(zca): add POST /api/zca/logout endpoint"
```

---

### Task 4: Bot Text Command `/zca-logout` & Strategy

**Files:**
- Modify: `apps/api/src/zalo/text/text-tool.enum.ts`
- Create: `apps/api/src/zalo/text/strategies/zalo-logout-tool.strategy.ts`
- Create: `apps/api/src/zalo/text/strategies/zalo-logout-tool.strategy.spec.ts`
- Modify: `apps/api/src/zalo/text/text-tool.factory.ts`
- Modify: `apps/api/src/zalo/text/strategies/help-tool.strategy.ts`
- Modify: `apps/api/src/zalo/zalo.module.ts`

**Interfaces:**
- Consumes: `ZcaService.logout()`, `UsersService.isAdmin()`
- Produces: `ZaloLogoutToolStrategy` triggered by `/zca-logout`, `/zalo-logout`, `/zlogout`

- [x] **Step 1: Add enum value and write unit tests for `ZaloLogoutToolStrategy`**

In `text-tool.enum.ts`: Add `ZALO_LOGOUT = 'ZALO_LOGOUT'`.
In `zalo-logout-tool.strategy.spec.ts`:
- Rejects non-admin users.
- Informs when ZCA is not currently logged in.
- Calls `zcaService.logout()` and notifies user when admin triggers it.

- [x] **Step 2: Run test to verify failure**

Run: `npx tsx --tsconfig apps/api/tsconfig.json --test apps/api/src/zalo/text/strategies/zalo-logout-tool.strategy.spec.ts`
Expected: FAIL

- [x] **Step 3: Implement `ZaloLogoutToolStrategy`, register in factory, module, and help text**

Implement `ZaloLogoutToolStrategy`:
```typescript
@Injectable()
export class ZaloLogoutToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.ZALO_LOGOUT;
  private readonly logger = new Logger(ZaloLogoutToolStrategy.name);

  constructor(
    private readonly zaloService: ZaloService,
    private readonly zcaService: ZcaService,
    @Optional() private readonly usersService?: UsersService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const isAdmin = Boolean(this.usersService?.isAdmin(context.senderId));
    if (!isAdmin) {
      await this.zaloService.sendMessage(
        context.chatId,
        `⛔ QUYỀN TRUY CẬP BỊ GIỚI HẠN\n\nChỉ Quản trị viên (Admin) mới có quyền đăng xuất ZCA.`,
      );
      return;
    }

    if (!this.zcaService.isLoggedIn()) {
      await this.zaloService.sendMessage(
        context.chatId,
        `ℹ️ Tài khoản Zalo cá nhân (ZCA) hiện đang ở trạng thái CHƯA ĐĂNG NHẬP.`,
      );
      return;
    }

    await this.zcaService.logout();
    await this.zaloService.sendMessage(
      context.chatId,
      `✅ ĐÃ ĐĂNG XUẤT TÀI KHOẢN ZCA THÀNH CÔNG!\n\n• Bot đã dừng lắng nghe tin nhắn cá nhân & nhóm ZCA.\n• Phiên làm việc và cookies đã được xóa sạch an toàn.\n\n💡 Để kết nối lại, bạn có thể gõ /zalo-login bất cứ lúc nào.`,
    );
  }
}
```

In `text-tool.factory.ts`: Recognize `/zalo-logout`, `/zca-logout`, `/zlogout`.
In `help-tool.strategy.ts`: Add `/zca-logout` to admin commands.
In `zalo.module.ts`: Add `ZaloLogoutToolStrategy` to providers.

- [x] **Step 4: Run test to verify it passes**

Run: `npx tsx --tsconfig apps/api/tsconfig.json --test apps/api/src/zalo/text/strategies/zalo-logout-tool.strategy.spec.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add apps/api/src/zalo/ apps/api/src/zca/
git commit -m "feat(zalo): add /zca-logout chat command for administrators"
```

---

### Task 5: Web Frontend API, Mutation & UI Button

**Files:**
- Modify: `apps/web/src/modules/zca/api/zca-api.ts`
- Modify: `apps/web/src/modules/zca/api/zca-query.ts`
- Modify: `apps/web/src/modules/zca/view/zca-screen.tsx`

**Interfaces:**
- Produces: `logoutZca`, `useLogoutZcaMutation`
- UI: Logout button on ZCA Status card with confirmation and loading state

- [x] **Step 1: Add `logoutZca` in `apps/web/src/modules/zca/api/zca-api.ts`**

```typescript
export async function logoutZca(
  signal?: AbortSignal,
): Promise<{ success: boolean; message: string }> {
  const response = await httpClient.post<IApiResponse<{ success: boolean; message: string }>>(
    API_ROUTES.zcaLogout,
    {},
    { signal },
  );
  return response.data.data;
}
```

- [x] **Step 2: Add `useLogoutZcaMutation` in `apps/web/src/modules/zca/api/zca-query.ts`**

On success, invalidate queries:
- `queryClient.invalidateQueries({ queryKey: [zcaQueryKeys.status] })`
- `queryClient.invalidateQueries({ queryKey: [zcaQueryKeys.threads] })`
- `queryClient.invalidateQueries({ queryKey: [zcaQueryKeys.configs] })`

- [x] **Step 3: Update `apps/web/src/modules/zca/view/zca-screen.tsx`**

- When `status?.loggedIn` is `true`:
  - Show a "Đăng xuất" button in the connection card (or next to "Làm mới / Quét mã QR").
  - On click, prompt user with confirmation dialog (`window.confirm(t('zca.logoutConfirm'))`).
  - If confirmed, execute `logoutMutation.mutateAsync()`.
  - Handle loading/disabled state gracefully.

- [x] **Step 4: Run web tests and typecheck**

Run: `npm run build --workspace=@zalobot/web`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add apps/web/src/modules/zca/
git commit -m "feat(web): add ZCA logout API, mutation, and UI button"
```

---

### Task 6: Full Integration Verification

- [x] **Step 1: Run complete test suite**

Run: `npm test`
Expected: All 243+ tests pass.

- [x] **Step 2: Build all packages**

Run: `npm run build`
Expected: Zero build errors across contracts, api, and web.

- [x] **Step 3: Commit final updates and documentation**

```bash
git add docs/superpowers/plans/
git commit -m "docs: complete zca logout implementation plan"
```
