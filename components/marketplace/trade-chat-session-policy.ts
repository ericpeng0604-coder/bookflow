export type TradeChatSessionMessage = {
  id: string;
  senderId: string;
  imagePaths: string[];
};

export type TradeChatSessionCursor = { createdAt: string; id: string };

export type TradeChatPage<T extends TradeChatSessionMessage = TradeChatSessionMessage> = {
  messages: ReadonlyArray<T>;
  hasMore: boolean;
  nextCursor: TradeChatSessionCursor | null;
};

export type TradeChatPageState<T extends TradeChatSessionMessage = TradeChatSessionMessage> = {
  messages: T[];
  hasMore: boolean;
  nextCursor: TradeChatSessionCursor | null;
  showQuickPhrases: boolean;
};

export function buildTradeChatPageState<T extends TradeChatSessionMessage>(page: TradeChatPage<T>, currentUserId: string) {
  return {
    messages: [...page.messages],
    hasMore: page.hasMore,
    nextCursor: page.nextCursor,
    showQuickPhrases: !page.messages.some((message) => message.senderId === currentUserId),
  } satisfies TradeChatPageState<T>;
}

export function appendTradeChatMessage<T extends TradeChatSessionMessage>(messages: ReadonlyArray<T>, message: T) {
  if (messages.some((existing) => existing.id === message.id)) return { messages: [...messages], added: false };
  return { messages: [...messages, message], added: true };
}

export function prependOlderTradeMessages<T extends TradeChatSessionMessage>(messages: ReadonlyArray<T>, olderMessages: ReadonlyArray<T>) {
  const existingIds = new Set(messages.map((message) => message.id));
  return [...olderMessages.filter((message) => !existingIds.has(message.id)), ...messages];
}

export function beginTradeChatSession() {
  let generation = 0;
  let disposed = false;
  return {
    begin() { generation += 1; return generation; },
    isCurrent(token: number) { return !disposed && token === generation; },
    dispose() { disposed = true; },
  };
}
