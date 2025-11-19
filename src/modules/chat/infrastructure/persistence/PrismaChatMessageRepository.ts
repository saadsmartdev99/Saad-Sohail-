import { prisma } from '../../../../core/database/prismaClient';
import {
  ChatMessage,
  ChatMessageRepository,
  CreateChatMessageInput,
} from '../../domain/repositories/ChatMessageRepository';

export class PrismaChatMessageRepository implements ChatMessageRepository {
  async createMessage(input: CreateChatMessageInput): Promise<ChatMessage> {
    const created = await prisma.chatMessage.create({
      data: {
        userId: input.userId,
        content: input.content,
        createdAt: input.createdAt,
      },
    });

    return {
      id: created.id,
      userId: created.userId,
      content: created.content,
      createdAt: created.createdAt,
    };
  }

  async getMessagesForUserInMonth(params: {
    userId: string;
    year: number;
    month: number;
  }): Promise<ChatMessage[]> {
    const { userId, year, month } = params;

    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, month, 1, 0, 0, 0, 0);

    const messages = await prisma.chatMessage.findMany({
      where: {
        userId,
        createdAt: {
          gte: start,
          lt: end,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return messages.map(
      (m: { id: string; userId: string; content: string; createdAt: Date }): ChatMessage => {
        return {
          id: m.id,
          userId: m.userId,
          content: m.content,
          createdAt: m.createdAt,
        };
      },
    );
  }
}
