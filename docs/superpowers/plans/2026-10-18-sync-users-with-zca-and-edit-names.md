# Sync Users With ZCA And Edit Names Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow admins to clearly identify users on the `/users` page by enriching user profiles with ZCA contact data (avatar, display name, alias, phone number) and enabling manual editing of names/notes for any user.

**Architecture:** 
1. Extend `IUserListItem` contract with `avatarUrl`, `phoneNumber`, `alias`, and `zaloName`.
2. Connect `UsersService` with `ZcaService` to enrich `users` records in PostgreSQL with contact information from the logged-in personal Zalo session (ZCA), with a manual/auto `POST /users/sync-zca` endpoint.
3. Extend `PATCH /users/:id` to allow admins to edit a user's display name (`firstName`), phone number (`phoneNumber`), and notes.
4. Upgrade the frontend `/users` page with real avatars, phone numbers, alias badges, a "Đồng bộ ZCA" button, and an "Edit User" dialog.

**Tech Stack:** NestJS, TypeORM, PostgreSQL, Next.js (App Router), React, Tailwind CSS, `@zalobot/contracts`.

---

## Global Constraints

- Preserve backwards compatibility with existing `UserEntity` columns (`avatar_url`, `phone_number` already exist in DB).
- Maintain all existing tests passing with zero regressions.
- Non-admin users must not access `/users/sync-zca` or edit user profiles.

---

## Task 1: Update Contracts (`packages/contracts`)

**Files:**
- Modify: `packages/contracts/src/index.ts:1511-1521`
- Modify: `packages/contracts/src/index.ts:240-270` (API_ROUTES)

**Interfaces:**
- Produces: Updated `IUserListItem` with `avatarUrl?: string`, `phoneNumber?: string`, `alias?: string`, `zaloName?: string`.
- Produces: `API_ROUTES.usersSyncZca: '/users/sync-zca'`.

- [ ] **Step 1: Update `IUserListItem` and `API_ROUTES` in `packages/contracts/src/index.ts`**
- [ ] **Step 2: Build contracts workspace**
  Run: `npm run build --workspace=@zalobot/contracts`
  Expected: Clean compilation, `dist/` updated.
- [ ] **Step 3: Commit contracts changes**
  ```bash
  git add packages/contracts/
  git commit -m "feat(contracts): add avatarUrl, phoneNumber, and sync-zca route to user contracts"
  ```

---

## Task 2: Backend ZCA Sync & Profile Update in `UsersService` & `UsersController`

**Files:**
- Modify: `apps/api/src/users/users.service.ts`
- Modify: `apps/api/src/users/users.controller.ts`
- Modify: `apps/api/src/users/users.module.ts`
- Test: `apps/api/src/users/users.service.spec.ts`
- Test: `apps/api/src/users/users.controller.spec.ts`

- [ ] **Step 1: Write unit tests in `users.service.spec.ts` for `syncUsersWithZca` and profile editing**
- [ ] **Step 2: Implement `syncUsersWithZca` and `updateUserProfile` in `UsersService`**
  - Inject `ZcaService` (via `@Optional() @Inject(forwardRef(() => ZcaService))`).
  - `syncUsersWithZca()` checks if ZCA is logged in, fetches `getAvailableThreads()`, matches with `users`, and populates `firstName`, `avatarUrl`, `phoneNumber`.
  - In `getUsers()`, enrich records with `alias` or `zaloName` from ZCA thread map if available.
- [ ] **Step 3: Update `UsersController` to expose `POST /users/sync-zca` and support `firstName`, `phoneNumber`, `avatarUrl` in `PATCH /users/:id`**
- [ ] **Step 4: Run backend tests to verify**
  Run: `npm test --workspace=@zalobot/api`
  Expected: All tests pass.
- [ ] **Step 5: Commit backend changes**
  ```bash
  git add apps/api/
  git commit -m "feat(api): add sync-zca and profile editing to users module"
  ```

---

## Task 3: Frontend API & Query Hooks (`apps/web`)

**Files:**
- Modify: `apps/web/src/modules/users/api/users-api.ts`
- Modify: `apps/web/src/modules/users/api/users-query.ts`

- [ ] **Step 1: Add `syncUsersWithZca` and update `updateUser` in `users-api.ts`**
- [ ] **Step 2: Add `useSyncUsersWithZcaMutation` and `useUpdateUserMutation` in `users-query.ts` with cache invalidation**
- [ ] **Step 3: Commit frontend API changes**
  ```bash
  git add apps/web/src/modules/users/api/
  git commit -m "feat(web): add zca sync and update mutations for users"
  ```

---

## Task 4: Frontend UI Upgrade (`users-screen.tsx`)

**Files:**
- Modify: `apps/web/src/modules/users/view/users-screen.tsx`

- [ ] **Step 1: Add `UserAvatar` component with real image support and initial fallback**
- [ ] **Step 2: Display `avatarUrl`, `phoneNumber`, and `alias` badge in user row**
- [ ] **Step 3: Add "Đồng bộ ZCA" button in toolbar**
- [ ] **Step 4: Add "Sửa người dùng" modal allowing admins to edit display name (`firstName`) and phone number (`phoneNumber`)**
- [ ] **Step 5: Add phone number field to "Thêm người dùng mới" modal**
- [ ] **Step 6: Update search filter to match on phone number and alias**
- [ ] **Step 7: Build web application to verify no type or bundler errors**
  Run: `npm run build --workspace=@zalobot/web`
  Expected: Build succeeds.
- [ ] **Step 8: Commit UI changes**
  ```bash
  git add apps/web/src/modules/users/view/
  git commit -m "feat(web): enrich users table with avatars, phone numbers, edit modal, and zca sync"
  ```

---

## Task 5: End-to-End Verification

- [ ] **Step 1: Run full test suite across all packages**
  Run: `npm test`
  Expected: All tests pass.
- [ ] **Step 2: Verify git status and changes**
