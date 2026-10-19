import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { productListOptions } from "./product-query-options";
import { ProductListClient } from "./tanstack-query-product-list-client";

async function loadProductsOnServer(): Promise<unknown> {
  const response = await fetch(`${process.env.API_URL}/products`, {
    next: { revalidate: 60, tags: ["products"] },
  });
  if (!response.ok) throw new Error("Products could not be loaded");
  return response.json();
}

export default async function ProductsPage() {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(productListOptions(loadProductsOnServer));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProductListClient />
    </HydrationBoundary>
  );
}
