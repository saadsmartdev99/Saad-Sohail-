import { describe, it, expect } from 'vitest';
import { CreateSubscriptionUseCase } from '../../src/modules/subscriptions/application/use-cases/SubscriptionUseCases';
import { AskQuestionUseCase } from '../../src/modules/chat/application/use-cases/ChatUseCases';
import { ChatUsageService } from '../../src/modules/chat/domain/services/ChatUsageService';
import { AiResponseSimulator } from '../../src/modules/chat/domain/services/AiResponseSimulator';
import type {
  ChatMessageRepository,
  CreateChatMessageInput,
} from '../../src/modules/chat/domain/repositories/ChatMessageRepository';
import type {
  SubscriptionBundle,
  SubscriptionRepository,
  UsageRepository,
  MonthlyUsage,
} from '../../src/modules/subscriptions/domain/repositories/UsageAndSubscriptionRepositories';

class InMemoryChatMessageRepository implements ChatMessageRepository {
  public messages: CreateChatMessageInput[] = [];

  async createMessage(input: CreateChatMessageInput) {
    this.messages.push(input);
    return {
      id: String(this.messages.length),
      userId: input.userId,
      content: input.content,
      createdAt: input.createdAt ?? new Date(),
    };
  }

  async getMessagesForUserInMonth(): Promise<any[]> {
    return [];
  }
}

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

  async createSubscription(input: {
    userId: string;
    tier: any;
    billingCycle: any;
    maxMessages: number | null;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
  }): Promise<SubscriptionBundle> {
    const sub: SubscriptionBundle = {
      id: `sub-${this.subs.length + 1}`,
      userId: input.userId,
      tier: input.tier,
      billingCycle: input.billingCycle,
      paymentStatus: 'ACTIVE',
      maxMessages: input.maxMessages,
      currentPeriodStart: input.currentPeriodStart,
      currentPeriodEnd: input.currentPeriodEnd,
      createdAt: new Date(),
      updatedAt: new Date(),
      canceledAt: null,
    };
    this.subs.push(sub);
    return sub;
  }

  async findActiveSubscriptions(userId: string): Promise<SubscriptionBundle[]> {
    return this.subs.filter((s) => s.userId === userId && s.paymentStatus === 'ACTIVE');
  }

  async saveSubscription(sub: SubscriptionBundle): Promise<SubscriptionBundle> {
    const idx = this.subs.findIndex((s) => s.id === sub.id);
    if (idx >= 0) this.subs[idx] = sub;
    return sub;
  }

  async findDueForBilling(): Promise<SubscriptionBundle[]> {
    return [];
  }
}

describe('Integration: subscription + chat usage', () => {
  it('creates subscription then asks question consuming usage', async () => {
    const userId = 'user-int';
    const chatRepo = new InMemoryChatMessageRepository();
    const usageRepo = new InMemoryUsageRepository();
    const subRepo = new InMemorySubscriptionRepository();

    const createSub = new CreateSubscriptionUseCase(subRepo);
    const usageService = new ChatUsageService(usageRepo, subRepo);
    const aiSim = new AiResponseSimulator();
    const askQuestion = new AskQuestionUseCase(chatRepo, usageService, aiSim);

    const created = await createSub.execute({
      userId,
      tier: 'BASIC',
      billingCycle: 'MONTHLY',
      maxMessages: 100,
      price: 10,
      autoRenew: true,
    });

    expect(created.subscription.tier).toBe('BASIC');

    // Consume all free quota first
    const now = new Date('2025-01-15T00:00:00Z');
    for (let i = 0; i < 3; i++) {
      const out = await askQuestion.execute({ userId, question: `free-${i}`, now });
      expect(out.usageType).toBe('free');
    }

    // Next question should use bundle
    const bundleResult = await askQuestion.execute({ userId, question: 'paid-1', now });
    expect(bundleResult.usageType).toBe('bundle');
    expect(bundleResult.bundleId).toBeDefined();
  });
});
