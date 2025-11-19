import { prisma } from '../../../../core/database/prismaClient';
import {
  BillingCycle,
  MonthlyUsage,
  PaymentStatus,
  SubscriptionBundle,
  SubscriptionRepository,
  Tier,
  UsageRepository,
} from '../../domain/repositories/UsageAndSubscriptionRepositories';

import type {
  MonthlyUsage as PrismaMonthlyUsage,
  SubscriptionBundle as PrismaSubscriptionBundle,
} from '@prisma/client';

function mapMonthlyUsage(model: PrismaMonthlyUsage): MonthlyUsage {
  return {
    id: model.id,
    userId: model.userId,
    year: model.year,
    month: model.month,
    usedMessages: model.usedMessages,
    maxMessages: model.maxMessages,
    createdAt: model.createdAt,
    updatedAt: model.updatedAt,
  };
}

function mapSubscriptionBundle(model: PrismaSubscriptionBundle): SubscriptionBundle {
  return {
    id: model.id,
    userId: model.userId,
    tier: model.tier as Tier,
    billingCycle: model.billingCycle as BillingCycle,
    paymentStatus: model.paymentStatus as PaymentStatus,
    maxMessages: model.maxMessages,
    currentPeriodStart: model.currentPeriodStart,
    currentPeriodEnd: model.currentPeriodEnd,
    createdAt: model.createdAt,
    updatedAt: model.updatedAt,
    canceledAt: model.canceledAt,
  };
}

export class PrismaUsageRepository implements UsageRepository {
  async getMonthlyUsage(params: {
    userId: string;
    year: number;
    month: number;
  }): Promise<MonthlyUsage | null> {
    const record = await prisma.monthlyUsage.findUnique({
      where: {
        userId_year_month: {
          userId: params.userId,
          year: params.year,
          month: params.month,
        },
      },
    });

    return record ? mapMonthlyUsage(record) : null;
  }

  async createMonthlyUsage(input: {
    userId: string;
    year: number;
    month: number;
    maxMessages: number | null;
  }): Promise<MonthlyUsage> {
    const created = await prisma.monthlyUsage.create({
      data: {
        userId: input.userId,
        year: input.year,
        month: input.month,
        maxMessages: input.maxMessages,
      },
    });

    return mapMonthlyUsage(created);
  }

  async updateUsage(params: { id: string; usedMessages: number }): Promise<MonthlyUsage> {
    const updated = await prisma.monthlyUsage.update({
      where: { id: params.id },
      data: {
        usedMessages: params.usedMessages,
      },
    });

    return mapMonthlyUsage(updated);
  }
}

export class PrismaSubscriptionRepository implements SubscriptionRepository {
  async createSubscription(input: {
    userId: string;
    tier: Tier;
    billingCycle: BillingCycle;
    maxMessages: number | null;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
  }): Promise<SubscriptionBundle> {
    const created = await prisma.subscriptionBundle.create({
      data: {
        userId: input.userId,
        tier: input.tier,
        billingCycle: input.billingCycle,
        maxMessages: input.maxMessages,
        currentPeriodStart: input.currentPeriodStart,
        currentPeriodEnd: input.currentPeriodEnd,
        paymentStatus: 'ACTIVE', // New subscriptions start as ACTIVE
      },
    });

    return mapSubscriptionBundle(created);
  }

  async findActiveSubscriptions(userId: string): Promise<SubscriptionBundle[]> {
    const now = new Date();

    const subs = await prisma.subscriptionBundle.findMany({
      where: {
        userId,
        paymentStatus: 'ACTIVE',
        currentPeriodStart: { lte: now },
        currentPeriodEnd: { gt: now },
        canceledAt: null,
      },
    });

    return subs.map(mapSubscriptionBundle);
  }

  async saveSubscription(subscription: SubscriptionBundle): Promise<SubscriptionBundle> {
    const updated = await prisma.subscriptionBundle.update({
      where: { id: subscription.id },
      data: {
        tier: subscription.tier,
        billingCycle: subscription.billingCycle,
        paymentStatus: subscription.paymentStatus,
        maxMessages: subscription.maxMessages,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        canceledAt: subscription.canceledAt,
      },
    });

    return mapSubscriptionBundle(updated);
  }

  async findDueForBilling(params: { now: Date }): Promise<SubscriptionBundle[]> {
    const subs = await prisma.subscriptionBundle.findMany({
      where: {
        paymentStatus: 'ACTIVE',
        currentPeriodEnd: { lte: params.now },
        canceledAt: null,
      },
    });

    return subs.map(mapSubscriptionBundle);
  }
}
