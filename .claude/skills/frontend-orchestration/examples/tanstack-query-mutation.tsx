"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/atoms/button";
import { API_ROUTES } from "@/shared/constants/api-routes";

import { type Product, productKeys } from "./product-query-options";

async function archiveProduct(productId: string): Promise<void> {
  const response = await fetch(
    `${API_ROUTES.PRODUCTS.LIST}/${encodeURIComponent(productId)}`,
    { method: "DELETE" },
  );
  if (!response.ok) throw new Error("Product could not be archived");
}

export function ArchiveProductButton({ productId }: { productId: string }) {
  const queryClient = useQueryClient();
  const archive = useMutation({
    mutationFn: () => archiveProduct(productId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: productKeys.list() });
      const previous = queryClient.getQueryData<Product[]>(productKeys.list());
      queryClient.setQueryData<Product[]>(productKeys.list(), (current = []) =>
        current.filter((product) => product.id !== productId),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(productKeys.list(), context.previous);
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: productKeys.all }),
  });

  return (
    <Button
      variant="destructive"
      disabled={archive.isPending}
      onClick={() => archive.mutate()}
    >
      {archive.isPending ? "Archiving…" : "Archive"}
    </Button>
  );
}
