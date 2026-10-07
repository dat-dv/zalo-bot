import {
  API_ROUTES,
  type IApiResponse,
  type ICombineContactsRequest,
  type ICombineContactsResponse,
  type IContactListItem,
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

export async function deleteContact(id: string, signal?: AbortSignal): Promise<boolean> {
  const response = await httpClient.delete<IApiResponse<{ deleted: boolean }>>(
    `${API_ROUTES.contacts}/${id}`,
    { signal },
  );
  return response.data.data.deleted;
}
