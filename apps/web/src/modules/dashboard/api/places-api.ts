import {
  API_ROUTES,
  type IApiResponse,
  type ICreatePlaceRequest,
  type IFinancePlace,
  type IUpdatePlaceRequest,
} from '@zalobot/contracts';
import { httpClient } from '@/shared/api/http-client';

export async function getPlaces(signal?: AbortSignal): Promise<IFinancePlace[]> {
  const response = await httpClient.get<IApiResponse<IFinancePlace[]>>(API_ROUTES.places, {
    signal,
  });
  return response.data.data;
}

export async function createPlace(
  data: ICreatePlaceRequest,
  signal?: AbortSignal,
): Promise<IFinancePlace> {
  const response = await httpClient.post<IApiResponse<IFinancePlace>>(API_ROUTES.places, data, {
    signal,
  });
  return response.data.data;
}

export async function updatePlace(
  id: string,
  data: IUpdatePlaceRequest,
  signal?: AbortSignal,
): Promise<IFinancePlace> {
  const response = await httpClient.patch<IApiResponse<IFinancePlace>>(
    `${API_ROUTES.places}/${id}`,
    data,
    { signal },
  );
  return response.data.data;
}

export async function deletePlace(id: string, signal?: AbortSignal): Promise<boolean> {
  const response = await httpClient.delete<IApiResponse<{ deleted: boolean }>>(
    `${API_ROUTES.places}/${id}`,
    { signal },
  );
  return response.data.data.deleted;
}
