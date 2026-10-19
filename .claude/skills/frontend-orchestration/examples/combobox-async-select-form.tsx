"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Field, FieldError, FieldLabel } from "@/components/atoms/field";
import { Input } from "@/components/atoms/input";
import { List, ListItem } from "@/components/atoms/list";
import { Spinner } from "@/components/atoms/spinner";
import { Stack } from "@/components/atoms/stack";
import { Text } from "@/components/atoms/text";
import { AppForm, FormButton } from "@/components/molecules/form";

import { API_ROUTES } from "@/shared/constants/api-routes";

interface UserOption {
  id: string;
  name: string;
}

async function searchUsersApi(query: string): Promise<UserOption[]> {
  if (!query.trim()) return [];
  const response = await fetch(
    `${API_ROUTES.USERS.LIST}/search?q=${encodeURIComponent(query)}`,
  );
  if (!response.ok) throw new Error("Failed to search users");
  return response.json();
}

const assignUserSchema = z.object({
  assignedUserId: z.string().min(1, "Please select an assigned user"),
});

type AssignUserInput = z.infer<typeof assignUserSchema>;

export function ComboboxAsyncSelectForm({
  onAssign,
}: {
  onAssign: (input: AssignUserInput) => Promise<void>;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);

  const { data: options = [], isPending } = useQuery({
    queryKey: ["users", "search", searchQuery],
    queryFn: () => searchUsersApi(searchQuery),
    enabled: searchQuery.trim().length >= 2,
  });

  const methods = useForm<AssignUserInput>({
    resolver: zodResolver(assignUserSchema),
    defaultValues: {
      assignedUserId: "",
    },
  });

  function handleSelectUser(user: UserOption) {
    setSelectedUser(user);
    methods.setValue("assignedUserId", user.id, { shouldValidate: true });
    setSearchQuery("");
  }

  return (
    <AppForm methods={methods} onSubmit={onAssign}>
      <Stack gap="md" className="w-full max-w-md">
        <Field data-invalid={Boolean(methods.formState.errors.assignedUserId)}>
          <FieldLabel htmlFor="user-search-input">
            Assigned Team Member
          </FieldLabel>
          <Input
            id="user-search-input"
            placeholder="Type at least 2 chars to search..."
            value={selectedUser ? selectedUser.name : searchQuery}
            onChange={(e) => {
              setSelectedUser(null);
              methods.setValue("assignedUserId", "", { shouldValidate: true });
              setSearchQuery(e.target.value);
            }}
          />
          {methods.formState.errors.assignedUserId?.message && (
            <FieldError>
              {String(methods.formState.errors.assignedUserId.message)}
            </FieldError>
          )}
        </Field>

        {isPending && searchQuery.length >= 2 ? (
          <Spinner aria-label="Searching users" />
        ) : null}

        {options.length > 0 && !selectedUser ? (
          <List className="max-h-40 overflow-y-auto border rounded-md p-1">
            {options.map((user) => (
              <ListItem
                key={user.id}
                className="cursor-pointer p-2 hover:bg-accent rounded-sm"
                onClick={() => handleSelectUser(user)}
              >
                <Text>{user.name}</Text>
              </ListItem>
            ))}
          </List>
        ) : null}

        <FormButton>Assign Member</FormButton>
      </Stack>
    </AppForm>
  );
}
