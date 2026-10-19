"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/atoms/button";
import { Stack } from "@/components/atoms/stack";
import { AppForm, FormButton, FormInput } from "@/components/molecules/form";

const contactsSchema = z.object({
  contacts: z
    .array(z.object({ email: z.string().email("Enter a valid email") }))
    .min(1),
});

type ContactsCommand = z.infer<typeof contactsSchema>;

export function ContactsForm({
  saveContacts,
}: {
  saveContacts: (command: ContactsCommand) => Promise<void>;
}) {
  const methods = useForm<ContactsCommand>({
    resolver: zodResolver(contactsSchema),
    defaultValues: { contacts: [{ email: "" }] },
  });
  const contacts = useFieldArray({
    control: methods.control,
    name: "contacts",
  });

  return (
    <AppForm methods={methods} onSubmit={saveContacts}>
      <Stack gap="md">
        {contacts.fields.map((field, index) => (
          <Stack key={field.id} gap="sm">
            <FormInput
              name={`contacts.${index}.email`}
              label={`Contact ${index + 1}`}
              type="email"
            />
            <Button
              type="button"
              variant="outline"
              disabled={contacts.fields.length === 1}
              onClick={() => contacts.remove(index)}
            >
              Remove contact {index + 1}
            </Button>
          </Stack>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={() => contacts.append({ email: "" })}
        >
          Add contact
        </Button>
        <FormButton>Save contacts</FormButton>
      </Stack>
    </AppForm>
  );
}
