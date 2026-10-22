import {
  API_ROUTES,
  type IApiResponse,
  type ICombineContactsRequest,
  type ICombineContactsResponse,
  type IContactListItem,
  type IContactProfile,
  type IContactProfileResponse,
  type IContactUserSyncResult,
  type IUpdateContactProfileRequest,
  type IUpdateContactRequest,
} from '@zalobot/contracts';
import { httpClient } from '@/shared/api/http-client';

export async function getContacts(signal?: AbortSignal): Promise<IContactListItem[]> {
  const response = await httpClient.get<IApiResponse<IContactListItem[]>>(API_ROUTES.contacts, {
    signal,
  });
  return response.data.data;
}

export async function updateContact(
  id: string,
  data: IUpdateContactRequest,
  signal?: AbortSignal,
): Promise<IContactListItem> {
  const response = await httpClient.patch<IApiResponse<IContactListItem>>(
    `${API_ROUTES.contacts}/${id}`,
    data,
    { signal },
  );
  return response.data.data;
}

export async function combineContacts(
  data: ICombineContactsRequest,
  signal?: AbortSignal,
): Promise<ICombineContactsResponse> {
  const response = await httpClient.post<IApiResponse<ICombineContactsResponse>>(
    API_ROUTES.contactsCombine,
    data,
    { signal },
  );
  return response.data.data;
}

export async function syncUsersIntoContacts(signal?: AbortSignal): Promise<IContactUserSyncResult> {
  const response = await httpClient.post<IApiResponse<IContactUserSyncResult>>(
    API_ROUTES.contactsSyncUsers,
    undefined,
    { signal },
  );
  return response.data.data;
}

export async function deleteContact(id: string, signal?: AbortSignal): Promise<boolean> {
  const response = await httpClient.delete<IApiResponse<{ deleted: boolean }>>(
    `${API_ROUTES.contacts}/${id}`,
    { signal },
  );
  return response.data.data.deleted;
}

export async function createContact(
  data: IUpdateContactRequest,
  signal?: AbortSignal,
): Promise<IContactListItem> {
  const response = await httpClient.post<IApiResponse<IContactListItem>>(
    API_ROUTES.contacts,
    data,
    {
      signal,
    },
  );
  return response.data.data;
}

export async function getContactProfile(
  id: string,
  signal?: AbortSignal,
): Promise<IContactProfileResponse> {
  const response = await httpClient.get<IApiResponse<IContactProfileResponse>>(
    API_ROUTES.contactProfile(id),
    { signal },
  );
  return response.data.data;
}

export async function updateContactProfile(
  id: string,
  data: IUpdateContactProfileRequest,
  signal?: AbortSignal,
): Promise<IContactProfile> {
  const response = await httpClient.patch<IApiResponse<IContactProfile>>(
    API_ROUTES.contactProfile(id),
    data,
    { signal },
  );
  return response.data.data;
}
