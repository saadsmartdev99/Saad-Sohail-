import { SubscriptionBundle } from '../entities/SubscriptionBundle';

export interface BillingResult {
  successful: SubscriptionBundle[];
  failed: { subscription: SubscriptionBundle; reason: string }[];
}

export class BillingService {
  runBillingCycle(subscriptions: SubscriptionBundle[], now: Date = new Date()): BillingResult {
    const successful: SubscriptionBundle[] = [];
    const failed: { subscription: SubscriptionBundle; reason: string }[] = [];

    for (const subscription of subscriptions) {
      // Very simple rule: assume all passed-in subscriptions are due and auto-renewable.
      const success = Math.random() < 0.8;

      if (success) {
        const { newStart, newEnd } = this.calculateNextPeriod(subscription, now);
        subscription.applySuccessfulRenewal(newStart, newEnd);
        successful.push(subscription);
      } else {
        const reason = 'Simulated payment failure';
        subscription.applyFailedRenewal();
        failed.push({ subscription, reason });
      }
    }

    return { successful, failed };
  }

  private calculateNextPeriod(
    subscription: SubscriptionBundle,
    now: Date,
  ): {
    newStart: Date;
    newEnd: Date;
  } {
    const baseStart = subscription.endDate > now ? subscription.endDate : now;
    const newStart = new Date(baseStart);
    const newEnd = new Date(baseStart);

    if (subscription.billingCycle === 'YEARLY') {
      newEnd.setFullYear(newEnd.getFullYear() + 1);
    } else {
      // Default to monthly
      newEnd.setMonth(newEnd.getMonth() + 1);
    }

    return { newStart, newEnd };
  }
}
