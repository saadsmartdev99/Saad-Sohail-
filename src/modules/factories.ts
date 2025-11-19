import { PrismaChatMessageRepository } from './chat/infrastructure/persistence/PrismaChatMessageRepository';
import {
  PrismaSubscriptionRepository,
  PrismaUsageRepository,
} from './subscriptions/infrastructure/persistence/PrismaUsageAndSubscriptionRepositories';

export const repositoryFactories = {
  chatMessageRepository: () => new PrismaChatMessageRepository(),
  usageRepository: () => new PrismaUsageRepository(),
  subscriptionRepository: () => new PrismaSubscriptionRepository(),
};

export type RepositoryFactories = typeof repositoryFactories;
