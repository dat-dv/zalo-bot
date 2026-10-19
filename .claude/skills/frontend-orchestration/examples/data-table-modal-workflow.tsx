"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/atoms/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/atoms/dialog";
import { Spinner } from "@/components/atoms/spinner";
import { Stack } from "@/components/atoms/stack";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/atoms/table";
import { AppForm, FormButton, FormInput } from "@/components/molecules/form";

import {
  type Product,
  productKeys,
  productListOptions,
} from "./product-query-options";

import { API_ROUTES } from "@/shared/constants/api-routes";

const updateProductSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(3, "Name must be at least 3 characters"),
});

type UpdateProductCommand = z.infer<typeof updateProductSchema>;

async function loadProducts(): Promise<unknown> {
  const response = await fetch(API_ROUTES.PRODUCTS.LIST);
  if (!response.ok) throw new Error("Products could not be loaded");
  return response.json();
}

async function updateProduct(command: UpdateProductCommand): Promise<void> {
  const response = await fetch(
    `${API_ROUTES.PRODUCTS.LIST}/${encodeURIComponent(command.id)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(command),
    },
  );
  if (!response.ok) throw new Error("Product could not be updated");
}

export function ProductTableWorkflow() {
  const queryClient = useQueryClient();
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const { data: products = [], isPending } = useQuery(
    productListOptions(loadProducts),
  );
  const methods = useForm<UpdateProductCommand>({
    resolver: zodResolver(updateProductSchema),
    defaultValues: { id: "", name: "" },
  });
  const update = useMutation({
    mutationFn: updateProduct,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
      setEditingProduct(null);
    },
  });

  useEffect(() => {
    if (editingProduct) methods.reset(editingProduct);
  }, [editingProduct, methods]);

  if (isPending) return <Spinner aria-label="Loading products" />;

  return (
    <Stack gap="md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product.id}>
              <TableCell>{product.name}</TableCell>
              <TableCell>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingProduct(product)}
                >
                  Edit {product.name}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog
        open={editingProduct !== null}
        onOpenChange={(open) => !open && setEditingProduct(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit product</DialogTitle>
            <DialogDescription>
              Update the selected product, then refresh the shared query cache.
            </DialogDescription>
          </DialogHeader>
          <AppForm
            methods={methods}
            onSubmit={(command) => update.mutateAsync(command)}
          >
            <Stack gap="md">
              <FormInput name="name" label="Name" />
              <FormButton disabled={update.isPending}>Save changes</FormButton>
            </Stack>
          </AppForm>
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
