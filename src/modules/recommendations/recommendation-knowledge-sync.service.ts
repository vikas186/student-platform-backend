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

const SCRAPE_CLEANED = {
  recordStatus: 'cleaned',
  cleaningStatus: 'high_quality',
  isDuplicate: false,
} as const;

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

const formatScrapeUniversityChunk = (u: {
  universityName: string;
  country: string | null;
  city: string | null;
  ranking: string | null;
  overview: string | null;
  intakes: string | null;
  costOfStudy: string | null;
  scholarships: string | null;
  admissionRequirements: string | null;
  popularCourses: string[];
  subjectTags: string[];
  rankingTags: string[];
  qualityScore: number;
  aiSummary: string | null;
}): string => {
  const popular = (u.popularCourses ?? []).filter(Boolean).slice(0, 8).join(', ');
  return [
    `University profile (scraped).`,
    `University: ${u.universityName}.`,
    `Country: ${u.country || 'Unknown'}.`,
    `City: ${u.city || 'N/A'}.`,
    `Ranking: ${u.ranking || 'N/A'}.`,
    `Field tags: ${(u.subjectTags ?? []).join(', ') || 'N/A'}.`,
    `Popular programs: ${popular || 'N/A'}.`,
    `Cost of study: ${u.costOfStudy || 'N/A'}.`,
    `Intakes: ${u.intakes || 'N/A'}.`,
    `Scholarships: ${(u.scholarships || '').slice(0, 280) || 'N/A'}.`,
    `Admission: ${(u.admissionRequirements || '').slice(0, 280) || 'N/A'}.`,
    `Overview: ${(u.aiSummary || u.overview || '').slice(0, 400) || 'N/A'}.`,
    `Quality: ${u.qualityScore}.`,
  ].join(' ');
};

const formatScrapeScholarshipChunk = (s: {
  scholarshipName: string;
  universityName: string | null;
  country: string | null;
  amount: string | null;
  eligibility: string | null;
  deadline: string | null;
  description: string | null;
  subjectTags: string[];
  qualityScore: number;
  aiSummary: string | null;
}): string =>
  [
    `Scholarship (scraped).`,
    `Name: ${s.scholarshipName}.`,
    `University: ${s.universityName || 'Open / multiple'}.`,
    `Country: ${s.country || 'Unknown'}.`,
    `Amount: ${s.amount || 'N/A'}.`,
    `Deadline: ${s.deadline || 'N/A'}.`,
    `Eligibility: ${(s.eligibility || '').slice(0, 300) || 'N/A'}.`,
    `Field tags: ${(s.subjectTags ?? []).join(', ') || 'N/A'}.`,
    `Details: ${(s.aiSummary || s.description || '').slice(0, 400) || 'N/A'}.`,
    `Quality: ${s.qualityScore}.`,
  ].join(' ');

const formatScrapeFeeChunk = (f: {
  country: string | null;
  studyLevel: string | null;
  tuitionFee: string | null;
  livingCost: string | null;
  accommodationCost: string | null;
  currency: string | null;
  description: string | null;
  qualityScore: number;
}): string =>
  [
    `Study cost / fee guide (scraped).`,
    `Country: ${f.country || 'Unknown'}.`,
    `Level: ${f.studyLevel || 'All levels'}.`,
    `Tuition: ${f.tuitionFee || 'N/A'}.`,
    `Living cost: ${f.livingCost || 'N/A'}.`,
    `Accommodation: ${f.accommodationCost || 'N/A'}.`,
    `Currency: ${f.currency || 'N/A'}.`,
    `Notes: ${(f.description || '').slice(0, 300) || 'N/A'}.`,
    `Quality: ${f.qualityScore}.`,
  ].join(' ');

const formatFeeRangeChunk = (
  uniName: string,
  country: string,
  key: string,
  range: string,
  degree: string,
  courseName: string,
): string =>
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

const resolveCatalogUniId = (
  scrapedName: string | null | undefined,
  activeUnis: Array<{ id: number; name: string }>,
): number | null => {
  if (!scrapedName) return null;
  for (const u of activeUnis) {
    if (namesMatch(u.name, scrapedName)) return u.id;
  }
  return null;
};

export const syncRecommendationKnowledgeBase = async (): Promise<{
  upserted: number;
  bySource: Record<string, number>;
}> => {
  const items: SyncItem[] = [];
  const bySource: Record<string, number> = {};
  const push = (item: SyncItem) => {
    items.push(item);
    bySource[item.sourceType] = (bySource[item.sourceType] ?? 0) + 1;
  };

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
    push({
      chunkKey: `rec:catalog:course:${plain.id}`,
      contentText: formatCatalogChunk(plain),
      sourceType: 'rec_catalog',
      sourceId: String(plain.id),
      universityId: plain.university.id,
      access: accessAll(),
    });
  }

  const activeUnis = await db.University.findAll({ where: { status: true }, attributes: ['id', 'name'] });
  const activeUniList = activeUnis.map(u => u.get({ plain: true }) as { id: number; name: string });

  const scraped = await db.ScrapedCourse.findAll({ where: { ...SCRAPE_CLEANED } });
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

    push({
      chunkKey: `rec:scrape:course:${plain.id}`,
      contentText: formatScrapeChunk(plain),
      sourceType: 'rec_scrape',
      sourceId: plain.id,
      universityId: resolveCatalogUniId(plain.universityName, activeUniList),
      access: accessAll(),
    });
  }

  const scrapeUniversities = await db.ScrapeUniversity.findAll({ where: { ...SCRAPE_CLEANED } });
  for (const row of scrapeUniversities) {
    const plain = row.get({ plain: true }) as {
      id: string;
      universityName: string;
      country: string | null;
      city: string | null;
      ranking: string | null;
      overview: string | null;
      intakes: string | null;
      costOfStudy: string | null;
      scholarships: string | null;
      admissionRequirements: string | null;
      popularCourses: string[];
      subjectTags: string[];
      rankingTags: string[];
      qualityScore: number;
      aiSummary: string | null;
    };
    push({
      chunkKey: `rec:scrape:university:${plain.id}`,
      contentText: formatScrapeUniversityChunk(plain),
      sourceType: 'rec_scrape_university',
      sourceId: plain.id,
      universityId: resolveCatalogUniId(plain.universityName, activeUniList),
      access: accessAll(),
    });
  }

  const scrapeScholarships = await db.ScrapeScholarship.findAll({ where: { ...SCRAPE_CLEANED } });
  for (const row of scrapeScholarships) {
    const plain = row.get({ plain: true }) as {
      id: string;
      scholarshipName: string;
      universityName: string | null;
      country: string | null;
      amount: string | null;
      eligibility: string | null;
      deadline: string | null;
      description: string | null;
      subjectTags: string[];
      qualityScore: number;
      aiSummary: string | null;
    };
    push({
      chunkKey: `rec:scrape:scholarship:${plain.id}`,
      contentText: formatScrapeScholarshipChunk(plain),
      sourceType: 'rec_scrape_scholarship',
      sourceId: plain.id,
      universityId: resolveCatalogUniId(plain.universityName, activeUniList),
      access: accessAll(),
    });
  }

  const scrapeFees = await db.ScrapeFee.findAll({ where: { ...SCRAPE_CLEANED } });
  for (const row of scrapeFees) {
    const plain = row.get({ plain: true }) as {
      id: string;
      country: string | null;
      studyLevel: string | null;
      tuitionFee: string | null;
      livingCost: string | null;
      accommodationCost: string | null;
      currency: string | null;
      description: string | null;
      qualityScore: number;
    };
    push({
      chunkKey: `rec:scrape:fee:${plain.id}`,
      contentText: formatScrapeFeeChunk(plain),
      sourceType: 'rec_scrape_fee',
      sourceId: plain.id,
      universityId: null,
      access: accessAll(),
    });
  }

  const universities = await db.University.findAll({
    where: { status: true },
    attributes: ['id', 'name', 'country', 'programFeeRanges'],
  });
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
      push({
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
    push({
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
    push({
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

  return { upserted, bySource };
};
