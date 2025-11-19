export class ChatMonthlyUsage {
  constructor(
    public readonly userId: string,
    public readonly monthKey: string,
    public readonly freeMessagesUsed: number,
  ) {}
}
