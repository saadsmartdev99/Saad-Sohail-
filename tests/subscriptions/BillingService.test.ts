import { describe, it, expect, vi } from 'vitest';
import { BillingService } from '../../src/modules/subscriptions/domain/services/BillingService';
import { SubscriptionBundle } from '../../src/modules/subscriptions/domain/entities/SubscriptionBundle';

function makeBundle(overrides: Partial<SubscriptionBundle> = {}): SubscriptionBundle {
  const now = new Date('2025-01-01T00:00:00Z');
  return Object.assign(
    new SubscriptionBundle(
      'sub-1',
      'user1',
      'BASIC',
      100,
      10,
      now,
      new Date('2025-02-01T00:00:00Z'),
      'MONTHLY',
      new Date('2025-02-01T00:00:00Z'),
      true,
      true,
      10,
      'ACTIVE',
    ),
    overrides,
  );
}

describe('BillingService', () => {
  it('marks subscription as active and advances period on successful renewal', async () => {
    const billing = new BillingService();
    const sub = makeBundle();

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.1); // < 0.8 -> success

    const result = billing.runBillingCycle([sub], new Date('2025-02-01T00:00:00Z'));

    expect(result.successful).toHaveLength(1);
    expect(result.failed).toHaveLength(0);
    expect(sub.lastPaymentStatus).toBe('ACTIVE');
    expect(sub.active).toBe(true);
    expect(sub.usedMessages).toBe(0);
    expect(sub.startDate.getTime()).toBeLessThan(sub.endDate.getTime());

    randomSpy.mockRestore();
  });

  it('marks subscription as past due and disables it on failed renewal', async () => {
    const billing = new BillingService();
    const sub = makeBundle();

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.9); // >= 0.8 -> failure

    const result = billing.runBillingCycle([sub], new Date('2025-02-01T00:00:00Z'));

    expect(result.successful).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(sub.lastPaymentStatus).toBe('PAST_DUE');
    expect(sub.active).toBe(false);
    expect(sub.autoRenew).toBe(false);

    randomSpy.mockRestore();
  });
});
