export type ConversationSummary = {
  id: string;
  unreadCount: number;
};

export function markConversationReadLocally<T extends ConversationSummary>(
  conversations: T[],
  conversationId: string,
): T[] {
  return conversations.map((conversation) =>
    conversation.id === conversationId
      ? { ...conversation, unreadCount: 0 }
      : conversation,
  );
}

export async function markConversationReadWithRecovery(
  conversationId: string,
  actions: {
    markRead: (conversationId: string) => Promise<void>;
    refresh: () => Promise<void>;
  },
) {
  try {
    await actions.markRead(conversationId);
  } catch (error) {
    await actions.refresh();
    throw error;
  }
}

export function restoreConversationId<T extends { id: string }>(
  storedId: string | null,
  conversations: T[],
) {
  return storedId && conversations.some((conversation) => conversation.id === storedId)
    ? storedId
    : null;
}

export function removeConversation<T extends { id: string }>(
  conversations: T[],
  conversationId: string,
) {
  return conversations.filter((conversation) => conversation.id !== conversationId);
}
