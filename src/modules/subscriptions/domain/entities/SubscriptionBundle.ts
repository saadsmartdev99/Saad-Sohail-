import type {
  BillingCycle,
  PaymentStatus,
  SubscriptionBundle as SubscriptionRecord,
  Tier,
} from '../repositories/UsageAndSubscriptionRepositories';

export class SubscriptionBundle {
  constructor(
    public id: string,
    public userId: string,
    public tier: Tier,
    public maxMessages: number | null,
    public usedMessages: number,
    public startDate: Date,
    public endDate: Date,
    public billingCycle: BillingCycle,
    public renewalDate: Date,
    public active: boolean,
    public autoRenew: boolean,
    public price: number,
    public lastPaymentStatus: PaymentStatus,
    public canceledAt: Date | null = null,
  ) {}

  static createBasic(params: {
    userId: string;
    maxMessages: number | null;
    startDate: Date;
    endDate: Date;
    billingCycle: BillingCycle;
    price: number;
    autoRenew?: boolean;
  }): SubscriptionBundle {
    return this.create('BASIC', params);
  }

  static createPro(params: {
    userId: string;
    maxMessages: number | null;
    startDate: Date;
    endDate: Date;
    billingCycle: BillingCycle;
    price: number;
    autoRenew?: boolean;
  }): SubscriptionBundle {
    return this.create('PRO', params);
  }

  static createEnterprise(params: {
    userId: string;
    maxMessages: number | null;
    startDate: Date;
    endDate: Date;
    billingCycle: BillingCycle;
    price: number;
    autoRenew?: boolean;
  }): SubscriptionBundle {
    return this.create('ENTERPRISE', params);
  }

  private static create(
    tier: Tier,
    params: {
      userId: string;
      maxMessages: number | null;
      startDate: Date;
      endDate: Date;
      billingCycle: BillingCycle;
      price: number;
      autoRenew?: boolean;
    },
  ): SubscriptionBundle {
    const { userId, maxMessages, startDate, endDate, billingCycle, price } = params;

    return new SubscriptionBundle(
      '',
      userId,
      tier,
      maxMessages,
      0,
      startDate,
      endDate,
      billingCycle,
      endDate,
      true,
      params.autoRenew ?? true,
      price,
      'PENDING',
    );
  }

  static fromPersistence(record: SubscriptionRecord): SubscriptionBundle {
    const active = record.paymentStatus === 'ACTIVE' && !record.canceledAt;

    return new SubscriptionBundle(
      record.id,
      record.userId,
      record.tier,
      record.maxMessages,
      0,
      record.currentPeriodStart,
      record.currentPeriodEnd,
      record.billingCycle,
      record.currentPeriodEnd,
      active,
      active,
      0,
      record.paymentStatus,
      record.canceledAt,
    );
  }

  toPersistence(base: SubscriptionRecord): SubscriptionRecord {
    return {
      ...base,
      tier: this.tier,
      billingCycle: this.billingCycle,
      paymentStatus: this.lastPaymentStatus,
      maxMessages: this.maxMessages,
      currentPeriodStart: this.startDate,
      currentPeriodEnd: this.endDate,
      canceledAt: this.canceledAt,
    };
  }

  cancel(): void {
    this.active = false;
    this.autoRenew = false;
    this.lastPaymentStatus = 'CANCELED';
    this.canceledAt = new Date();
  }

  applySuccessfulRenewal(newStart: Date, newEnd: Date): void {
    this.startDate = newStart;
    this.endDate = newEnd;
    this.renewalDate = newEnd;
    this.usedMessages = 0;
    this.active = true;
    this.lastPaymentStatus = 'ACTIVE';
  }

  applyFailedRenewal(): void {
    this.lastPaymentStatus = 'PAST_DUE';
    this.active = false;
    this.autoRenew = false;
  }
}
