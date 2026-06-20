import { Op } from 'sequelize';
import { db } from '../../../config/database';
import AppError from '../../../utils/errorHandler';
import { isUuid } from '../../../utils/isUuid';
import type { UserRole } from '../../../models/User.model';
import { assertKnowledgeBaseReady } from './knowledge-base.service';
import { generateAssistantReply, generatePublicStudentReply } from './ai-chat.service';
import type { AssistantChatRole, ChatHistoryMessage, PostChatMessageResponse, PostFeedbackBody } from './chat.types';
import { getChatSuggestions, type ChatSuggestionAudience } from './public-chat.config';
import { normalizePublicMessageBody, type PublicMessageBody } from './public-chat.util';

async function assertSessionOwner(sessionId: string, userId: string) {
  const session = await db.ChatSession.findOne({ where: { id: sessionId, userId } });
  if (!session) {
    throw new AppError('Chat session not found', 404);
  }
  return session;
}

export async function postMessage(
  user: { id: string; role: UserRole },
  body: { sessionId?: string; message: string },
): Promise<PostChatMessageResponse> {
  await assertKnowledgeBaseReady();

  let sessionId = body.sessionId?.trim();
  if (sessionId && !isUuid(sessionId)) {
    throw new AppError('Invalid session id', 400);
  }

  if (sessionId) {
    await assertSessionOwner(sessionId, user.id);
  } else {
    const s = await db.ChatSession.create({ userId: user.id, title: null });
    sessionId = s.id;
  }

  const userRow = await db.AssistantChatMessage.create({
    sessionId: sessionId!,
    role: 'user',
    content: body.message.trim(),
    metadata: null,
  });

  const prior = await db.AssistantChatMessage.findAll({
    where: {
      sessionId: sessionId!,
      id: { [Op.lt]: userRow.id },
    },
    order: [['id', 'ASC']],
    limit: 24,
    attributes: ['role', 'content'],
  });

  const priorTurns = prior.map(p => ({
    role: p.role as AssistantChatRole,
    content: p.content,
  }));

  let reply: string;
  try {
    reply = await generateAssistantReply({
      user,
      userMessage: body.message.trim(),
      priorTurns,
    });
  } catch (e: unknown) {
    if (e instanceof AppError) {
      throw e;
    }
    const msg = e instanceof Error ? e.message : 'Assistant unavailable';
    throw new AppError(msg, 503);
  }

  const assistantRow = await db.AssistantChatMessage.create({
    sessionId: sessionId!,
    role: 'assistant',
    content: reply,
    metadata: null,
  });

  await db.ChatSession.update({ updatedAt: new Date() }, { where: { id: sessionId } });

  return {
    sessionId: sessionId!,
    reply,
    userMessageId: Number(userRow.id),
    assistantMessageId: Number(assistantRow.id),
  };
}

export async function getHistory(
  userId: string,
  query: { sessionId: string; limit: number; cursor?: string },
): Promise<{ messages: ChatHistoryMessage[] }> {
  await assertSessionOwner(query.sessionId, userId);
  const limit = query.limit;
  const cursorId = query.cursor ? parseInt(query.cursor, 10) : null;
  if (query.cursor && (!Number.isFinite(cursorId) || (cursorId as number) < 1)) {
    throw new AppError('Invalid cursor', 400);
  }

  const where: Record<string, unknown> = { sessionId: query.sessionId };
  if (cursorId) {
    where.id = { [Op.lt]: cursorId };
  }

  const rows = await db.AssistantChatMessage.findAll({
    where,
    order: [['id', 'DESC']],
    limit,
    attributes: ['id', 'role', 'content', 'createdAt'],
  });

  const messages: ChatHistoryMessage[] = rows.reverse().map(r => ({
    id: Number(r.id),
    role: r.role as AssistantChatRole,
    content: r.content,
    createdAt: (r.createdAt as Date).toISOString(),
  }));

  return { messages };
}

export async function getPublicSuggestions(audience: ChatSuggestionAudience) {
  return {
    audience,
    suggestions: getChatSuggestions(audience),
  };
}

const defaultAudienceForRole = (role: UserRole): ChatSuggestionAudience => {
  if (role === 'agent') return 'agent';
  if (role === 'admin') return 'admin';
  return 'student';
};

export async function getSuggestionsForUser(role: UserRole, audience?: ChatSuggestionAudience) {
  const resolved = audience ?? defaultAudienceForRole(role);
  return getPublicSuggestions(resolved);
}

export async function postPublicMessage(body: PublicMessageBody): Promise<{ reply: string }> {
  await assertKnowledgeBaseReady();

  const { priorTurns, exploreHint } = normalizePublicMessageBody(body);

  let reply: string;
  try {
    reply = await generatePublicStudentReply({
      userMessage: body.message.trim(),
      priorTurns,
      exploreHint: exploreHint || undefined,
    });
  } catch (e: unknown) {
    if (e instanceof AppError) {
      throw e;
    }
    const msg = e instanceof Error ? e.message : 'Assistant unavailable';
    throw new AppError(msg, 503);
  }

  return { reply };
}

export async function deleteHistory(userId: string, sessionId?: string, all?: boolean): Promise<void> {
  if (all) {
    await db.ChatSession.destroy({ where: { userId } });
    return;
  }
  if (!sessionId || !isUuid(sessionId)) {
    throw new AppError('sessionId is required unless all=true', 400);
  }
  await assertSessionOwner(sessionId, userId);
  await db.ChatSession.destroy({ where: { id: sessionId, userId } });
}

export async function postFeedback(userId: string, body: PostFeedbackBody): Promise<void> {
  const msg = await db.AssistantChatMessage.findByPk(body.messageId, {
    include: [{ model: db.ChatSession, as: 'session', required: true, attributes: ['userId'] }],
  });
  if (!msg || !(msg as any).session) {
    throw new AppError('Message not found', 404);
  }
  const ownerId = String((msg as any).session.userId);
  if (ownerId !== userId) {
    throw new AppError('Forbidden', 403);
  }

  const existing = await db.ChatFeedback.findOne({
    where: { userId, messageId: body.messageId },
  });
  if (existing) {
    existing.rating = body.rating;
    existing.comment = body.comment ?? null;
    await existing.save();
  } else {
    await db.ChatFeedback.create({
      userId,
      messageId: body.messageId,
      rating: body.rating,
      comment: body.comment ?? null,
    });
  }
}
