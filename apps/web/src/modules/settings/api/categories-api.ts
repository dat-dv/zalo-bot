import {
  API_ROUTES,
  type IApiResponse,
  type ICategoryItem,
  type ICreateCategoryRequest,
  type IUpdateCategoryRequest,
} from '@zalobot/contracts';
import { httpClient } from '@/shared/api/http-client';

export async function getCategories(
  type?: 'income' | 'expense',
  signal?: AbortSignal,
): Promise<ICategoryItem[]> {
  const url = type ? `${API_ROUTES.categories}?type=${type}` : API_ROUTES.categories;
  const response = await httpClient.get<IApiResponse<ICategoryItem[]>>(url, { signal });
  return response.data.data;
}

export async function createCategory(
  data: ICreateCategoryRequest,
  signal?: AbortSignal,
): Promise<ICategoryItem> {
  const response = await httpClient.post<IApiResponse<ICategoryItem>>(API_ROUTES.categories, data, {
    signal,
  });
  return response.data.data;
}

export async function updateCategory(
  id: string,
  data: IUpdateCategoryRequest,
  signal?: AbortSignal,
): Promise<ICategoryItem> {
  const response = await httpClient.patch<IApiResponse<ICategoryItem>>(
    `${API_ROUTES.categories}/${id}`,
    data,
    { signal },
  );
  return response.data.data;
}

export async function deleteCategory(id: string, signal?: AbortSignal): Promise<boolean> {
  const response = await httpClient.delete<IApiResponse<{ deleted: boolean }>>(
    `${API_ROUTES.categories}/${id}`,
    { signal },
  );
  return response.data.data.deleted;
}
