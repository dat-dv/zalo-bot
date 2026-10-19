"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/atoms/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/atoms/card";
import { Heading } from "@/components/atoms/heading";
import { Stack } from "@/components/atoms/stack";
import { Text } from "@/components/atoms/text";
import { AppForm, FormButton, FormInput } from "@/components/molecules/form";

const stepOneSchema = z.object({
  email: z.string().email("Invalid email address"),
  username: z.string().trim().min(3, "Username must be at least 3 characters"),
});

const stepTwoSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required"),
  bio: z.string().max(200, "Bio must be under 200 characters").optional(),
});

const wizardSchema = stepOneSchema.merge(stepTwoSchema);

type WizardValues = z.infer<typeof wizardSchema>;

export function MultiStepWizardForm({
  onComplete,
}: {
  onComplete: (values: WizardValues) => Promise<void>;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const methods = useForm<WizardValues>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      email: "",
      username: "",
      fullName: "",
      bio: "",
    },
  });

  async function nextStep() {
    if (step === 1) {
      const valid = await methods.trigger(["email", "username"]);
      if (valid) setStep(2);
    } else if (step === 2) {
      const valid = await methods.trigger(["fullName", "bio"]);
      if (valid) setStep(3);
    }
  }

  function prevStep() {
    if (step > 1) setStep((s) => (s - 1) as 1 | 2 | 3);
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>Onboarding Wizard - Step {step} of 3</CardTitle>
      </CardHeader>
      <AppForm methods={methods} onSubmit={onComplete}>
        <CardContent>
          <Stack gap="md">
            {step === 1 && (
              <Stack gap="sm">
                <Heading level={3}>Account Information</Heading>
                <FormInput name="email" label="Email Address" type="email" />
                <FormInput name="username" label="Username" />
              </Stack>
            )}

            {step === 2 && (
              <Stack gap="sm">
                <Heading level={3}>Personal Profile</Heading>
                <FormInput name="fullName" label="Full Name" />
                <FormInput name="bio" label="Short Bio (Optional)" />
              </Stack>
            )}

            {step === 3 && (
              <Stack gap="sm">
                <Heading level={3}>Review Details</Heading>
                <Text>Email: {methods.getValues("email")}</Text>
                <Text>Username: {methods.getValues("username")}</Text>
                <Text>Full Name: {methods.getValues("fullName")}</Text>
                {methods.getValues("bio") ? (
                  <Text>Bio: {methods.getValues("bio")}</Text>
                ) : null}
              </Stack>
            )}
          </Stack>
        </CardContent>

        <CardFooter className="flex justify-between">
          {step > 1 ? (
            <Button type="button" variant="outline" onClick={prevStep}>
              Back
            </Button>
          ) : null}

          {step < 3 ? (
            <Button type="button" onClick={nextStep}>
              Next Step
            </Button>
          ) : (
            <FormButton>Submit Registration</FormButton>
          )}
        </CardFooter>
      </AppForm>
    </Card>
  );
}
