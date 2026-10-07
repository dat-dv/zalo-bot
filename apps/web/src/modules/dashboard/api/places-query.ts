'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ICreatePlaceRequest, IFinancePlace, IUpdatePlaceRequest } from '@zalobot/contracts';
import { createPlace, deletePlace, getPlaces, updatePlace } from './places-api';
import { dashboardQueryKeys } from './dashboard-query';

export const placesQueryKeys = {
  all: ['places'] as const,
  list: () => ['places', 'list'] as const,
};

export function usePlacesQuery() {
  return useQuery<IFinancePlace[]>({
    queryKey: placesQueryKeys.list(),
    queryFn: ({ signal }) => getPlaces(signal),
  });
}

export function useCreatePlaceMutation() {
  const queryClient = useQueryClient();
  return useMutation<IFinancePlace, Error, ICreatePlaceRequest>({
    mutationFn: (data) => createPlace(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: placesQueryKeys.list() });
      void queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.detail() });
    },
  });
}

export function useUpdatePlaceMutation() {
  const queryClient = useQueryClient();
  return useMutation<IFinancePlace, Error, { id: string; data: IUpdatePlaceRequest }>({
    mutationFn: ({ id, data }) => updatePlace(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: placesQueryKeys.list() });
      void queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.detail() });
    },
  });
}

export function useDeletePlaceMutation() {
  const queryClient = useQueryClient();
  return useMutation<boolean, Error, string>({
    mutationFn: (id) => deletePlace(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: placesQueryKeys.list() });
      void queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.detail() });
    },
  });
}
