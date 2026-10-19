import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/shared/services/prisma/prisma.service';

export interface ICreateOrderCommand {
  user_id: string;
  items: Array<{ product_id: string; sku_id?: string; quantity: number; price: number }>;
  total_amount: number;
}

@Injectable()
export class TransactionBoundaryService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrderWithInventoryDeduction(command: ICreateOrderCommand) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Create Order and Order Items
      const order = await tx.order.create({
        data: {
          user_id: command.user_id,
          total_amount: command.total_amount,
          status: 1, // PENDING
          items: {
            create: command.items.map((item) => ({
              product_id: item.product_id,
              sku_id: item.sku_id,
              quantity: item.quantity,
              price: item.price,
            })),
          },
        },
        include: { items: true },
      });

      // 2. Decrement stock for each SKU safely within transaction
      for (const item of command.items) {
        if (item.sku_id) {
          const sku = await tx.productSku.findUnique({ where: { id: item.sku_id } });
          if (!sku || sku.stock < item.quantity) {
            throw new Error(`Insufficient stock for SKU ${item.sku_id}`);
          }
          await tx.productSku.update({
            where: { id: item.sku_id },
            data: { stock: { decrement: item.quantity } },
          });
        }
      }

      // Convert Prisma Decimal to Number before returning
      return {
        ...order,
        total_amount: Number(order.total_amount),
        items: order.items.map((i) => ({
          ...i,
          price: Number(i.price),
        })),
      };
    });
  }
}
