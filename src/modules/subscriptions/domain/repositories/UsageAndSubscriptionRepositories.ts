export type Tier = 'BASIC' | 'PRO' | 'ENTERPRISE';
export type BillingCycle = 'MONTHLY' | 'YEARLY';
export type PaymentStatus = 'PENDING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';

export interface MonthlyUsage {
  id: string;
  userId: string;
  year: number;
  month: number; // 1-12
  usedMessages: number;
  maxMessages: number | null; // null => unlimited
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionBundle {
  id: string;
  userId: string;
  tier: Tier;
  billingCycle: BillingCycle;
  paymentStatus: PaymentStatus;
  maxMessages: number | null; // null => unlimited
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  createdAt: Date;
  updatedAt: Date;
  canceledAt: Date | null;
}

export interface UsageRepository {
  getMonthlyUsage(params: {
    userId: string;
    year: number;
    month: number;
  }): Promise<MonthlyUsage | null>;
  createMonthlyUsage(input: {
    userId: string;
    year: number;
    month: number;
    maxMessages: number | null;
  }): Promise<MonthlyUsage>;
  updateUsage(params: { id: string; usedMessages: number }): Promise<MonthlyUsage>;
}

export interface SubscriptionRepository {
  createSubscription(input: {
    userId: string;
    tier: Tier;
    billingCycle: BillingCycle;
    maxMessages: number | null;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
  }): Promise<SubscriptionBundle>;

  findActiveSubscriptions(userId: string): Promise<SubscriptionBundle[]>;

  saveSubscription(subscription: SubscriptionBundle): Promise<SubscriptionBundle>;

  findDueForBilling(params: { now: Date }): Promise<SubscriptionBundle[]>;
}
