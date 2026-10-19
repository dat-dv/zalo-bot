"use client";

import type { ReactNode } from "react";
import { createStore } from "zustand/vanilla";
import { createScopedStoreContext } from "@/lib/zustand";

interface CatalogState {
  selectedProductId: string | null;
  selectProduct: (id: string | null) => void;
}

const { ScopedStoreProvider, useScopedStore } =
  createScopedStoreContext<CatalogState>();

export function CatalogStoreProvider({
  initialProductId = null,
  children,
}: {
  initialProductId?: string | null;
  children: ReactNode;
}) {
  return (
    <ScopedStoreProvider
      createStore={() =>
        createStore<CatalogState>()((set) => ({
          selectedProductId: initialProductId,
          selectProduct: (selectedProductId) => set({ selectedProductId }),
        }))
      }
    >
      {children}
    </ScopedStoreProvider>
  );
}

export const useSelectedProductId = () =>
  useScopedStore((state) => state.selectedProductId);

export const useSelectProduct = () =>
  useScopedStore((state) => state.selectProduct);
