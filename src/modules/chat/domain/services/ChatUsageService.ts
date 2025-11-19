import { DomainError } from '../../../../core/DomainError';
import { ChatMonthlyUsage } from '../entities/MonthlyUsage';
import type {
  SubscriptionRepository,
  UsageRepository,
  SubscriptionBundle,
} from '../../../subscriptions/domain/repositories/UsageAndSubscriptionRepositories';

export type UsageType = 'free' | 'bundle' | 'enterprise';

export interface UsageDescriptor {
  type: UsageType;
  bundleId?: string;
}

export interface ConsumeMessageResult {
  descriptor: UsageDescriptor;
  monthlyUsage: ChatMonthlyUsage;
}

const FREE_QUOTA_PER_MONTH = 3;

export class ChatUsageService {
  constructor(
    private readonly usageRepository: UsageRepository,
    private readonly subscriptionRepository: SubscriptionRepository,
  ) {}

  async consumeMessage(params: { userId: string; now?: Date }): Promise<ConsumeMessageResult> {
    const now = params.now ?? new Date();
    const { year, month, monthKey } = this.getYearMonth(now);

    let usage = await this.usageRepository.getMonthlyUsage({
      userId: params.userId,
      year,
      month,
    });

    if (!usage) {
      usage = await this.usageRepository.createMonthlyUsage({
        userId: params.userId,
        year,
        month,
        maxMessages: null,
      });
    }

    // First 3 messages per month are free
    if (usage.usedMessages < FREE_QUOTA_PER_MONTH) {
      const updated = await this.usageRepository.updateUsage({
        id: usage.id,
        usedMessages: usage.usedMessages + 1,
      });
      const monthly = new ChatMonthlyUsage(
        params.userId,
        monthKey,
        Math.min(updated.usedMessages, FREE_QUOTA_PER_MONTH),
      );
      return { descriptor: { type: 'free' }, monthlyUsage: monthly };
    }

    // Free quota exhausted -> check subscriptions
    const subs = await this.subscriptionRepository.findActiveSubscriptions(params.userId);

    if (subs.length === 0) {
      throw new DomainError('Quota exceeded', 'QUOTA_EXCEEDED');
    }

    const enterpriseSubs = subs.filter((s) => s.tier === 'ENTERPRISE');
    const nonEnterprise = subs.filter((s) => s.tier !== 'ENTERPRISE');

    const withRemaining = nonEnterprise
      .map((sub) => ({
        sub,
        remaining: this.computeRemainingMessages(sub, usage.usedMessages),
      }))
      .filter((x) => x.remaining > 0)
      .sort((a, b) => b.remaining - a.remaining);

    let chosen: SubscriptionBundle | undefined;
    let type: UsageType | undefined;

    if (withRemaining.length > 0) {
      chosen = withRemaining[0].sub;
      type = 'bundle';
    } else if (enterpriseSubs.length > 0) {
      chosen = enterpriseSubs[0];
      type = 'enterprise';
    }

    if (!chosen || !type) {
      throw new DomainError('Quota exceeded', 'QUOTA_EXCEEDED');
    }

    let updatedUsage = usage;

    // For enterprise unlimited, do NOT increment usedMessages
    if (type === 'bundle') {
      updatedUsage = await this.usageRepository.updateUsage({
        id: usage.id,
        usedMessages: usage.usedMessages + 1,
      });
    }

    const monthly = new ChatMonthlyUsage(
      params.userId,
      monthKey,
      Math.min(updatedUsage.usedMessages, FREE_QUOTA_PER_MONTH),
    );

    return {
      descriptor: { type, bundleId: chosen.id },
      monthlyUsage: monthly,
    };
  }

  private computeRemainingMessages(sub: SubscriptionBundle, usedMessages: number): number {
    if (sub.maxMessages == null) {
      // Unlimited is handled separately as ENTERPRISE
      return Number.POSITIVE_INFINITY;
    }
    return sub.maxMessages - usedMessages;
  }

  private getYearMonth(date: Date): { year: number; month: number; monthKey: string } {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1; // 1-12
    const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
    return { year, month, monthKey };
  }
}
