---
trigger: model_decision
description: "Form handling and direct API mutations in Static SPA mode (React Hook Form + Zod + TanStack useMutation + directHttpClient, with explicit prohibition of Server Actions)."
metadata:
  agent-artifact:
    id: nextjs-static-rule-05
    type: rule
    explanation: .agents/system-explain/plugins/nextjs-static/rules/05-forms-and-tanstack-mutations.md
    depends_on:
      - .claude/skills/nextjs-static/rules/01-static-export-and-build-constraints.md
      - .claude/skills/nextjs-static/rules/02-direct-client-api-and-auth.md
---

# Static SPA Form Handling & Direct TanStack Mutations Rules

In Next.js Static Export applications, all form submissions and data mutations execute exclusively in the browser:

## 1. Mandatory Pattern: React Hook Form + TanStack `useMutation` + `directHttpClient`

- **Workflow**:
  1. Manage form state using `react-hook-form` and validation schema with `zodResolver`.
  2. Perform data mutation via TanStack Query `useMutation`.
  3. The mutation function delegates to the feature repository calling `directHttpClient.post('/api/v1/...')` (or PUT/PATCH/DELETE).
  4. The `directHttpClient` Axios interceptor automatically attaches `Authorization: Bearer <token>` from `localStorage`.
  5. `onSuccess`: Invalidate query cache (`queryClient.invalidateQueries({ queryKey: [...] })`) and show success toast.
  6. `onError`: Map backend 400/422 validation error messages to form fields via `form.setError()`.

```typescript
// 1. Atomic Mutation Hook: src/modules/products/application/hooks/use-create-product-mutation.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { productRepository } from '../../infrastructure/repositories/product-repository';
import type { CreateProductFormValues } from '../product-schemas';
import { productQueryKeys } from '../../presentation/queries/query-keys';

export function useCreateProductMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: CreateProductFormValues) => productRepository.createProduct(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productQueryKeys.lists() });
    },
  });
}

// 2. Presentation View: src/modules/products/presentation/views/create-product-view.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createProductSchema, type CreateProductFormValues } from '../../application/product-schemas';
import { useCreateProductMutation } from '../../application/hooks/use-create-product-mutation';
import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';

export function CreateProductView() {
  const form = useForm<CreateProductFormValues>({
    resolver: zodResolver(createProductSchema),
    defaultValues: { name: '', price: 0 },
  });

  const mutation = useCreateProductMutation();

  const onSubmit = (data: CreateProductFormValues) => {
    mutation.mutate(data, {
      onSuccess: () => {
        form.reset();
      },
      onError: (error: any) => {
        const msg = error.response?.data?.message || 'Failed to create product';
        form.setError('root', { message: msg });
      },
    });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-md">
      <Input {...form.register('name')} placeholder="Product name" />
      <Input {...form.register('price', { valueAsNumber: true })} type="number" placeholder="Price" />
      {form.formState.errors.root && (
        <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
      )}
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? 'Submitting...' : 'Create Product'}
      </Button>
    </form>
  );
}
```

## 2. STRICT PROHIBITION: No Server Actions in Static SPA

- **PROHIBITED**: Declaring `'use server'` directives, Server Actions, or importing server-only mutation functions (`revalidatePath`, `revalidateTag`, `cookies`, `headers`).
- **Rationale**: Next.js Static Export produces plain static HTML/JS/CSS files without a Node.js runtime to execute Server Actions. Any attempt to use `'use server'` will fail at build time (`next build`).
