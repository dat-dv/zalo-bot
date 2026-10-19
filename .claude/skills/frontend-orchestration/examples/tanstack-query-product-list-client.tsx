"use client";

import { useQuery } from "@tanstack/react-query";
import { Spinner } from "@/components/atoms/spinner";
import { API_ROUTES } from "@/shared/constants/api-routes";
import { ProductList } from "./product-list";
import { productListOptions } from "./product-query-options";

async function loadProductsInBrowser(): Promise<unknown> {
  const response = await fetch(API_ROUTES.PRODUCTS.LIST);
  if (!response.ok) throw new Error("Products could not be loaded");
  return response.json();
}

export function ProductListClient() {
  const { data: products = [], isPending } = useQuery(
    productListOptions(loadProductsInBrowser),
  );

  if (isPending) return <Spinner aria-label="Loading products" />;

  return <ProductList products={products} />;
}
