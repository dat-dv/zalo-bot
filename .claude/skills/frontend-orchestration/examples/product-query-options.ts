import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

const productSchema = z.object({ id: z.string(), name: z.string() });
const productListSchema = z.array(productSchema);

export type Product = z.infer<typeof productSchema>;
export type ProductLoader = () => Promise<unknown>;

export const productKeys = {
  all: ["products"] as const,
  list: () => [...productKeys.all, "list"] as const,
};

export function productListOptions(load: ProductLoader) {
  return queryOptions({
    queryKey: productKeys.list(),
    queryFn: async () => productListSchema.parse(await load()),
  });
}
