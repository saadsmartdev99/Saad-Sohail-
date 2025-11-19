import { describe, it, expect, beforeEach } from 'vitest';
import { ChatUsageService } from '../../src/modules/chat/domain/services/ChatUsageService';
import type {
  MonthlyUsage,
  SubscriptionBundle,
  SubscriptionRepository,
  UsageRepository,
} from '../../src/modules/subscriptions/domain/repositories/UsageAndSubscriptionRepositories';
import { DomainError } from '../../src/core/DomainError';

class InMemoryUsageRepository implements UsageRepository {
  private data = new Map<string, MonthlyUsage>();

  async getMonthlyUsage(params: { userId: string; year: number; month: number }): Promise<MonthlyUsage | null> {
    const key = `${params.userId}:${params.year}-${params.month}`;
    return this.data.get(key) ?? null;
  }

  async createMonthlyUsage(input: {
    userId: string;
    year: number;
    month: number;
    maxMessages: number | null;
  }): Promise<MonthlyUsage> {
    const key = `${input.userId}:${input.year}-${input.month}`;
    const record: MonthlyUsage = {
      id: key,
      userId: input.userId,
      year: input.year,
      month: input.month,
      usedMessages: 0,
      maxMessages: input.maxMessages,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.data.set(key, record);
    return record;
  }

  async updateUsage(params: { id: string; usedMessages: number }): Promise<MonthlyUsage> {
    const record = [...this.data.values()].find((u) => u.id === params.id);
    if (!record) throw new Error('Usage not found');
    const updated: MonthlyUsage = { ...record, usedMessages: params.usedMessages, updatedAt: new Date() };
    this.data.set(`${updated.userId}:${updated.year}-${updated.month}`, updated);
    return updated;
  }
}

class InMemorySubscriptionRepository implements SubscriptionRepository {
  public subs: SubscriptionBundle[] = [];

  async createSubscription(): Promise<SubscriptionBundle> {
    throw new Error('Not used in tests');
  }

  async findActiveSubscriptions(userId: string): Promise<SubscriptionBundle[]> {
    return this.subs.filter((s) => s.userId === userId);
  }

  async saveSubscription(sub: SubscriptionBundle): Promise<SubscriptionBundle> {
    const index = this.subs.findIndex((s) => s.id === sub.id);
    if (index >= 0) this.subs[index] = sub;
    return sub;
  }

  async findDueForBilling(): Promise<SubscriptionBundle[]> {
    return [];
  }
}

describe('ChatUsageService', () => {
  let usageRepo: InMemoryUsageRepository;
  let subRepo: InMemorySubscriptionRepository;
  let service: ChatUsageService;

  beforeEach(() => {
    usageRepo = new InMemoryUsageRepository();
    subRepo = new InMemorySubscriptionRepository();
    service = new ChatUsageService(usageRepo, subRepo);
  });

  it('allows free usage under quota and resets on month change', async () => {
    const userId = 'user1';
    const now = new Date('2025-01-15T00:00:00Z');

    // First 3 messages in January are free
    for (let i = 0; i < 3; i++) {
      const result = await service.consumeMessage({ userId, now });
      expect(result.descriptor.type).toBe('free');
    }

    // 4th message in January without subscriptions should fail
    await expect(service.consumeMessage({ userId, now })).rejects.toBeInstanceOf(DomainError);

    // New month: free quota resets
    const feb = new Date('2025-02-01T00:00:00Z');
    const febResult = await service.consumeMessage({ userId, now: feb });
    expect(febResult.descriptor.type).toBe('free');
  });

  it('selects bundle with highest remaining messages', async () => {
    const userId = 'user2';
    const now = new Date('2025-01-15T00:00:00Z');

    // Exhaust free quota
    for (let i = 0; i < 3; i++) {
      await service.consumeMessage({ userId, now });
    }

    subRepo.subs = [
      {
        id: 'bundle-small',
        userId,
        tier: 'BASIC',
        billingCycle: 'MONTHLY',
        paymentStatus: 'ACTIVE',
        maxMessages: 10,
        currentPeriodStart: now,
        currentPeriodEnd: now,
        createdAt: now,
        updatedAt: now,
        canceledAt: null,
      },
      {
        id: 'bundle-large',
        userId,
        tier: 'PRO',
        billingCycle: 'MONTHLY',
        paymentStatus: 'ACTIVE',
        maxMessages: 100,
        currentPeriodStart: now,
        currentPeriodEnd: now,
        createdAt: now,
        updatedAt: now,
        canceledAt: null,
      },
    ];

    const result = await service.consumeMessage({ userId, now });
    expect(result.descriptor.type).toBe('bundle');
    expect(result.descriptor.bundleId).toBe('bundle-large');
  });

  it('uses enterprise bundle without incrementing usage', async () => {
    const userId = 'user3';
    const now = new Date('2025-01-15T00:00:00Z');

    // Exhaust free quota
    for (let i = 0; i < 3; i++) {
      await service.consumeMessage({ userId, now });
    }

    subRepo.subs = [
      {
        id: 'enterprise-1',
        userId,
        tier: 'ENTERPRISE',
        billingCycle: 'MONTHLY',
        paymentStatus: 'ACTIVE',
        maxMessages: null,
        currentPeriodStart: now,
        currentPeriodEnd: now,
        createdAt: now,
        updatedAt: now,
        canceledAt: null,
      },
    ];

    const before = await usageRepo.getMonthlyUsage({ userId, year: 2025, month: 1 });
    expect(before?.usedMessages).toBe(3);

    const result = await service.consumeMessage({ userId, now });
    expect(result.descriptor.type).toBe('enterprise');

    const after = await usageRepo.getMonthlyUsage({ userId, year: 2025, month: 1 });
    expect(after?.usedMessages).toBe(3); // not incremented
  });

  it('throws QUOTA_EXCEEDED when no free or bundle quota left', async () => {
    const userId = 'user4';
    const now = new Date('2025-01-15T00:00:00Z');

    // Exhaust free quota
    for (let i = 0; i < 3; i++) {
      await service.consumeMessage({ userId, now });
    }

    // No subscriptions
    await expect(service.consumeMessage({ userId, now })).rejects.toMatchObject({
      code: 'QUOTA_EXCEEDED',
    });
  });
});
