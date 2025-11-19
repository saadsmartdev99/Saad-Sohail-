import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DomainError } from '../../../../core/DomainError';
import { repositoryFactories } from '../../../factories';
import {
  CancelSubscriptionUseCase,
  CreateSubscriptionUseCase,
  RunBillingCycleUseCase,
} from '../../application/use-cases/SubscriptionUseCases';
import { BillingService } from '../../domain/services/BillingService';

const createSubscriptionBodySchema = z.object({
  tier: z.enum(['BASIC', 'PRO', 'ENTERPRISE']),
  billingCycle: z.enum(['MONTHLY', 'YEARLY']),
  maxMessages: z.number().int().positive().nullable(),
  price: z.number().nonnegative(),
  autoRenew: z.boolean().optional(),
  startDate: z.coerce.date().optional(),
});

function getUserId(headers: Record<string, unknown>): string {
  const value = headers['x-user-id'] ?? headers['X-User-Id'];
  if (!value || typeof value !== 'string' || value.trim().length === 0) {
    throw new DomainError('Missing x-user-id header', 'VALIDATION');
  }
  return value;
}

export async function subscriptionRoutes(app: FastifyInstance): Promise<void> {
  const subscriptionRepo = repositoryFactories.subscriptionRepository();

  const createUseCase = new CreateSubscriptionUseCase(subscriptionRepo);
  const cancelUseCase = new CancelSubscriptionUseCase(subscriptionRepo);
  const billingService = new BillingService();
  const runBillingUseCase = new RunBillingCycleUseCase(subscriptionRepo, billingService);

  app.post('/', async (request, reply) => {
    const userId = getUserId(request.headers as Record<string, unknown>);

    const parsed = createSubscriptionBodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new DomainError('Invalid request body', 'VALIDATION', parsed.error.flatten());
    }

    const body = parsed.data;

    const result = await createUseCase.execute({
      userId,
      tier: body.tier,
      billingCycle: body.billingCycle,
      maxMessages: body.maxMessages,
      price: body.price,
      autoRenew: body.autoRenew,
      startDate: body.startDate,
    });

    return reply.status(201).send(result);
  });

  app.post('/:id/cancel', async (request, reply) => {
    const userId = getUserId(request.headers as Record<string, unknown>);
    const { id } = request.params as { id: string };

    const result = await cancelUseCase.execute({
      userId,
      subscriptionId: id,
    });

    return reply.status(200).send(result);
  });

  app.post('/billing/run', async (_request, reply) => {
    const result = await runBillingUseCase.execute({});
    return reply.status(200).send(result);
  });
}
