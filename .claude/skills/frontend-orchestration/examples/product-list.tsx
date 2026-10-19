"use client";

import { List, ListItem } from "@/components/atoms/list";
import { Text } from "@/components/atoms/text";
import type { Product } from "./product-query-options";

export function ProductList({ products }: { products: Product[] }) {
  return (
    <List>
      {products.map((product) => (
        <ListItem key={product.id}>
          <Text>{product.name}</Text>
        </ListItem>
      ))}
    </List>
  );
}
