import type { UserRole } from '../../../models/User.model';

export type AssistantChatRole = 'user' | 'assistant' | 'system';

export type KnowledgeAccessFlags = {
  commission?: boolean;
  university_named?: boolean;
  agent_scoped_only?: boolean;
};

/** Stored in `knowledge_base.access` JSONB */
export type KnowledgeAccess = {
  roles: UserRole[];
  flags?: KnowledgeAccessFlags;
};

export type RagHit = {
  id: number;
  chunkKey: string;
  contentText: string;
  sourceType: string;
  sourceId: string | null;
  universityId: number | null;
  access: KnowledgeAccess;
  similarity: number;
};

export type ChatUserContext = {
  userId: string;
  role: UserRole;
  /** Agent profile id when role is agent */
  agentProfileId: number | null;
  /** University id when role is university */
  universityId: number | null;
  universityName: string | null;
  /** Student profile id when role is student */
  studentProfileId: number | null;
  counsellingCompletedAt: Date | null;
};

export type PostChatMessageBody = {
  sessionId?: string;
  message: string;
};

export type PostChatMessageResponse = {
  sessionId: string;
  reply: string;
  userMessageId: number;
  assistantMessageId: number;
};

export type ChatHistoryQuery = {
  sessionId: string;
  limit?: number;
  cursor?: string;
};

export type ChatHistoryMessage = {
  id: number;
  role: AssistantChatRole;
  content: string;
  createdAt: string;
};

export type DeleteHistoryQuery = {
  sessionId?: string;
  all?: boolean | string;
};

export type PostFeedbackBody = {
  messageId: number;
  rating: number;
  comment?: string | null;
};

export type OpenAiChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};
