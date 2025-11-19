import { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DomainError } from '../../../../core/DomainError';
import { repositoryFactories } from '../../../factories';
import { ChatUsageService } from '../../domain/services/ChatUsageService';
import { AiResponseSimulator } from '../../domain/services/AiResponseSimulator';
import {
  AskQuestionUseCase,
  GetUserUsageSummaryUseCase,
} from '../../application/use-cases/ChatUseCases';

const askBodySchema = z.object({
  question: z.string().min(1),
});

function getUserId(headers: Record<string, unknown>): string {
  const value = headers['x-user-id'] ?? headers['X-User-Id'];
  if (!value || typeof value !== 'string' || value.trim().length === 0) {
    throw new DomainError('Missing x-user-id header', 'VALIDATION');
  }
  return value;
}

export async function chatRoutes(app: FastifyInstance): Promise<void> {
  const chatMessageRepo = repositoryFactories.chatMessageRepository();
  const usageRepo = repositoryFactories.usageRepository();
  const subscriptionRepo = repositoryFactories.subscriptionRepository();

  const usageService = new ChatUsageService(usageRepo, subscriptionRepo);
  const aiSimulator = new AiResponseSimulator();
  const askUseCase = new AskQuestionUseCase(chatMessageRepo, usageService, aiSimulator);
  const usageSummaryUseCase = new GetUserUsageSummaryUseCase(usageRepo, subscriptionRepo);

  app.post('/ask', async (request, reply) => {
    const userId = getUserId(request.headers as Record<string, unknown>);

    const parsed = askBodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new DomainError('Invalid request body', 'VALIDATION', parsed.error.flatten());
    }

    const result = await askUseCase.execute({
      userId,
      question: parsed.data.question,
    });

    return reply.status(200).send(result);
  });

  app.get('/usage', async (request, reply) => {
    const userId = getUserId(request.headers as Record<string, unknown>);

    const result = await usageSummaryUseCase.execute({ userId });

    return reply.status(200).send(result);
  });
}
