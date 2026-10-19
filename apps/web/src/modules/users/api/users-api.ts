import {
  API_ROUTES,
  type IApiResponse,
  type IUserListItem,
  type IUserMergeResult,
  type IUserMergeSummary,
  UserRole,
  GrantAccessStatus,
} from '@zalobot/contracts';
import { httpClient } from '@/shared/api/http-client';

export async function getUsers(signal?: AbortSignal): Promise<IUserListItem[]> {
  const response = await httpClient.get<IApiResponse<IUserListItem[]>>(API_ROUTES.users, {
    signal,
  });
  return response.data.data;
}

export async function createUser(
  data: {
    id: string;
    firstName?: string;
    phoneNumber?: string;
    avatarUrl?: string;
    role?: UserRole;
    grantAccess?: GrantAccessStatus;
  },
  signal?: AbortSignal,
): Promise<IUserListItem> {
  const response = await httpClient.post<IApiResponse<IUserListItem>>(API_ROUTES.users, data, {
    signal,
  });
  return response.data.data;
}

export async function setGrantAccess(
  id: string,
  grantAccess: GrantAccessStatus,
  signal?: AbortSignal,
): Promise<IUserListItem> {
  const response = await httpClient.patch<IApiResponse<IUserListItem>>(
    API_ROUTES.usersGrantAccess(id),
    { grantAccess },
    { signal },
  );
  return response.data.data;
}

export async function updateUser(
  id: string,
  data: {
    firstName?: string;
    phoneNumber?: string;
    avatarUrl?: string;
    role?: UserRole;
    grantAccess?: GrantAccessStatus;
  },
  signal?: AbortSignal,
): Promise<IUserListItem> {
  const response = await httpClient.patch<IApiResponse<IUserListItem>>(
    `${API_ROUTES.users}/${id}`,
    data,
    { signal },
  );
  return response.data.data;
}

export async function updateUserRole(
  id: string,
  role: UserRole,
  signal?: AbortSignal,
): Promise<IUserListItem> {
  return updateUser(id, { role }, signal);
}

export async function syncUsersWithZca(
  signal?: AbortSignal,
): Promise<{ syncedCount: number; totalUsers: number }> {
  const response = await httpClient.post<IApiResponse<{ syncedCount: number; totalUsers: number }>>(
    API_ROUTES.usersSyncZca,
    {},
    { signal },
  );
  return response.data.data;
}

export async function deleteUser(id: string, signal?: AbortSignal): Promise<boolean> {
  const response = await httpClient.delete<IApiResponse<{ deleted: boolean }>>(
    `${API_ROUTES.users}/${id}`,
    { signal },
  );
  return response.data.data.deleted;
}

export async function getUserMergePreview(
  sourceUserId: string,
  targetUserId: string,
  signal?: AbortSignal,
): Promise<IUserMergeSummary> {
  const response = await httpClient.get<IApiResponse<IUserMergeSummary>>(
    API_ROUTES.usersMergePreview(sourceUserId),
    { params: { targetUserId }, signal },
  );
  return response.data.data;
}

export async function mergeUser(
  sourceUserId: string,
  targetUserId: string,
  signal?: AbortSignal,
): Promise<IUserMergeResult> {
  const response = await httpClient.post<IApiResponse<IUserMergeResult>>(
    API_ROUTES.usersMerge(sourceUserId),
    { targetUserId },
    { signal },
  );
  return response.data.data;
}
