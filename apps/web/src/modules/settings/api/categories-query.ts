'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ICategoryItem,
  ICreateCategoryRequest,
  IUpdateCategoryRequest,
} from '@zalobot/contracts';
import { createCategory, deleteCategory, getCategories, updateCategory } from './categories-api';

export const categoriesQueryKeys = {
  all: ['categories'] as const,
  list: (type?: 'income' | 'expense') => ['categories', 'list', type ?? 'all'] as const,
};

export function useCategoriesQuery(type?: 'income' | 'expense') {
  return useQuery<ICategoryItem[]>({
    queryKey: categoriesQueryKeys.list(type),
    queryFn: ({ signal }) => getCategories(type, signal),
  });
}

export function useCreateCategoryMutation() {
  const queryClient = useQueryClient();
  return useMutation<ICategoryItem, Error, ICreateCategoryRequest>({
    mutationFn: (data) => createCategory(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: categoriesQueryKeys.all });
    },
  });
}

export function useUpdateCategoryMutation() {
  const queryClient = useQueryClient();
  return useMutation<ICategoryItem, Error, { id: string; data: IUpdateCategoryRequest }>({
    mutationFn: ({ id, data }) => updateCategory(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: categoriesQueryKeys.all });
    },
  });
}

export function useDeleteCategoryMutation() {
  const queryClient = useQueryClient();
  return useMutation<boolean, Error, string>({
    mutationFn: (id) => deleteCategory(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: categoriesQueryKeys.all });
    },
  });
}
