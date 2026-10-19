"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";

const archiveProductInput = z.object({ id: z.string().min(1) });

export async function archiveProductAction(input: unknown) {
  const command = archiveProductInput.parse(input);
  const response = await fetch(
    `${process.env.API_URL}/products/${encodeURIComponent(command.id)}`,
    { method: "DELETE" },
  );
  if (!response.ok) throw new Error("Product could not be archived");
  revalidateTag("products", "max");
}
