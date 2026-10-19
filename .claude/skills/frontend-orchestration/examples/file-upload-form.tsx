"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { AppImage } from "@/components/atoms/app-image";
import { Field, FieldError, FieldLabel } from "@/components/atoms/field";
import { Input } from "@/components/atoms/input";
import { Stack } from "@/components/atoms/stack";
import { AppForm, FormButton, FormInput } from "@/components/molecules/form";

const maxFileSize = 5 * 1024 * 1024;
const acceptedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const avatarUploadSchema = z.object({
  username: z.string().trim().min(3, "Username must be at least 3 characters"),
  avatar: z
    .instanceof(File)
    .refine((file) => file.size <= maxFileSize, "Maximum image size is 5MB")
    .refine(
      (file) => acceptedImageTypes.has(file.type),
      "Only JPEG, PNG, and WebP images are supported",
    ),
});

type AvatarUploadCommand = z.infer<typeof avatarUploadSchema>;

export function AvatarUploadForm({
  uploadAvatar,
}: {
  uploadAvatar: (body: FormData) => Promise<void>;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const methods = useForm<AvatarUploadCommand>({
    resolver: zodResolver(avatarUploadSchema),
    defaultValues: { username: "" },
  });

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  function selectFile(file: File | undefined) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (!file) {
      setPreviewUrl(null);
      methods.resetField("avatar");
      return;
    }
    setPreviewUrl(URL.createObjectURL(file));
    methods.setValue("avatar", file, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  async function handleSubmit(command: AvatarUploadCommand) {
    const body = new FormData();
    body.append("username", command.username);
    body.append("avatar", command.avatar);
    await uploadAvatar(body);
  }

  return (
    <AppForm methods={methods} onSubmit={handleSubmit}>
      <Stack gap="md">
        <FormInput name="username" label="Username" />
        <Field data-invalid={Boolean(methods.formState.errors.avatar)}>
          <FieldLabel htmlFor="avatar-input">Avatar image</FieldLabel>
          <Input
            id="avatar-input"
            name="avatar"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => selectFile(event.target.files?.[0])}
          />
          <FieldError errors={[methods.formState.errors.avatar]} />
        </Field>
        {previewUrl ? (
          <Stack className="relative size-24 overflow-hidden rounded-full border">
            <AppImage
              src={previewUrl}
              alt="Selected avatar preview"
              fill
              unoptimized
              className="object-cover"
            />
          </Stack>
        ) : null}
        <FormButton>Upload avatar</FormButton>
      </Stack>
    </AppForm>
  );
}
