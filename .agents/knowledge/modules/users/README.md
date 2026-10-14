# Users Module

> Developer guide (Vietnamese): [`README.md`](../../../docs/modules/users/README.md)

## Purpose

`apps/api/src/users` and `apps/web/src/modules/users` manage multi-tenant user accounts, role-based authorization (Admin / User), bot access grants (`grantAccess`), and user-scoped Google Drive storage partitions.

## Backend Architecture & Rules

- **Entity Schema (`UserEntity`)**:
  - `id`: Zalo user identifier.
  - `firstName`: Display name.
  - `role`: `admin` or `user` (`UserRole`).
  - `grantAccess`: `granted`, `denied`, or `pending` (`GrantAccessStatus`).
  - `driveFolderId`, `driveFolderUrl`, `driveFolderPath`: Per-user Google Drive folder (`zalobot/u-<userId>`).
- **Authorization & Access Control**:
  - Automatically designates the configured `ZALO_ADMIN_ID` as system admin.
  - Manages invite code lifecycle (24h validity).
  - Toggles runtime access privileges (`setGrantAccess`, `banUser`). When access is revoked, existing sessions and Google tokens are suspended.

## Web UI (`UsersScreen`)

- **Screen (`apps/web/src/modules/users/view/users-screen.tsx`)**:
  - Filter bar supporting queries across all users, granted, pending, and admin tiers.
  - Interactive "Thêm người dùng" modal with validation.
  - Data table displaying Zalo ID with 1-click clipboard copy, user avatars, role badges, direct grant-access toggle switch, and delete action with confirmation.

## Integration Seams & Contracts

- Endpoints in `API_ROUTES`: `users`, `usersGrantAccess(id)`.
- Contracts in `packages/contracts`: `IUser`, `CreateUserDto`, `UpdateUserDto`, `UserRole`, `GrantAccessStatus`.
