import { DomainError } from '../../../../core/DomainError';
import {
  BillingCycle,
  SubscriptionBundle as SubscriptionRecord,
  SubscriptionRepository,
  Tier,
} from '../../domain/repositories/UsageAndSubscriptionRepositories';
import { SubscriptionBundle } from '../../domain/entities/SubscriptionBundle';
import { BillingService } from '../../domain/services/BillingService';

function calculateEndDate(start: Date, billingCycle: BillingCycle): Date {
  const end = new Date(start);
  if (billingCycle === 'YEARLY') {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    end.setMonth(end.getMonth() + 1);
  }
  return end;
}

export interface CreateSubscriptionInput {
  userId: string;
  tier: Tier;
  billingCycle: BillingCycle;
  maxMessages: number | null;
  price: number;
  autoRenew?: boolean;
  startDate?: Date;
}

export interface CreateSubscriptionOutput {
  subscription: SubscriptionBundle;
}

export class CreateSubscriptionUseCase {
  constructor(private readonly subscriptions: SubscriptionRepository) {}

  async execute(input: CreateSubscriptionInput): Promise<CreateSubscriptionOutput> {
    const startDate = input.startDate ?? new Date();
    const endDate = calculateEndDate(startDate, input.billingCycle);

    let entity: SubscriptionBundle;
    const commonParams = {
      userId: input.userId,
      maxMessages: input.maxMessages,
      startDate,
      endDate,
      billingCycle: input.billingCycle,
      price: input.price,
      autoRenew: input.autoRenew,
    } as const;

    switch (input.tier) {
      case 'BASIC':
        entity = SubscriptionBundle.createBasic(commonParams);
        break;
      case 'PRO':
        entity = SubscriptionBundle.createPro(commonParams);
        break;
      case 'ENTERPRISE':
        entity = SubscriptionBundle.createEnterprise(commonParams);
        break;
      default:
        throw new DomainError('Unsupported subscription tier', 'UNSUPPORTED_TIER');
    }

    const persisted = await this.subscriptions.createSubscription({
      userId: input.userId,
      tier: input.tier,
      billingCycle: input.billingCycle,
      maxMessages: input.maxMessages,
      currentPeriodStart: startDate,
      currentPeriodEnd: endDate,
    });

    // Sync persisted identifiers and status back into entity
    const fromDb = SubscriptionBundle.fromPersistence(persisted);
    entity.id = fromDb.id;
    entity.lastPaymentStatus = fromDb.lastPaymentStatus;

    return { subscription: entity };
  }
}

export interface CancelSubscriptionInput {
  userId: string;
  subscriptionId: string;
}

export interface CancelSubscriptionOutput {
  subscription: SubscriptionBundle;
}

export class CancelSubscriptionUseCase {
  constructor(private readonly subscriptions: SubscriptionRepository) {}

  async execute(input: CancelSubscriptionInput): Promise<CancelSubscriptionOutput> {
    const activeSubs = await this.subscriptions.findActiveSubscriptions(input.userId);
    const record = activeSubs.find((s) => s.id === input.subscriptionId);

    if (!record) {
      throw new DomainError('Subscription not found', 'SUBSCRIPTION_NOT_FOUND');
    }

    if (record.userId !== input.userId) {
      throw new DomainError('Subscription does not belong to user', 'SUBSCRIPTION_USER_MISMATCH');
    }

    const entity = SubscriptionBundle.fromPersistence(record);
    entity.cancel();

    const updatedRecord: SubscriptionRecord = entity.toPersistence(record);
    const saved = await this.subscriptions.saveSubscription(updatedRecord);
    const savedEntity = SubscriptionBundle.fromPersistence(saved);

    return { subscription: savedEntity };
  }
}

export interface RunBillingCycleInput {
  now?: Date;
}

export interface RunBillingCycleOutput {
  successful: SubscriptionBundle[];
  failed: { subscription: SubscriptionBundle; reason: string }[];
}

export class RunBillingCycleUseCase {
  constructor(
    private readonly subscriptions: SubscriptionRepository,
    private readonly billingService: BillingService,
  ) {}

  async execute(input: RunBillingCycleInput = {}): Promise<RunBillingCycleOutput> {
    const now = input.now ?? new Date();
    const dueRecords = await this.subscriptions.findDueForBilling({ now });

    const entities = dueRecords.map((r) => SubscriptionBundle.fromPersistence(r));

    const billingResult = this.billingService.runBillingCycle(entities, now);

    // Persist changes
    for (const entity of [
      ...billingResult.successful,
      ...billingResult.failed.map((f) => f.subscription),
    ]) {
      // Find original record to preserve metadata like createdAt
      const original = dueRecords.find((r) => r.id === entity.id);
      if (!original) {
        continue;
      }
      const updatedRecord: SubscriptionRecord = entity.toPersistence(original);
      await this.subscriptions.saveSubscription(updatedRecord);
    }

    return billingResult;
  }
}
