"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/atoms/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/atoms/select";
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
import { Text } from "@/components/atoms/text";

interface Order {
  id: string;
  customerName: string;
  totalAmount: number;
  status: string;
}

interface PaginatedOrdersResponse {
  items: Order[];
  page: number;
  pageSize: number;
  totalPages: number;
  totalCount: number;
}

import { API_ROUTES } from "@/shared/constants/api-routes";

async function fetchOrders(
  page: number,
  pageSize: number,
): Promise<PaginatedOrdersResponse> {
  const response = await fetch(
    `${API_ROUTES.ORDERS.LIST}?page=${page}&pageSize=${pageSize}`,
  );
  if (!response.ok) throw new Error("Failed to fetch orders");
  return response.json();
}

export function DataTableServerPagination() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data, isPending } = useQuery({
    queryKey: ["orders", "paginated", page, pageSize],
    queryFn: () => fetchOrders(page, pageSize),
  });

  const orders = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  if (isPending) return <Spinner aria-label="Loading orders" />;

  return (
    <Stack gap="md" className="w-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order ID</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id}>
              <TableCell>{order.id}</TableCell>
              <TableCell>{order.customerName}</TableCell>
              <TableCell>${order.totalAmount}</TableCell>
              <TableCell>{order.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Stack align="center" justify="between" className="flex-row">
        <Text className="text-sm text-muted-foreground">
          Page {page} of {totalPages} ({data?.totalCount ?? 0} total items)
        </Text>

        <Stack align="center" gap="sm" className="flex-row">
          <Select
            value={String(pageSize)}
            onValueChange={(val) => {
              setPageSize(Number(val));
              setPage(1);
            }}
          >
            <SelectTrigger aria-label="Page size selector" className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5 / page</SelectItem>
              <SelectItem value="10">10 / page</SelectItem>
              <SelectItem value="25">25 / page</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </Button>
        </Stack>
      </Stack>
    </Stack>
  );
}
