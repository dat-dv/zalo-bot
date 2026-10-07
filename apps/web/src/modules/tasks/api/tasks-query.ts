import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ITaskListItem, IUpdateTaskRequest } from '@zalobot/contracts';
import { deleteTask, getTasks, updateTask } from './tasks-api';

export const tasksQueryKeys = { list: () => ['tasks'] as const };

export function useTasksQuery() {
  return useQuery<ITaskListItem[]>({
    queryKey: tasksQueryKeys.list(),
    queryFn: ({ signal }) => getTasks(signal),
  });
}

export function useUpdateTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation<ITaskListItem, Error, { id: string; data: IUpdateTaskRequest }>({
    mutationFn: ({ id, data }) => updateTask(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tasksQueryKeys.list() });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation<boolean, Error, string>({
    mutationFn: (id) => deleteTask(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tasksQueryKeys.list() });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
