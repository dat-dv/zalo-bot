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

function useInvalidateTasks() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: tasksQueryKeys.list() });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };
}

export function useUpdateTaskMutation() {
  const invalidate = useInvalidateTasks();
  return useMutation<ITaskListItem, Error, { id: string; data: IUpdateTaskRequest }>({
    mutationFn: ({ id, data }) => updateTask(id, data),
    onSuccess: invalidate,
  });
}

export function useDeleteTaskMutation() {
  const invalidate = useInvalidateTasks();
  return useMutation<boolean, Error, string>({
    mutationFn: (id) => deleteTask(id),
    onSuccess: invalidate,
  });
}
