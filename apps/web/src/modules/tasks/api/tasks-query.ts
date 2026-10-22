import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ICreateTaskRequest,
  ITaskListItem,
  ITaskReminderChannel,
  IUpdateTaskRequest,
} from '@zalobot/contracts';
import {
  createTask,
  deleteTask,
  getTaskReminderChannels,
  getTasks,
  updateTask,
} from './tasks-api';

export const tasksQueryKeys = {
  list: () => ['tasks'] as const,
  reminderChannels: () => ['tasks', 'reminder-channels'] as const,
};

export function useTasksQuery() {
  return useQuery<ITaskListItem[]>({
    queryKey: tasksQueryKeys.list(),
    queryFn: ({ signal }) => getTasks(signal),
  });
}

/** Loaded only while a form that picks a reminder chat is open. */
export function useTaskReminderChannelsQuery(enabled: boolean) {
  return useQuery<ITaskReminderChannel[]>({
    queryKey: tasksQueryKeys.reminderChannels(),
    queryFn: ({ signal }) => getTaskReminderChannels(signal),
    enabled,
    staleTime: 60_000,
  });
}

function useInvalidateTasks() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: tasksQueryKeys.list() });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };
}

export function useCreateTaskMutation() {
  const invalidate = useInvalidateTasks();
  return useMutation<ITaskListItem, Error, ICreateTaskRequest>({
    mutationFn: (data) => createTask(data),
    onSuccess: invalidate,
  });
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
