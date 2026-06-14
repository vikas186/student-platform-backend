import OpenAI from 'openai';
import { db } from '../../../config/database';
import type { UserRole } from '../../../models/User.model';
import { embedText } from './embedding.service';
import { searchSimilarKnowledge, sanitizeKnowledgeSnippets } from './knowledge-base.service';
import { buildPlatformDataContext } from './platform-data-context.service';
import type { AssistantChatRole, ChatUserContext, OpenAiChatMessage } from './chat.types';

const SHARED_RULES = `Never reveal passwords, JWT tokens, or internal file storage paths.
Only use data present in the provided context — do not invent users, documents, or application records.
Keep answers clear, structured, and helpful. Use bullet lists when listing multiple items.`;

const STUDENT_PROMPT = `You are **Enroll Assistant**, the friendly AI helper for students on the Enroll study-abroad platform.

Your job: help students with studying abroad — programs, countries, IELTS/English tests, documents, applications, deadlines, budgets, and how to use Explore.

Student conversation rules:
- Speak in plain, simple English. Be warm, patient, and direct.
- Always answer the student's actual question. For short follow-ups ("oh", "what?", "I don't understand", "why?") — look at the conversation history and clarify or simplify your previous answer.
- If they ask your name: you are Enroll Assistant on Enroll.
- NEVER give internal agent or counsellor sales advice (e.g. "improve conversion", "discovery flow", "first calls", "pathways for agents"). Those topics are not for students.
- For IELTS questions: explain it is commonly required for UK/Canada/Australia; typical scores are roughly 6.0–7.5 but vary by program; PTE/TOEFL/Duolingo may be accepted; suggest Explore or their counsellor for exact requirements.
- Before counselling is complete: do not reveal specific university names from catalog data (they may appear masked).
- If you lack specific data, say so honestly and suggest Explore, signing in, or speaking to a counsellor — do not make up programs or fees.

${SHARED_RULES}`;

const AGENT_PROMPT = `You are an AI assistant for education agents on the Enroll platform.
Help with partner universities, commissions, student applications in their scope, documents, and pathways.
Agents may receive sales and workflow guidance when relevant to their role.

${SHARED_RULES}`;

const ADMIN_PROMPT = `You are an AI assistant for Enroll platform administrators.
You may list users, pending document reviews, applications, payments, scrape jobs, and commissions from the live context.

${SHARED_RULES}`;

const UNIVERSITY_PROMPT = `You are an AI assistant for university staff on the Enroll platform.
Help with applications, document verification, courses, deadlines, and institution-specific data in their scope.

${SHARED_RULES}`;

const DEFAULT_PROMPT = `You are an AI assistant for the Enroll Student Recruitment Platform.
Answer using the live database context and knowledge snippets when relevant.

${SHARED_RULES}`;

const VAGUE_FOLLOWUP =
  /^(oh|ok|okay|k|hmm+|what\??|why\??|huh\??|not understanding|i don'?t understand|don'?t understand|explain|sorry\??|what do you mean\??)$/i;

const isVagueFollowUp = (message: string): boolean => VAGUE_FOLLOWUP.test(message.trim());

const buildRoleSystemPrompt = (role: UserRole): string => {
  switch (role) {
    case 'student':
      return STUDENT_PROMPT;
    case 'agent':
      return AGENT_PROMPT;
    case 'admin':
      return ADMIN_PROMPT;
    case 'university':
      return UNIVERSITY_PROMPT;
    default:
      return DEFAULT_PROMPT;
  }
};

let client: OpenAI | null = null;

const getClient = (): OpenAI => {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
};

const chatModel = () => process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini';

export async function buildChatUserContext(user: { id: string; role: UserRole }): Promise<ChatUserContext> {
  const base: ChatUserContext = {
    userId: user.id,
    role: user.role,
    agentProfileId: null,
    universityId: null,
    universityName: null,
    studentProfileId: null,
    counsellingCompletedAt: null,
  };

  if (user.role === 'agent') {
    const ap = await db.AgentProfile.findOne({ where: { userId: user.id }, attributes: ['id'] });
    base.agentProfileId = ap?.id ?? null;
  }

  if (user.role === 'university') {
    const up = await db.UniversityProfile.findOne({
      where: { userId: user.id },
      include: [{ model: db.University, as: 'university', attributes: ['id', 'name'] }],
    });
    if (up) {
      const plain = up.get({ plain: true }) as { universityId: number; university?: { name: string } };
      base.universityId = plain.universityId;
      base.universityName = plain.university?.name ?? null;
    }
  }

  if (user.role === 'student') {
    const sp = await db.StudentProfile.findOne({
      where: { userId: user.id },
      attributes: ['id', 'counsellingCompletedAt'],
    });
    if (sp) {
      base.studentProfileId = sp.id;
      base.counsellingCompletedAt = sp.counsellingCompletedAt ?? null;
    }
  }

  return base;
}

const PUBLIC_EXPLORE_CTX: ChatUserContext = {
  userId: 'public-explore',
  role: 'student',
  agentProfileId: null,
  universityId: null,
  universityName: null,
  studentProfileId: null,
  counsellingCompletedAt: null,
};

async function completeChat(input: {
  ctx: ChatUserContext;
  userMessage: string;
  priorTurns: { role: AssistantChatRole; content: string }[];
  platformBlock?: string;
}): Promise<string> {
  const embedding = await embedText(input.userMessage);
  const hits = await searchSimilarKnowledge(embedding, input.ctx, {
    limit: 8,
    minSimilarity: 0.38,
    excludeRecommendationChunks: true,
  });
  const snippets = sanitizeKnowledgeSnippets(hits, input.ctx);
  const ragBlock = snippets.filter(s => s !== '[restricted]').join('\n---\n');
  const platformBlock =
    input.platformBlock ??
    (input.ctx.userId === PUBLIC_EXPLORE_CTX.userId
      ? 'Explore visitor (not signed in). No personal application, document, or payment data. Suggest signing in for account-specific status.'
      : await buildPlatformDataContext(input.ctx));

  const vagueNote =
    isVagueFollowUp(input.userMessage) && input.priorTurns.length
      ? `\n\nThe student sent a brief follow-up. Re-read the conversation and explain your previous answer more simply. Stay on their topic — do not switch to agent/counsellor workflows.`
      : '';

  const systemContent = `${buildRoleSystemPrompt(input.ctx.role)}${vagueNote}

Live database context (role-scoped):
${platformBlock}

Knowledge snippets (FAQs, courses, deadlines — use when relevant):
${ragBlock || '(none — answer from general student guidance and conversation history)'}`;

  const history: OpenAiChatMessage[] = input.priorTurns
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  const messages: OpenAiChatMessage[] = [
    { role: 'system', content: systemContent },
    ...history,
    { role: 'user', content: input.userMessage },
  ];

  const res = await getClient().chat.completions.create({
    model: chatModel(),
    messages,
    temperature: input.ctx.role === 'student' ? 0.35 : 0.25,
    max_tokens: 900,
  });

  const text = res.choices[0]?.message?.content?.trim();
  if (!text) {
    throw new Error('OpenAI returned an empty completion');
  }
  return text;
}

/** Anonymous Explore / marketing-site chat (no JWT). */
export async function generatePublicStudentReply(input: {
  userMessage: string;
  priorTurns: { role: AssistantChatRole; content: string }[];
  exploreHint?: string;
}): Promise<string> {
  const exploreBlock = input.exploreHint
    ? `Explore form context from the visitor: ${input.exploreHint}`
    : undefined;

  return completeChat({
    ctx: PUBLIC_EXPLORE_CTX,
    userMessage: input.userMessage,
    priorTurns: input.priorTurns,
    platformBlock: exploreBlock
      ? `Explore visitor (not signed in). No personal application, document, or payment data.\n${exploreBlock}`
      : undefined,
  });
}

export async function generateAssistantReply(input: {
  user: { id: string; role: UserRole };
  userMessage: string;
  /** Last turns for continuity (oldest first) */
  priorTurns: { role: AssistantChatRole; content: string }[];
}): Promise<string> {
  const ctx = await buildChatUserContext(input.user);
  return completeChat({
    ctx,
    userMessage: input.userMessage,
    priorTurns: input.priorTurns,
  });
}
