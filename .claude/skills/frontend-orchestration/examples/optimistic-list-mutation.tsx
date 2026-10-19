"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/atoms/button";
import { List, ListItem } from "@/components/atoms/list";
import { Spinner } from "@/components/atoms/spinner";
import { Stack } from "@/components/atoms/stack";
import { Text } from "@/components/atoms/text";

import { API_ROUTES } from "@/shared/constants/api-routes";

interface TaskItem {
  id: string;
  title: string;
  completed: boolean;
}

async function fetchTasks(): Promise<TaskItem[]> {
  const response = await fetch(API_ROUTES.TASKS.LIST);
  if (!response.ok) throw new Error("Failed to fetch tasks");
  return response.json();
}

async function toggleTaskApi({
  id,
  completed,
}: {
  id: string;
  completed: boolean;
}): Promise<TaskItem> {
  const response = await fetch(
    `${API_ROUTES.TASKS.LIST}/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed }),
    },
  );
  if (!response.ok) throw new Error("Failed to update task");
  return response.json();
}

export function OptimisticListMutation() {
  const queryClient = useQueryClient();
  const queryKey = ["tasks", "list"];

  const { data: tasks = [], isPending } = useQuery({
    queryKey,
    queryFn: fetchTasks,
  });

  const toggleMutation = useMutation({
    mutationFn: toggleTaskApi,
    onMutate: async (updatedTask) => {
      await queryClient.cancelQueries({ queryKey });

      const previousTasks = queryClient.getQueryData<TaskItem[]>(queryKey);

      queryClient.setQueryData<TaskItem[]>(queryKey, (old = []) =>
        old.map((task) =>
          task.id === updatedTask.id
            ? { ...task, completed: updatedTask.completed }
            : task,
        ),
      );

      return { previousTasks };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(queryKey, context.previousTasks);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  if (isPending) return <Spinner aria-label="Loading tasks" />;

  return (
    <Stack gap="md">
      <List>
        {tasks.map((task) => (
          <ListItem key={task.id} className="flex items-center justify-between">
            <Text className={task.completed ? "line-through opacity-60" : ""}>
              {task.title}
            </Text>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                toggleMutation.mutate({
                  id: task.id,
                  completed: !task.completed,
                })
              }
            >
              {task.completed ? "Mark Pending" : "Mark Done"}
            </Button>
          </ListItem>
        ))}
      </List>
    </Stack>
  );
}
