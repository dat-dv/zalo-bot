"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Input } from "@/components/atoms/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/atoms/select";
import { Stack } from "@/components/atoms/stack";
import { Text } from "@/components/atoms/text";

export function DebouncedUrlSearchFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentQuery = searchParams.get("query") ?? "";
  const currentCategory = searchParams.get("category") ?? "all";

  const [searchTerm, setSearchTerm] = useState(currentQuery);

  // Debounce search input changes by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm !== currentQuery) {
        updateQueryParams(searchTerm, currentCategory);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, currentQuery, currentCategory]);

  function updateQueryParams(query: string, category: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (query.trim()) {
      params.set("query", query.trim());
    } else {
      params.delete("query");
    }

    if (category && category !== "all") {
      params.set("category", category);
    } else {
      params.delete("category");
    }

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  function handleCategoryChange(value: string) {
    updateQueryParams(searchTerm, value);
  }

  return (
    <Stack gap="md" className="w-full max-w-md">
      <Input
        placeholder="Search products..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        aria-label="Search items"
      />

      <Select value={currentCategory} onValueChange={handleCategoryChange}>
        <SelectTrigger aria-label="Select Category">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          <SelectItem value="electronics">Electronics</SelectItem>
          <SelectItem value="clothing">Clothing</SelectItem>
          <SelectItem value="books">Books</SelectItem>
        </SelectContent>
      </Select>

      {isPending ? (
        <Text className="text-xs text-muted-foreground">Updating URL parameters...</Text>
      ) : (
        <Text className="text-xs text-muted-foreground">
          Query: &quot;{currentQuery || "none"}&quot; | Category: &quot;{currentCategory}&quot;
        </Text>
      )}
    </Stack>
  );
}
