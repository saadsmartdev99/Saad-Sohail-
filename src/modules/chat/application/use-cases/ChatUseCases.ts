import type { ChatMessageRepository } from '../../domain/repositories/ChatMessageRepository';
import type {
  SubscriptionRepository,
  UsageRepository,
  SubscriptionBundle,
  Tier,
} from '../../../subscriptions/domain/repositories/UsageAndSubscriptionRepositories';
import { ChatUsageService } from '../../domain/services/ChatUsageService';
import { AiResponseSimulator } from '../../domain/services/AiResponseSimulator';

export interface AskQuestionInput {
  userId: string;
  question: string;
  now?: Date;
}

export interface AskQuestionOutput {
  answer: string;
  tokenCount: number;
  usageType: 'free' | 'bundle' | 'enterprise';
  bundleId?: string;
}

export class AskQuestionUseCase {
  constructor(
    private readonly chatMessages: ChatMessageRepository,
    private readonly usageService: ChatUsageService,
    private readonly aiSimulator: AiResponseSimulator,
  ) {}

  async execute(input: AskQuestionInput): Promise<AskQuestionOutput> {
    const now = input.now ?? new Date();

    const usageResult = await this.usageService.consumeMessage({
      userId: input.userId,
      now,
    });

    const aiResponse = await this.aiSimulator.generateResponse(input.question);

    await this.chatMessages.createMessage({
      userId: input.userId,
      content: `Q: ${input.question}\nA: ${aiResponse.answer}`,
      createdAt: now,
    });

    return {
      answer: aiResponse.answer,
      tokenCount: aiResponse.tokenCount,
      usageType: usageResult.descriptor.type,
      bundleId: usageResult.descriptor.bundleId,
    };
  }
}

export interface UsageSummaryBundle {
  id: string;
  tier: Tier;
  maxMessages: number | null;
  remainingMessages: number | null; // null => unlimited
}

export interface GetUserUsageSummaryInput {
  userId: string;
  now?: Date;
}

export interface GetUserUsageSummaryOutput {
  monthKey: string;
  free: {
    quota: number;
    used: number;
    remaining: number;
  };
  bundles: UsageSummaryBundle[];
}

export class GetUserUsageSummaryUseCase {
  private static readonly FREE_QUOTA = 3;

  constructor(
    private readonly usageRepository: UsageRepository,
    private readonly subscriptionRepository: SubscriptionRepository,
  ) {}

  async execute(input: GetUserUsageSummaryInput): Promise<GetUserUsageSummaryOutput> {
    const now = input.now ?? new Date();
    const { year, month, monthKey } = this.getYearMonth(now);

    let usage = await this.usageRepository.getMonthlyUsage({
      userId: input.userId,
      year,
      month,
    });

    if (!usage) {
      usage = await this.usageRepository.createMonthlyUsage({
        userId: input.userId,
        year,
        month,
        maxMessages: null,
      });
    }

    const totalUsed = usage.usedMessages;
    const freeUsed = Math.min(totalUsed, GetUserUsageSummaryUseCase.FREE_QUOTA);
    const freeRemaining = Math.max(GetUserUsageSummaryUseCase.FREE_QUOTA - freeUsed, 0);

    const subs = await this.subscriptionRepository.findActiveSubscriptions(input.userId);
    const bundles: UsageSummaryBundle[] = subs.map((sub) => this.mapBundle(sub, totalUsed));

    return {
      monthKey,
      free: {
        quota: GetUserUsageSummaryUseCase.FREE_QUOTA,
        used: freeUsed,
        remaining: freeRemaining,
      },
      bundles,
    };
  }

  private mapBundle(sub: SubscriptionBundle, totalUsed: number): UsageSummaryBundle {
    if (sub.maxMessages == null || sub.tier === 'ENTERPRISE') {
      return {
        id: sub.id,
        tier: sub.tier,
        maxMessages: sub.maxMessages,
        remainingMessages: null,
      };
    }

    const remaining = Math.max(sub.maxMessages - totalUsed, 0);
    return {
      id: sub.id,
      tier: sub.tier,
      maxMessages: sub.maxMessages,
      remainingMessages: remaining,
    };
  }

  private getYearMonth(date: Date): { year: number; month: number; monthKey: string } {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1; // 1-12
    const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
    return { year, month, monthKey };
  }
}
