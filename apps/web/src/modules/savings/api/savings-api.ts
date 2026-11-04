import {
  API_ROUTES,
  type IApiResponse,
  type ICreateSavingGroupRequest,
  type ICreateSavingMovementRequest,
  type ISavingGroup,
  type ISavingGroupListResponse,
  type ISavingMovement,
  type IUpdateSavingGroupRequest,
} from '@zalobot/contracts';
import { httpClient } from '@/shared/api/http-client';

export async function getSavingGroups(signal?: AbortSignal): Promise<ISavingGroupListResponse> {
  const response = await httpClient.get<IApiResponse<ISavingGroupListResponse>>(
    API_ROUTES.savingGroups,
    { signal },
  );
  return response.data.data;
}

export async function createSavingGroup(data: ICreateSavingGroupRequest): Promise<ISavingGroup> {
  const response = await httpClient.post<IApiResponse<ISavingGroup>>(API_ROUTES.savingGroups, data);
  return response.data.data;
}

export async function updateSavingGroup(
  id: string,
  data: IUpdateSavingGroupRequest,
): Promise<ISavingGroup> {
  const response = await httpClient.patch<IApiResponse<ISavingGroup>>(
    API_ROUTES.savingGroup(id),
    data,
  );
  return response.data.data;
}

export async function archiveSavingGroup(id: string): Promise<ISavingGroup> {
  const response = await httpClient.delete<IApiResponse<ISavingGroup>>(API_ROUTES.savingGroup(id));
  return response.data.data;
}

export async function getSavingMovements(
  groupId: string,
  signal?: AbortSignal,
): Promise<ISavingMovement[]> {
  const response = await httpClient.get<IApiResponse<ISavingMovement[]>>(
    API_ROUTES.savingGroupMovements(groupId),
    { signal },
  );
  return response.data.data;
}

export async function addSavingMovement(
  groupId: string,
  data: ICreateSavingMovementRequest,
): Promise<ISavingMovement> {
  const response = await httpClient.post<IApiResponse<ISavingMovement>>(
    API_ROUTES.savingGroupMovements(groupId),
    data,
  );
  return response.data.data;
}

export async function deleteSavingMovement(groupId: string, movementId: string): Promise<void> {
  await httpClient.delete(API_ROUTES.savingGroupMovement(groupId, movementId));
}
