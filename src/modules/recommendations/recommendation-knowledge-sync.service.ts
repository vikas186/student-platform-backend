import { Transaction } from 'sequelize';
import { db } from '../../../config/database';
import { CAREER_SALARY_REFERENCE } from '../../../config/careerSalaryReference';
import { namesMatch } from '../../../utils/catalogProgram.util';
import { fetchLatestCommissionByUniversity } from '../../../utils/commissionLookup.util';
import type { KnowledgeAccess } from '../chat/chat.types';
import { embedTexts } from '../chat/embedding.service';
import { upsertKnowledgeItem } from '../chat/knowledge-base.service';

const ALL_ROLES = ['student', 'agent', 'admin', 'university'] as const;
const BATCH = 16;

const accessAll = (): KnowledgeAccess => ({
  roles: [...ALL_ROLES],
  flags: { commission: false, university_named: true },
});

const accessCommission = (): KnowledgeAccess => ({
  roles: ['admin', 'agent'],
  flags: { commission: true, university_named: true },
});

const inferField = (courseName: string, tags: string[]): string => {
  const hay = `${courseName} ${tags.join(' ')}`.toLowerCase();
  if (/business|commerce|mba|management|finance/.test(hay)) return 'business';
  if (/computer|software|data|technology|cs/.test(hay)) return 'computer science';
  if (/stem|engineering|science|math/.test(hay)) return 'stem';
  if (/engineer/.test(hay)) return 'engineering';
  return 'general';
};

const formatCatalogChunk = (c: {
  courseName: string;
  degree: string;
  fee: number;
  duration: string;
  university?: { name: string; country: string };
}): string => {
  const uni = c.university;
  return [
    `Program: ${c.courseName}.`,
    `Level: ${c.degree}.`,
    `Field: ${inferField(c.courseName, [])}.`,
    `Country: ${uni?.country ?? 'Unknown'}.`,
    `Fee: ${c.fee}.`,
    `Duration: ${c.duration}.`,
    `Quality: 90.`,
    `University: ${uni?.name ?? 'Unknown'}.`,
  ].join(' ');
};

const formatScrapeChunk = (c: {
  courseName: string;
  studyLevel: string | null;
  tuitionFee: string | null;
  duration: string | null;
  country: string | null;
  intake: string | null;
  normalizedIntakes: string[] | null;
  qualityScore: number;
  subjectTags: string[];
  careerTags: string[];
  universityName: string;
}): string => {
  const intakes = c.normalizedIntakes?.length ? c.normalizedIntakes.join(', ') : c.intake || '';
  return [
    `Program: ${c.courseName}.`,
    `Level: ${c.studyLevel || 'Program'}.`,
    `Field: ${inferField(c.courseName, c.subjectTags ?? [])}.`,
    `Country: ${c.country || 'Unknown'}.`,
    `Fee: ${c.tuitionFee || 'N/A'}.`,
    `Intake: ${intakes}.`,
    `Duration: ${c.duration || '—'}.`,
    `Quality: ${c.qualityScore}.`,
    `Careers: ${(c.careerTags ?? []).join(', ') || 'N/A'}.`,
    `University: ${c.universityName}.`,
  ].join(' ');
};

const formatFeeRangeChunk = (uniName: string, country: string, key: string, range: string, degree: string, courseName: string): string =>
  [
    `Program: ${courseName}.`,
    `Level: ${degree}.`,
    `Field: ${key}.`,
    `Country: ${country}.`,
    `Fee: ${range}.`,
    `University: ${uniName}.`,
    `Quality: 85.`,
  ].join(' ');

const formatCareerChunk = (row: (typeof CAREER_SALARY_REFERENCE)[0]): string => {
  const careers = row.careers.map(c => `${c.role} (${c.salaryRange})`).join('; ');
  return `Career reference. Field: ${row.fieldKey}. Level: ${row.level}. Country: ${row.countryPattern || 'global'}. Roles: ${careers}.`;
};

const formatCommissionChunk = (uniName: string, country: string, pct: number): string =>
  `Commission (partner). University: ${uniName}. Country: ${country}. Agent commission percentage: ${pct}%.`;

type SyncItem = {
  chunkKey: string;
  contentText: string;
  sourceType: string;
  sourceId: string;
  universityId: number | null;
  access: KnowledgeAccess;
};

export const syncRecommendationKnowledgeBase = async (): Promise<{ upserted: number }> => {
  const items: SyncItem[] = [];
  const { FEE_RANGE_PROGRAMS } = await import('../../../utils/catalogProgram.util');

  const courses = await db.Course.findAll({
    include: [{ model: db.University, as: 'university', where: { status: true }, attributes: ['id', 'name', 'country'] }],
  });

  for (const c of courses) {
    const plain = c.get({ plain: true }) as {
      id: number;
      courseName: string;
      degree: string;
      fee: number;
      duration: string;
      university?: { id: number; name: string; country: string };
    };
    if (!plain.university) continue;
    items.push({
      chunkKey: `rec:catalog:course:${plain.id}`,
      contentText: formatCatalogChunk(plain),
      sourceType: 'rec_catalog',
      sourceId: String(plain.id),
      universityId: plain.university.id,
      access: accessAll(),
    });
  }

  const scraped = await db.ScrapedCourse.findAll({
    where: {
      recordStatus: 'cleaned',
      cleaningStatus: 'high_quality',
      isDuplicate: false,
    },
  });

  const activeUnis = await db.University.findAll({ where: { status: true }, attributes: ['id', 'name'] });

  for (const row of scraped) {
    const plain = row.get({ plain: true }) as {
      id: string;
      courseName: string;
      studyLevel: string | null;
      tuitionFee: string | null;
      duration: string | null;
      country: string | null;
      intake: string | null;
      normalizedIntakes: string[] | null;
      qualityScore: number;
      subjectTags: string[];
      careerTags: string[];
      universityName: string;
    };

    let uniId: number | null = null;
    for (const u of activeUnis) {
      if (namesMatch(u.name, plain.universityName)) {
        uniId = u.id;
        break;
      }
    }

    items.push({
      chunkKey: `rec:scrape:course:${plain.id}`,
      contentText: formatScrapeChunk(plain),
      sourceType: 'rec_scrape',
      sourceId: plain.id,
      universityId: uniId,
      access: accessAll(),
    });
  }

  const universities = await db.University.findAll({ where: { status: true }, attributes: ['id', 'name', 'country', 'programFeeRanges'] });
  for (const u of universities) {
    const plain = u.get({ plain: true }) as {
      id: number;
      name: string;
      country: string;
      programFeeRanges: Record<string, unknown> | null;
    };
    if (!plain.programFeeRanges) continue;
    for (const [key, meta] of Object.entries(FEE_RANGE_PROGRAMS)) {
      const val = plain.programFeeRanges[key];
      if (val == null || String(val).trim() === '') continue;
      items.push({
        chunkKey: `rec:fee:${plain.id}:${key}`,
        contentText: formatFeeRangeChunk(plain.name, plain.country, key, String(val), meta.degree, meta.courseName),
        sourceType: 'rec_fee_range',
        sourceId: key,
        universityId: plain.id,
        access: accessAll(),
      });
    }
  }

  for (const row of CAREER_SALARY_REFERENCE) {
    items.push({
      chunkKey: `rec:career:${row.fieldKey}:${row.level}:${row.countryPattern || 'global'}`,
      contentText: formatCareerChunk(row),
      sourceType: 'rec_career',
      sourceId: row.fieldKey,
      universityId: null,
      access: accessAll(),
    });
  }

  const commissionMap = await fetchLatestCommissionByUniversity();
  for (const [, comm] of commissionMap) {
    items.push({
      chunkKey: `rec:commission:${comm.universityId}`,
      contentText: formatCommissionChunk(comm.universityName, '', comm.percentage),
      sourceType: 'rec_commission',
      sourceId: String(comm.universityId),
      universityId: comm.universityId,
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
          chunkKey: slice[j].chunkKey,
          contentText: slice[j].contentText,
          embedding: embeddings[j],
          sourceType: slice[j].sourceType,
          sourceId: slice[j].sourceId,
          universityId: slice[j].universityId,
          access: slice[j].access,
          transaction: t,
        });
        upserted++;
      }
    }
  });

  return { upserted };
};
