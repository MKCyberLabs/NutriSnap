import { prisma } from '@/lib/prisma';
import { Prisma } from '../../../prisma/generated/client';
const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;
import { z } from 'zod';

export const WISHLIST_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type WishlistPriority = (typeof WISHLIST_PRIORITIES)[number];

export const WISHLIST_STATUSES = [
  'WISHLIST',
  'PLANNED',
  'READY',
  'PURCHASED',
  'ARCHIVED',
] as const;
export type WishlistStatus = (typeof WISHLIST_STATUSES)[number];

export const createWishlistItemSchema = z.object({
  name: z.string().trim().min(1, 'Item name is required').max(100),
  category: z.string().trim().min(1, 'Category is required').max(50),
  targetPrice: z.union([z.number(), z.string(), z.instanceof(Decimal)]),
  maxBudget: z.union([z.number(), z.string(), z.instanceof(Decimal)]).optional().nullable(),
  priority: z.enum(WISHLIST_PRIORITIES).default('MEDIUM'),
  targetDate: z.string().or(z.date()).optional().nullable(),
  plannedAccountId: z.string().optional().nullable(),
  notes: z.string().trim().max(255).optional().nullable(),
  status: z.enum(['WISHLIST', 'PLANNED', 'READY']).default('WISHLIST'),
});

export const updateWishlistItemSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  category: z.string().trim().min(1).max(50).optional(),
  targetPrice: z.union([z.number(), z.string(), z.instanceof(Decimal)]).optional(),
  maxBudget: z.union([z.number(), z.string(), z.instanceof(Decimal)]).optional().nullable(),
  priority: z.enum(WISHLIST_PRIORITIES).optional(),
  targetDate: z.string().or(z.date()).optional().nullable(),
  plannedAccountId: z.string().optional().nullable(),
  notes: z.string().trim().max(255).optional().nullable(),
  status: z.enum(WISHLIST_STATUSES).optional(),
});

export const markPurchasedSchema = z.object({
  actualPrice: z.union([z.number(), z.string(), z.instanceof(Decimal)]),
  accountId: z.string().optional().nullable(),
  purchasedAt: z.string().or(z.date()).optional(),
  createExpense: z.boolean().default(true),
  note: z.string().trim().max(255).optional().nullable(),
});

export class WishlistService {
  /**
   * Creates a new wishlist item without altering account balances or monthly totals.
   */
  async createWishlistItem(userId: string, input: unknown, db = prisma) {
    const data = createWishlistItemSchema.parse(input);

    const targetPrice = new Decimal(data.targetPrice.toString());
    if (targetPrice.lte(0)) {
      throw new Error('Target price must be greater than zero.');
    }

    let maxBudget: Decimal | null = null;
    if (data.maxBudget !== undefined && data.maxBudget !== null && data.maxBudget !== '') {
      maxBudget = new Decimal(data.maxBudget.toString());
      if (maxBudget.lte(0)) {
        throw new Error('Max budget must be greater than zero.');
      }
    }

    if (data.plannedAccountId) {
      const account = await db.financialAccount.findUnique({
        where: { id: data.plannedAccountId },
        select: { userId: true },
      });
      if (!account || account.userId !== userId) {
        throw new Error('Planned account not found or access denied.');
      }
    }

    let parsedTargetDate: Date | null = null;
    if (data.targetDate) {
      parsedTargetDate = typeof data.targetDate === 'string' ? new Date(data.targetDate) : data.targetDate;
    }

    return await db.wishlistItem.create({
      data: {
        userId,
        name: data.name,
        category: data.category,
        targetPrice,
        maxBudget,
        priority: data.priority,
        targetDate: parsedTargetDate,
        plannedAccountId: data.plannedAccountId || null,
        notes: data.notes || null,
        status: data.status,
      },
      include: {
        plannedAccount: true,
      },
    });
  }

  /**
   * Retrieves wishlist items for a user.
   */
  async getWishlistItems(
    userId: string,
    options: { status?: string; priority?: string } = {},
    db = prisma
  ) {
    const where: Prisma.WishlistItemWhereInput = {
      userId,
    };

    if (options.status) {
      where.status = options.status;
    } else {
      where.status = { not: 'ARCHIVED' };
    }

    if (options.priority) {
      where.priority = options.priority;
    }

    const items = await db.wishlistItem.findMany({
      where,
      orderBy: [
        { targetDate: 'asc' },
        { createdAt: 'desc' },
      ],
      include: {
        plannedAccount: true,
        transaction: true,
      },
    });

    const priorityWeight: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    items.sort((a, b) => (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0));
    return items;
  }

  /**
   * Retrieves a single wishlist item with ownership verification.
   */
  async getWishlistItemById(userId: string, itemId: string, db = prisma) {
    const item = await db.wishlistItem.findUnique({
      where: { id: itemId },
      include: {
        plannedAccount: true,
        transaction: true,
      },
    });

    if (!item || item.userId !== userId) {
      throw new Error('Wishlist item not found or access denied.');
    }

    return item;
  }

  /**
   * Updates wishlist item metadata before purchase.
   */
  async updateWishlistItem(userId: string, itemId: string, input: unknown, db = prisma) {
    const item = await this.getWishlistItemById(userId, itemId, db);

    if (item.status === 'PURCHASED') {
      throw new Error('Cannot update planning details of an already purchased item. Unmark as purchased first.');
    }

    const data = updateWishlistItemSchema.parse(input);
    const updateData: Prisma.WishlistItemUpdateInput = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.status !== undefined) updateData.status = data.status;

    if (data.targetPrice !== undefined) {
      const targetPrice = new Decimal(data.targetPrice.toString());
      if (targetPrice.lte(0)) throw new Error('Target price must be greater than zero.');
      updateData.targetPrice = targetPrice;
    }

    if (data.maxBudget !== undefined) {
      if (data.maxBudget === null || data.maxBudget === '') {
        updateData.maxBudget = null;
      } else {
        const mb = new Decimal(data.maxBudget.toString());
        if (mb.lte(0)) throw new Error('Max budget must be greater than zero.');
        updateData.maxBudget = mb;
      }
    }

    if (data.targetDate !== undefined) {
      updateData.targetDate = data.targetDate
        ? typeof data.targetDate === 'string'
          ? new Date(data.targetDate)
          : data.targetDate
        : null;
    }

    if (data.plannedAccountId !== undefined) {
      if (data.plannedAccountId) {
        const acc = await db.financialAccount.findUnique({
          where: { id: data.plannedAccountId },
          select: { userId: true },
        });
        if (!acc || acc.userId !== userId) {
          throw new Error('Planned account not found or access denied.');
        }
        updateData.plannedAccount = { connect: { id: data.plannedAccountId } };
      } else {
        updateData.plannedAccount = { disconnect: true };
      }
    }

    return await db.wishlistItem.update({
      where: { id: itemId },
      data: updateData,
      include: {
        plannedAccount: true,
        transaction: true,
      },
    });
  }

  /**
   * Marks a wishlist item as purchased.
   * If createExpense is true, creates exactly one linked FinancialTransaction atomically.
   * Re-running when already purchased is idempotent and does not create duplicate expenses.
   */
  async markPurchased(userId: string, itemId: string, input: unknown, db = prisma) {
    const item = await this.getWishlistItemById(userId, itemId, db);

    // Idempotency: already purchased
    if (item.status === 'PURCHASED') {
      return {
        item,
        alreadyPurchased: true,
        transactionId: item.transactionId,
      };
    }

    const data = markPurchasedSchema.parse(input);
    const actualPrice = new Decimal(data.actualPrice.toString());
    if (actualPrice.lte(0)) {
      throw new Error('Actual purchase price must be greater than zero.');
    }

    const purchasedAt = data.purchasedAt
      ? typeof data.purchasedAt === 'string'
        ? new Date(data.purchasedAt)
        : data.purchasedAt
      : new Date();

    const targetAccountId = data.accountId || item.plannedAccountId;

    if (data.createExpense && !targetAccountId) {
      throw new Error('An account is required to record the purchase expense.');
    }

    if (data.createExpense && targetAccountId) {
      const acc = await db.financialAccount.findUnique({
        where: { id: targetAccountId },
        select: { userId: true },
      });
      if (!acc || acc.userId !== userId) {
        throw new Error('Payment account not found or access denied.');
      }
    }

    const executeInTransaction = async (tx: Prisma.TransactionClient) => {
      let createdTxId: string | null = null;

      if (data.createExpense && targetAccountId) {
        const expenseTx = await tx.financialTransaction.create({
          data: {
            userId,
            type: 'EXPENSE',
            amount: actualPrice,
            category: item.category || 'Shopping',
            occurredAt: purchasedAt,
            accountId: targetAccountId,
            note: data.note || `Wishlist purchase: ${item.name}`,
          },
        });
        createdTxId = expenseTx.id;
      }

      const updatedItem = await tx.wishlistItem.update({
        where: { id: itemId },
        data: {
          status: 'PURCHASED',
          actualPrice,
          purchasedAt,
          transactionId: createdTxId,
        },
        include: {
          plannedAccount: true,
          transaction: true,
        },
      });

      return {
        item: updatedItem,
        alreadyPurchased: false,
        transactionId: createdTxId,
      };
    };

    if ('$transaction' in db && typeof (db as any).$transaction === 'function') {
      return await (db as any).$transaction(executeInTransaction);
    }
    return await executeInTransaction(db as Prisma.TransactionClient);
  }

  /**
   * Reverts purchase ("Unmark as Purchased" atomic flow).
   * Atomically deletes the linked transaction, restores account balances,
   * and resets the item status to targetStatus (default 'READY').
   */
  async unmarkPurchased(
    userId: string,
    itemId: string,
    targetStatus: 'READY' | 'PLANNED' | 'WISHLIST' = 'READY',
    db = prisma
  ) {
    const item = await this.getWishlistItemById(userId, itemId, db);

    if (item.status !== 'PURCHASED') {
      throw new Error('Item is not marked as purchased.');
    }

    const executeInTransaction = async (tx: Prisma.TransactionClient) => {
      const linkedTxId = item.transactionId;

      // 1. Decouple transaction and reset item status
      const updatedItem = await tx.wishlistItem.update({
        where: { id: itemId },
        data: {
          status: targetStatus,
          actualPrice: null,
          purchasedAt: null,
          transactionId: null,
        },
        include: {
          plannedAccount: true,
        },
      });

      // 2. Atomically delete linked transaction if it existed
      if (linkedTxId) {
        await tx.financialTransaction.delete({
          where: { id: linkedTxId },
        });
      }

      return updatedItem;
    };

    if ('$transaction' in db && typeof (db as any).$transaction === 'function') {
      return await (db as any).$transaction(executeInTransaction);
    }
    return await executeInTransaction(db as Prisma.TransactionClient);
  }

  /**
   * Archives a wishlist item (soft delete).
   */
  async archiveWishlistItem(userId: string, itemId: string, db = prisma) {
    await this.getWishlistItemById(userId, itemId, db);
    return await db.wishlistItem.update({
      where: { id: itemId },
      data: { status: 'ARCHIVED' },
    });
  }

  /**
   * Deletes a wishlist item.
   * If purchased with linked transaction, requires unmarkPurchased first.
   */
  async deleteWishlistItem(userId: string, itemId: string, db = prisma) {
    const item = await this.getWishlistItemById(userId, itemId, db);

    if (item.transactionId) {
      throw new Error(
        'Item has a linked purchase expense transaction. Please unmark as purchased first to safely revert or clean up.'
      );
    }

    return await db.wishlistItem.delete({
      where: { id: itemId },
    });
  }
}

export const wishlistService = new WishlistService();
