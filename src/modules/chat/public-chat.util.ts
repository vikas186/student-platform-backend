import type { AssistantChatRole } from './chat.types';

export type PublicChatTurn = {
  role: AssistantChatRole;
  content: string;
};

/** Explore widget may send profile hints + optional prior turns under `context`. */
export type PublicExploreContext = {
  audience?: 'student' | 'explore' | 'agent';
  level?: string;
  field?: string;
  country?: string;
  budget?: number | string;
  intake?: string;
  history?: PublicChatTurn[];
  hint?: string;
};

export type PublicMessageBody = {
  message: string;
  history?: PublicChatTurn[];
  /** Frontend may send string ("student"), JSON string, array of turns, or profile object */
  context?: unknown;
};

const str = (v: unknown): string | undefined => {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s || undefined;
};

const parseAudience = (v: unknown): 'student' | 'explore' | 'agent' | undefined => {
  const s = str(v)?.toLowerCase();
  if (s === 'student' || s === 'explore' || s === 'agent') return s;
  return undefined;
};

const isChatTurn = (v: unknown): v is PublicChatTurn => {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (o.role === 'user' || o.role === 'assistant') && typeof o.content === 'string' && o.content.trim().length > 0;
};

const parseTurnList = (v: unknown): PublicChatTurn[] | undefined => {
  if (!Array.isArray(v)) return undefined;
  const turns = v.filter(isChatTurn).map(t => ({
    role: t.role,
    content: t.content.trim(),
  }));
  return turns.length ? turns : undefined;
};

/** Accept string / array / object shapes from the Explore widget. */
export const parsePublicContext = (raw: unknown): PublicChatTurn[] | PublicExploreContext | undefined => {
  if (raw == null || raw === '') return undefined;

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    const audience = parseAudience(trimmed);
    if (audience) return { audience };
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return parsePublicContext(JSON.parse(trimmed));
      } catch {
        return { hint: trimmed };
      }
    }
    return { hint: trimmed };
  }

  if (Array.isArray(raw)) {
    const turns = parseTurnList(raw);
    return turns ?? undefined;
  }

  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    const history = parseTurnList(o.history ?? o.messages ?? o.turns ?? o.conversation);
    const audience = parseAudience(o.audience ?? o.page ?? o.view);

    const ctx: PublicExploreContext = {
      audience,
      level: str(o.level ?? o.academicLevel ?? o.studyLevel),
      field: str(o.field ?? o.programFocus ?? o.fieldOfInterest ?? o.interest),
      country: str(o.country ?? o.targetCountry ?? o.destination),
      budget: (o.budget ?? o.estimatedBudget) as number | string | undefined,
      intake: str(o.intake ?? o.preferredIntake),
      history,
    };

    const hint = str(o.hint ?? o.summary);
    if (hint) ctx.hint = hint;

    const hasData =
      ctx.audience ||
      ctx.level ||
      ctx.field ||
      ctx.country ||
      ctx.budget != null ||
      ctx.intake ||
      ctx.history?.length ||
      ctx.hint;

    return hasData ? ctx : undefined;
  }

  return undefined;
};

export const normalizePublicMessageBody = (
  body: PublicMessageBody,
): { priorTurns: PublicChatTurn[]; exploreHint: string } => {
  let priorTurns = parseTurnList(body.history) ?? [];
  const hintParts: string[] = [];

  const ctx = parsePublicContext(body.context);
  if (ctx) {
    if (Array.isArray(ctx)) {
      priorTurns = ctx;
    } else {
      if (ctx.history?.length) {
        priorTurns = ctx.history;
      }
      if (ctx.audience) hintParts.push(`Audience: ${ctx.audience}`);
      if (ctx.level) hintParts.push(`Level: ${ctx.level}`);
      if (ctx.field) hintParts.push(`Field: ${ctx.field}`);
      if (ctx.country) hintParts.push(`Country: ${ctx.country}`);
      if (ctx.budget != null && String(ctx.budget).trim()) hintParts.push(`Budget: ${ctx.budget}`);
      if (ctx.intake) hintParts.push(`Intake: ${ctx.intake}`);
      if (ctx.hint) hintParts.push(ctx.hint);
    }
  }

  const exploreHint = hintParts.length ? `${hintParts.join('. ')}.` : '';

  return {
    priorTurns: priorTurns
      .filter(t => t.role === 'user' || t.role === 'assistant')
      .slice(-12),
    exploreHint,
  };
};
