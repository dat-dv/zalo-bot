"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";

import { Button } from "@/components/atoms/button";
import { List, ListItem } from "@/components/atoms/list";
import { Stack } from "@/components/atoms/stack";

import { API_ROUTES } from "@/shared/constants/api-routes";

const productPageSchema = z.object({
  items: z.array(z.object({ id: z.string(), name: z.string() })),
  nextCursor: z.string().nullable(),
});

async function loadProductPage(cursor: string | null) {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  const response = await fetch(`${API_ROUTES.PRODUCTS.LIST}?${params}`);
  if (!response.ok) throw new Error("Products could not be loaded");
  return productPageSchema.parse(await response.json());
}

export function InfiniteProducts() {
  const products = useInfiniteQuery({
    queryKey: ["products", "infinite"],
    queryFn: ({ pageParam }) => loadProductPage(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });

  return (
    <Stack gap="md">
      <List>
        {products.data?.pages.flatMap((page) =>
          page.items.map((product) => (
            <ListItem key={product.id}>{product.name}</ListItem>
          )),
        )}
      </List>
      <Button
        variant="outline"
        disabled={!products.hasNextPage || products.isFetchingNextPage}
        onClick={() => products.fetchNextPage()}
      >
        {products.isFetchingNextPage ? "Loading…" : "Load more"}
      </Button>
    </Stack>
  );
}
