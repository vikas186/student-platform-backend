import { Transaction } from 'sequelize';
import { db } from '../../../config/database';
import { embedText, embedTexts } from './embedding.service';
import { upsertKnowledgeItem, type UpsertKnowledgeInput } from './knowledge-base.service';
import type { KnowledgeAccess } from './chat.types';

const ALL_ROLES = ['student', 'agent', 'admin', 'university'] as const;

const accessGeneric = (): KnowledgeAccess => ({
  roles: [...ALL_ROLES],
  flags: { commission: false, university_named: false },
});

const accessCommission = (): KnowledgeAccess => ({
  roles: ['admin', 'agent'],
  flags: { commission: true, university_named: true },
});

const accessUniversityScoped = (): KnowledgeAccess => ({
  roles: [...ALL_ROLES],
  flags: { commission: false, university_named: true },
});

function formatUniversityText(uni: {
  id: number;
  name: string;
  country: string;
  programFeeRanges?: Record<string, unknown> | null;
}): string {
  const fee =
    uni.programFeeRanges && Object.keys(uni.programFeeRanges).length
      ? ` Fee matrix (JSON keys): ${Object.keys(uni.programFeeRanges).join(', ')}.`
      : '';
  return `University: ${uni.name}. Country: ${uni.country}.${fee}`;
}

function formatCourseText(
  uniName: string,
  country: string,
  c: { courseName: string; degree: string; fee: number; duration: string },
): string {
  return `University: ${uniName}. Country: ${country}. Course: ${c.courseName}. Degree: ${c.degree}. Duration: ${c.duration}. Fee: ${c.fee}.`;
}

function formatDeadlineText(
  uniName: string,
  courseName: string,
  d: { deadlineDate: Date; intakeLabel?: string | null; dateMatrix?: Record<string, unknown> | null },
): string {
  const matrix = d.dateMatrix ? ` Dates: ${JSON.stringify(d.dateMatrix)}.` : '';
  const intake = d.intakeLabel ? ` Intake: ${d.intakeLabel}.` : '';
  return `University: ${uniName}. Course: ${courseName}. Application deadline: ${d.deadlineDate.toISOString()}.${intake}${matrix}`;
}

function formatCommissionText(uniName: string, pct: number, slab: string | null): string {
  return `Commission (internal): University: ${uniName}. Agent commission percentage: ${pct}%.${slab ? ` Slab details: ${slab}.` : ''}`;
}

const STATIC_FAQ_CHUNKS: { chunkKey: string; text: string; access: KnowledgeAccess }[] = [
  {
    chunkKey: 'faq:platform-overview',
    text: 'The Enroll Student Recruitment Platform helps students explore programs abroad, submit applications, upload documents, and track status. Use Explore to map courses to your profile before applying. Agents and counsellors can help with shortlisting after you sign in.',
    access: accessGeneric(),
  },
  {
    chunkKey: 'faq:documents',
    text: 'Typical documents include transcripts, passport, English test scores (e.g. IELTS, PTE, or TOEFL), and supporting statements. Exact requirements depend on the program and institution. Upload documents in your student dashboard or ask your counsellor for a checklist.',
    access: accessGeneric(),
  },
  {
    chunkKey: 'faq:ielts',
    text: 'IELTS (or equivalent such as PTE, TOEFL, or Duolingo English Test) is often required for UK, Canada, Australia, and similar destinations. Typical overall scores range from 6.0 to 7.5 depending on level and program. Some foundation or pathway programs accept lower scores. Requirements vary by university and course — use Explore to see options for your profile, or ask your counsellor for program-specific rules.',
    access: accessGeneric(),
  },
  {
    chunkKey: 'faq:assistant-identity',
    text: 'You are chatting with Enroll Assistant, the AI helper on the Enroll student platform. Enroll Assistant answers questions about studying abroad, English tests, documents, applications, deadlines, and how to use Explore. Enroll Assistant does not replace a human counsellor for final decisions.',
    access: accessGeneric(),
  },
  {
    chunkKey: 'faq:explore',
    text: 'Explore lets students enter academic level, field of interest, target country, budget, and intake to get AI-mapped course suggestions. University names may stay hidden until counselling. After exploring, students can sign in to save progress, upload documents, and apply with Enroll.',
    access: accessGeneric(),
  },
];

const BATCH = 16;

export async function syncKnowledgeBase(): Promise<{ upserted: number }> {
  const items: Omit<UpsertKnowledgeInput, 'embedding' | 'transaction'>[] = [];

  for (const f of STATIC_FAQ_CHUNKS) {
    items.push({
      chunkKey: f.chunkKey,
      contentText: f.text,
      sourceType: 'faq',
      sourceId: f.chunkKey,
      universityId: null,
      access: f.access,
    });
  }

  const universities = await db.University.findAll({ attributes: ['id', 'name', 'country', 'programFeeRanges'] });
  for (const u of universities) {
    const plain = u.get({ plain: true }) as {
      id: number;
      name: string;
      country: string;
      programFeeRanges?: Record<string, unknown> | null;
    };
    items.push({
      chunkKey: `university:${plain.id}:summary`,
      contentText: formatUniversityText(plain),
      sourceType: 'university',
      sourceId: String(plain.id),
      universityId: plain.id,
      access: accessUniversityScoped(),
    });
  }

  const courses = await db.Course.findAll({
    include: [{ model: db.University, as: 'university', attributes: ['id', 'name', 'country'] }],
  });
  for (const c of courses) {
    const course = c.get({ plain: true }) as {
      id: number;
      universityId: number;
      courseName: string;
      degree: string;
      fee: number;
      duration: string;
      university?: { name: string; country: string };
    };
    const uniName = course.university?.name || 'Unknown';
    const country = course.university?.country || '';
    items.push({
      chunkKey: `course:${course.id}`,
      contentText: formatCourseText(uniName, country, course),
      sourceType: 'course',
      sourceId: String(course.id),
      universityId: course.universityId,
      access: accessUniversityScoped(),
    });
  }

  const deadlines = await db.Deadline.findAll({
    include: [
      { model: db.University, as: 'university', attributes: ['id', 'name'] },
      { model: db.Course, as: 'course', attributes: ['id', 'courseName'] },
    ],
  });
  for (const d of deadlines) {
    const row = d.get({ plain: true }) as {
      id: number;
      universityId: number;
      courseId: number;
      deadlineDate: Date;
      intakeLabel?: string | null;
      dateMatrix?: Record<string, unknown> | null;
      university?: { name: string };
      course?: { courseName: string };
    };
    const uniName = row.university?.name || 'Unknown';
    const courseName = row.course?.courseName || 'Unknown';
    items.push({
      chunkKey: `deadline:${row.id}`,
      contentText: formatDeadlineText(uniName, courseName, row),
      sourceType: 'deadline',
      sourceId: String(row.id),
      universityId: row.universityId,
      access: accessUniversityScoped(),
    });
  }

  const commissions = await db.Commission.findAll({
    include: [{ model: db.University, as: 'university', attributes: ['id', 'name'] }],
  });
  for (const cm of commissions) {
    const row = cm.get({ plain: true }) as {
      id: number;
      universityId: number;
      percentage: number;
      slabDetails?: string | null;
      university?: { name: string };
    };
    const uniName = row.university?.name || 'Unknown';
    items.push({
      chunkKey: `commission:${row.id}`,
      contentText: formatCommissionText(uniName, row.percentage, row.slabDetails ?? null),
      sourceType: 'commission',
      sourceId: String(row.id),
      universityId: row.universityId,
      access: accessCommission(),
    });
  }

  let upserted = 0;
  await db.sequelize.transaction(async (t: Transaction) => {
    for (let i = 0; i < items.length; i += BATCH) {
      const slice = items.slice(i, i + BATCH);
      const embeddings = await embedTexts(slice.map(s => s.contentText));
      for (let j = 0; j < slice.length; j++) {
        await upsertKnowledgeItem({
          ...slice[j],
          embedding: embeddings[j],
          transaction: t,
        });
        upserted++;
      }
    }
  });

  return { upserted };
}

/** Single-row upsert for scripts or admin tools */
export async function upsertKnowledgeItemWithEmbedding(input: Omit<UpsertKnowledgeInput, 'embedding' | 'transaction'>): Promise<void> {
  const embedding = await embedText(input.contentText);
  await upsertKnowledgeItem({ ...input, embedding });
}
