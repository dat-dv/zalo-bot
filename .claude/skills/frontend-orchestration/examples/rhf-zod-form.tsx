"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Stack } from "@/components/atoms/stack";
import { AppForm, FormButton, FormInput } from "@/components/molecules/form";
import { applyFormErrors } from "@/lib/forms";

export interface UserFormMessages {
  usernameMin: string;
  emailInvalid: string;
  requestFailed: string;
  submit: string;
}

const createUserSchema = (messages: UserFormMessages) =>
  z.object({
    username: z.string().trim().min(3, messages.usernameMin),
    email: z.string().trim().email(messages.emailInvalid),
  });

type UserInput = z.infer<ReturnType<typeof createUserSchema>>;

export function UserFormExample({
  messages,
  saveUser,
}: {
  messages: UserFormMessages;
  saveUser: (command: UserInput) => Promise<void>;
}) {
  const methods = useForm<UserInput>({
    resolver: zodResolver(createUserSchema(messages)),
    defaultValues: { username: "", email: "" },
  });

  async function handleSubmit(command: UserInput) {
    methods.clearErrors("root");
    try {
      await saveUser(command);
    } catch (error) {
      applyFormErrors(error, methods.setError, messages.requestFailed);
    }
  }

  return (
    <AppForm methods={methods} onSubmit={handleSubmit}>
      <Stack gap="md">
        <FormInput name="username" label="Username" autoComplete="username" />
        <FormInput
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
        />
        <FormButton>{messages.submit}</FormButton>
      </Stack>
    </AppForm>
  );
}
