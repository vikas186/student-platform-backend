import OpenAI from 'openai';
import { Op, fn } from 'sequelize';
import { db } from '../../../config/database';
import type { UserRole } from '../../../models/User.model';
import { applicationScopeForUniversity } from '../../../utils/universityApplicationScope';
import { embedText } from './embedding.service';
import { searchSimilarKnowledge, sanitizeKnowledgeSnippets } from './knowledge-base.service';
import type { AssistantChatRole, ChatUserContext, OpenAiChatMessage } from './chat.types';

const SYSTEM_PROMPT = `You are an AI assistant for a Student Recruitment Platform.
Answer only using the provided platform context.
If information is missing, say you don't have confirmed information and suggest contacting the counsellor/admin.
Follow role-based restrictions.
Do not expose private student data.
Do not show commission data to students.
Keep answers clear, short, and helpful.`;

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

export async function buildPlatformContext(ctx: ChatUserContext): Promise<string> {
  if (ctx.role === 'admin') {
    const [apps, unis, students] = await Promise.all([db.Application.count(), db.University.count(), db.StudentProfile.count()]);
    return `Admin overview (aggregates only): applications=${apps}, universities=${unis}, student profiles=${students}.`;
  }

  if (ctx.role === 'student' && ctx.studentProfileId) {
    const apps = await db.Application.findAll({
      where: { studentId: ctx.studentProfileId },
      attributes: ['status', 'applicationNumber', 'universityName', 'programName', 'country'],
    });
    const byStatus: Record<string, number> = {};
    for (const a of apps) {
      const s = a.status;
      byStatus[s] = (byStatus[s] || 0) + 1;
    }
    const counselling = Boolean(ctx.counsellingCompletedAt);
    const lines = [`Student pipeline status counts: ${JSON.stringify(byStatus)}.`];
    if (counselling) {
      const refs = apps
        .slice(0, 8)
        .map(a => `${a.applicationNumber} (${a.status}) — ${a.universityName || 'TBD'} / ${a.programName || 'TBD'}`);
      lines.push(`Recent applications (reference only): ${refs.join('; ') || 'none'}.`);
    } else {
      lines.push(
        'University names are withheld until counselling is completed; use generic guidance only for institution-specific questions.',
      );
    }
    return lines.join(' ');
  }

  if (ctx.role === 'agent' && ctx.agentProfileId) {
    const linked = await db.StudentProfile.findAll({
      where: { agentProfileId: ctx.agentProfileId },
      attributes: ['id'],
    });
    const studentIds = linked.map(s => s.id);
    const [directApps, linkedStudents] = await Promise.all([
      db.Application.count({ where: { agentId: ctx.agentProfileId } }),
      Promise.resolve(studentIds.length),
    ]);
    const samples = await db.Application.findAll({
      where: {
        [Op.or]: [{ agentId: ctx.agentProfileId }, { studentId: { [Op.in]: studentIds } }],
      },
      attributes: ['applicationNumber', 'status'],
      limit: 6,
      order: [['updatedAt', 'DESC']],
    });
    const refs = samples.map(a => `${a.applicationNumber} (${a.status})`).join(', ');
    return `Agent scope: applications directly assigned=${directApps}, linked students=${linkedStudents}. Sample refs: ${refs || 'none'}.`;
  }

  if (ctx.role === 'university' && ctx.universityId !== null && ctx.universityName) {
    const scope = applicationScopeForUniversity(ctx.universityId, ctx.universityName);
    const rows = (await db.Application.findAll({
      attributes: ['status', [fn('COUNT', '*'), 'cnt']],
      where: scope,
      group: ['Application.status'],
      raw: true,
    })) as unknown as { status: string; cnt: string }[];
    const parts = rows.map(r => `${r.status}:${r.cnt}`);
    return `Institution application counts (your university only): ${parts.join(', ') || 'none'}.`;
  }

  return 'Platform context: limited profile data loaded for this role.';
}

export async function generateAssistantReply(input: {
  user: { id: string; role: UserRole };
  userMessage: string;
  /** Last turns for continuity (oldest first) */
  priorTurns: { role: AssistantChatRole; content: string }[];
}): Promise<string> {
  const ctx = await buildChatUserContext(input.user);
  const embedding = await embedText(input.userMessage);
  const hits = await searchSimilarKnowledge(embedding, ctx, { limit: 8 });
  const snippets = sanitizeKnowledgeSnippets(hits, ctx);
  const ragBlock = snippets.filter(s => s !== '[restricted]').join('\n---\n');
  const platformBlock = await buildPlatformContext(ctx);

  const systemContent = `${SYSTEM_PROMPT}

Platform context:
${platformBlock}

Knowledge snippets (retrieved; may be incomplete):
${ragBlock || '(none)'}`;

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
    temperature: 0.25,
    max_tokens: 900,
  });

  const text = res.choices[0]?.message?.content?.trim();
  if (!text) {
    throw new Error('OpenAI returned an empty completion');
  }
  return text;
}
