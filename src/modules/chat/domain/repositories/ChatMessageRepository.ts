export interface ChatMessage {
  id: string;
  userId: string;
  content: string;
  createdAt: Date;
}

export interface CreateChatMessageInput {
  userId: string;
  content: string;
  createdAt?: Date;
}

export interface ChatMessageRepository {
  createMessage(input: CreateChatMessageInput): Promise<ChatMessage>;
  getMessagesForUserInMonth(params: {
    userId: string;
    year: number;
    month: number; // 1-12
  }): Promise<ChatMessage[]>;
}
