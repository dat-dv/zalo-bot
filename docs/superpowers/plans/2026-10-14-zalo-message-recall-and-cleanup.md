# Zalo Message Recall & Confirmation Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement message recall (`undo`) for pending confirmation cards on Zalo when actions are confirmed, cancelled, timed out, or edited, and consolidate confirmation success into a single unified message containing the full DTO details.

**Architecture:** 
1. Expose safe `undoMessage` on `ZaloService` delegating to `ZcaService.undo` using `msgId` and `cliMsgId`.
2. Update `TransactionConfirmationService` to store `cliMsgId` alongside `messageId` in memory & Redis.
3. Automatically recall pending confirmation messages on `processEdit`, `processConfirm`, `processCancel`, and `handleTimeout`.
4. Consolidate confirmation notification in `processConfirm` so that whether confirmed via heart reaction (❤️) or text command (`yes <mã>`), exactly one message is sent containing both the status header and the full DTO details, eliminating duplicate messages from `ZcaBotFeatureService`.

**Tech Stack:** NestJS, TypeScript, Redis (ioredis), `zca-js` (Zalo Client API), Node.js built-in test runner (`tsx --test`).

**Spec:** Conversation requirements:
- Confirmation prompts (`⏳ Xác nhận...`) must be recalled for everyone (`undo`) upon confirmation, timeout (5 mins), cancellation, or edit.
- If confirmed via heart reaction: send exactly one unified message: `🎉 Đã nhận đủ X lượt thả tim (❤️)! Yêu cầu [mã] đã được xác nhận thành công.\n\n<DTO Card>`.
- If timeout: recall prompt and send only `⏰ Yêu cầu ... (mã: ...) đã hết hạn 5 phút và chưa được xác nhận.`
- If cancelled: recall prompt and send only `❌ Đã hủy ... (mã: ...). Yêu cầu chưa được lưu.`
- If recall fails (Zalo network/API error): gracefully catch and log, never block or disrupt business transaction persistence.
- Redis keys must be cleared properly upon completion/cancellation/timeout.

## Global Constraints
- Do not alter database schemas or existing DTO validation rules.
- Any call to `undoMessage` MUST be non-blocking and wrapped in try-catch so failures never throw into business logic.
- Preserve existing backward compatibility for `sendMessageWithResult` and `createPendingAction`.

## Review Focus
1. `undoMessage` fails or throws network exception: business transaction must still be committed and final confirmation sent.
2. Reaction confirmation (❤️): only one unified message sent to thread, not two separate messages.
3. Edit flow (`edit <code`>): old prompt message is recalled immediately so old buttons/codes don't linger.
4. Expiration (`handleTimeout`): old prompt card is recalled before sending the expiration notice.
5. Redis cleanup: `pending:tx:code:*`, `pending:tx:user:*`, `pending:tx:msg:*` are cleaned up on confirmation, cancel, or timeout.

---

### Task 1: Add `undoMessage` and `cliMsgId` capture in `ZaloService` & `TransactionConfirmationService`

**Files:**
- Modify: `apps/api/src/zalo/zalo.service.ts`
- Modify: `apps/api/src/zalo/transaction-confirmation.service.ts`
- Test: `apps/api/src/zalo/transaction-confirmation.service.spec.ts`

**Interfaces:**
- Produces:
  - `ZaloService.undoMessage(chatId: string | number, msgId: string, cliMsgId?: string): Promise<boolean>`
  - `ZaloService.sendMessageWithResult(chatId, text): Promise<{ success: boolean; msgId?: string; cliMsgId?: string }>`
  - `PendingAction.cliMsgId?: string`

- [ ] **Step 1: Write failing test in `transaction-confirmation.service.spec.ts` for `cliMsgId` capture and `undoMessage` call**

```typescript
void test('TransactionConfirmationService captures cliMsgId and exposes undoMessage helper', async () => {
  let undonePayload: { chatId: string | number; msgId: string; cliMsgId?: string } | undefined;
  const mockZaloService = {
    sendMessageWithResult: async () => ({
      success: true,
      msgId: 'msg_100',
      cliMsgId: 'cli_200',
    }),
    sendMessage: async () => true,
    undoMessage: async (chatId: string | number, msgId: string, cliMsgId?: string) => {
      undonePayload = { chatId, msgId, cliMsgId };
      return true;
    },
  };
  // Test pending creation captures cliMsgId
  // ...
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --tsconfig apps/api/tsconfig.json --test apps/api/src/zalo/transaction-confirmation.service.spec.ts`
Expected: FAIL (types/implementation missing)

- [ ] **Step 3: Implement `undoMessage` and `cliMsgId` in `ZaloService` and `TransactionConfirmationService`**

In `apps/api/src/zalo/zalo.service.ts`:
- Update `sendMessageWithResult` to extract `cliMsgId`:
  ```typescript
  const rawMsg = res?.message as unknown as { msgId?: string | number; cliMsgId?: string | number } | undefined;
  const msgId = rawMsg?.msgId !== undefined ? String(rawMsg.msgId) : undefined;
  const cliMsgId = rawMsg?.cliMsgId !== undefined ? String(rawMsg.cliMsgId) : undefined;
  return { success: true, msgId, cliMsgId };
  ```
- Add `undoMessage(chatId: string | number, msgId: string, cliMsgId?: string): Promise<boolean>`:
  ```typescript
  public async undoMessage(
    chatId: string | number,
    msgId: string,
    cliMsgId?: string,
  ): Promise<boolean> {
    const targetChatId = String(chatId);
    if (!this.zcaService?.isLoggedIn()) {
      return false;
    }
    try {
      await this.zcaService.undo(
        { msgId, cliMsgId: cliMsgId || msgId },
        targetChatId,
      );
      this.logger.log(`Successfully recalled message ${msgId} in chat ${targetChatId}`);
      return true;
    } catch (err) {
      this.logger.warn(`Failed to recall message ${msgId} in chat ${targetChatId}: ${(err as Error).message}`);
      return false;
    }
  }
  ```

In `apps/api/src/zalo/transaction-confirmation.service.ts`:
- Add `cliMsgId?: string;` to `PendingAction` and `setMessageId(code, messageId, cliMsgId?)`.
- In `createPendingAction`: pass `cliMsgId` to Redis and memory store.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --tsconfig apps/api/tsconfig.json --test apps/api/src/zalo/transaction-confirmation.service.spec.ts`
Expected: PASS

---

### Task 2: Immediate message recall on `processEdit`

**Files:**
- Modify: `apps/api/src/zalo/transaction-confirmation.service.ts`
- Test: `apps/api/src/zalo/transaction-confirmation.service.spec.ts`

**Interfaces:**
- Consumes: `ZaloService.undoMessage`, `PendingAction.messageId`, `PendingAction.cliMsgId`

- [ ] **Step 1: Write failing test in `transaction-confirmation.service.spec.ts` for recalling message on edit**

```typescript
void test('TransactionConfirmationService recalls previous message when action is edited', async () => {
  let recalledMsgId: string | undefined;
  // setup mock zaloService.undoMessage to capture recalledMsgId
  // invoke handleCommand with edit 123
  // assert recalledMsgId === 'msg_initial'
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --tsconfig apps/api/tsconfig.json --test apps/api/src/zalo/transaction-confirmation.service.spec.ts`
Expected: FAIL

- [ ] **Step 3: Implement prompt message recall in `processEdit`**

In `apps/api/src/zalo/transaction-confirmation.service.ts` inside `processEdit`:
- If `pending.messageId` exists, call `void this.zaloService.undoMessage(chatId, pending.messageId, pending.cliMsgId);`
- Proceed with `onEdit` and `deletePending`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --tsconfig apps/api/tsconfig.json --test apps/api/src/zalo/transaction-confirmation.service.spec.ts`
Expected: PASS

---

### Task 3: Unified Success Message & Message Recall on `processConfirm`

**Files:**
- Modify: `apps/api/src/zalo/transaction-confirmation.service.ts`
- Modify: `apps/api/src/zca/zca-bot-feature.service.ts`
- Test: `apps/api/src/zalo/transaction-confirmation.service.spec.ts`
- Test: `apps/api/src/zca/zca-bot-feature.service.spec.ts`

**Interfaces:**
- Consumes: `PendingAction`, `renderDtoConfirmationCard`, `ZaloService.undoMessage`
- Produces:
  - `processConfirm(userId, chatId, code?, silent?, options?: { isHeartConfirmed?: boolean; requiredHearts?: number }): Promise<boolean>`
  - Sends single message with heart celebration header or text confirmation header + DTO card content.
  - Automatically recalls prompt card `pending.messageId`.

- [ ] **Step 1: Write failing tests in `transaction-confirmation.service.spec.ts` & `zca-bot-feature.service.spec.ts`**

```typescript
void test('processConfirm recalls pending confirmation message and formats heart header when isHeartConfirmed is true', async () => {
  // test message recall
  // test reply text starts with: 🎉 Đã nhận đủ 1 lượt thả tim (❤️)! Yêu cầu [xxx] đã được xác nhận thành công.
  // test reply contains DTO card fields (• Phân loại:, • Số tiền:, etc.)
  // test no second message is emitted
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --tsconfig apps/api/tsconfig.json --test apps/api/src/zalo/transaction-confirmation.service.spec.ts`
Expected: FAIL

- [ ] **Step 3: Implement unified confirmation in `processConfirm` and update `ZcaBotFeatureService.onReaction`**

In `TransactionConfirmationService`:
- When confirming, call `void this.zaloService.undoMessage(chatId, pending.messageId, pending.cliMsgId);`
- Define header builder:
  - If `options?.isHeartConfirmed`: `🎉 Đã nhận đủ ${options.requiredHearts || 1} lượt thả tim (❤️)! Yêu cầu [${pending.code}] đã được xác nhận thành công!\n\n`
  - Else: `✅ Đã xác nhận và lưu ${typeLabel.toLowerCase()} thành công!\n\n`
- Combine header with `cardContent` into one reply string.
- If the transaction has `placeName`, clean up companion pending place for this user and recall its prompt card too so it doesn't linger or timeout later.
In `ZcaBotFeatureService.onReaction`:
- Pass `{ isHeartConfirmed: true, requiredHearts: req }` into `processConfirm`.
- Remove the redundant `await api.sendMessage(msg, threadId, threadType);` when `status === 'confirmed'`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsx --tsconfig apps/api/tsconfig.json --test apps/api/src/zalo/transaction-confirmation.service.spec.ts`
Run: `npx tsx --tsconfig apps/api/tsconfig.json --test apps/api/src/zca/zca-bot-feature.service.spec.ts`
Expected: PASS

---

### Task 4: Message Recall on Timeout & Cancellation

**Files:**
- Modify: `apps/api/src/zalo/transaction-confirmation.service.ts`
- Test: `apps/api/src/zalo/transaction-confirmation.service.spec.ts`

**Interfaces:**
- Consumes: `handleTimeout`, `processCancel`, `ZaloService.undoMessage`

- [ ] **Step 1: Write failing test in `transaction-confirmation.service.spec.ts` for timeout and cancellation recall**

```typescript
void test('handleTimeout recalls pending card message and sends only timeout notice', async () => {
  // verify undoMessage was called for pending.messageId
  // verify timeout notice message was sent
});

void test('processCancel recalls pending card message and sends cancellation notice', async () => {
  // verify undoMessage was called for pending.messageId
  // verify cancel notice was sent
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --tsconfig apps/api/tsconfig.json --test apps/api/src/zalo/transaction-confirmation.service.spec.ts`
Expected: FAIL

- [ ] **Step 3: Implement prompt card recall in `handleTimeout` and `processCancel`**

In `apps/api/src/zalo/transaction-confirmation.service.ts`:
- In `handleTimeout`:
  ```typescript
  if (pending.messageId) {
    void this.zaloService.undoMessage(pending.chatId, pending.messageId, pending.cliMsgId);
  }
  ```
- In `processCancel`:
  ```typescript
  if (pending.messageId) {
    void this.zaloService.undoMessage(chatId, pending.messageId, pending.cliMsgId);
  }
  ```
- In `ZcaBotFeatureService.onReaction`: remove duplicate message on `cancelled` if `processCancel` already handled notification.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --tsconfig apps/api/tsconfig.json --test apps/api/src/zalo/transaction-confirmation.service.spec.ts`
Expected: PASS

---

### Task 5: Full Suite Verification & Build Check

**Files:**
- Entire codebase

- [ ] **Step 1: Run all unit tests**

Run: `npx tsx --tsconfig apps/api/tsconfig.json --test $(find apps/api/src -name '*.spec.ts')`
Expected: All tests PASS

- [ ] **Step 2: Run type check**

Run: `npm run typecheck --workspace=@zalobot/api`
Expected: 0 type errors

- [ ] **Step 3: Commit changes**

```bash
git add apps/api/src/zalo/ apps/api/src/zca/ docs/superpowers/plans/
git commit -m "feat(zalo): recall confirmation cards on confirm, timeout, cancel, and edit"
```
