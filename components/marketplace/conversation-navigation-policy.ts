import type { Conversation } from "@/lib/types";

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

export function mergeConversationSummaries(previous: Conversation[], incoming: Conversation[]) {
  const merged = new Map(previous.map((conversation) => [conversation.id, conversation]));
  for (const conversation of incoming) {
    const existing = merged.get(conversation.id);
    if (!existing) {
      merged.set(conversation.id, conversation);
      continue;
    }
    const existingTime = new Date(existing.lastMessageAt).getTime();
    const incomingTime = new Date(conversation.lastMessageAt).getTime();
    if (existingTime > incomingTime) continue;
    if (existingTime === incomingTime && existing.unreadCount === 0 && conversation.unreadCount > 0) {
      merged.set(conversation.id, { ...conversation, unreadCount: 0 });
      continue;
    }
    merged.set(conversation.id, {
      ...conversation,
      lastMessagePreview: conversation.lastMessagePreview || existing.lastMessagePreview,
      lastMessageSenderId: conversation.lastMessageSenderId || existing.lastMessageSenderId,
    });
  }
  return [...merged.values()].sort((left, right) =>
    new Date(right.lastMessageAt).getTime() - new Date(left.lastMessageAt).getTime(),
  );
}

export function resetConversationNavigationState<T>() {
  return {
    conversations: [] as T[],
    expandedConversationId: null as string | null,
    storedConversationId: null as string | null,
  };
}

export async function hideConversationWithSelection(
  conversationId: string,
  hide: (conversationId: string) => Promise<void>,
) {
  await hide(conversationId);
  return null;
}
