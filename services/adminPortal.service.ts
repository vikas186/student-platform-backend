import fs from 'fs';
import path from 'path';
import { Op, QueryTypes, Sequelize, fn } from 'sequelize';
import { db } from '../config/database';
import AppError from '../utils/errorHandler';
import { APPLICATION_STATUSES } from '../models/Application.model';
import { PAYMENT_STATUSES } from '../models/Payment.model';
import { USER_ROLES, type UserRole } from '../models/User.model';
import { normalizeApplicationReference } from '../utils/applicationRef';
import { normalizeOfferReference } from '../utils/offerRef';
import { isUuid } from '../utils/isUuid';
import {
  backendApplicationStatusToUi,
  normalizeApplicationStatusInput,
} from '../utils/adminUiStatus';
import { applicationScopeForUniversity } from '../utils/universityApplicationScope';
import { parseSimpleCsvLines } from '../utils/spreadsheetParse';
import {
  buildColumnIndexMap,
  findCatalogHeaderRowIndex,
  readCatalogSpreadsheetToMatrix,
  rowToFeeRanges,
  parseCommissionValue,
} from '../utils/universityCatalogImport';
import { syncKnowledgeBase } from '../src/modules/chat/knowledge-sync.service';

const applicationWhereByIdOrRef = (idOrRef: string) => {
  const t = idOrRef.trim();
  if (isUuid(t)) {
    return { id: t };
  }
  const ref = normalizeApplicationReference(t);
  if (!ref) {
    throw new AppError('Invalid application id or reference (use UUID or APP-12345)', 400);
  }
  return { applicationNumber: ref };
};

export const getApplicationForAdmin = async (idOrRef: string) => {
  const app = await db.Application.findOne({
    where: applicationWhereByIdOrRef(idOrRef),
    include: [
      {
        model: db.StudentProfile,
        as: 'studentProfile',
        required: false,
        include: [{ model: db.User, as: 'user', attributes: ['id', 'name', 'email', 'phone', 'role'] }],
      },
      {
        model: db.AgentProfile,
        as: 'agentProfile',
        required: false,
        include: [{ model: db.User, as: 'user', attributes: ['id', 'name', 'email'] }],
      },
      {
        model: db.Course,
        as: 'course',
        required: false,
        include: [{ model: db.University, as: 'university', required: false }],
      },
    ],
  });
  if (!app) {
    throw new AppError('Application not found', 404);
  }
  return app;
};

export const listApplicationsForAdmin = async (query: {
  search?: string;
  status?: string;
  page?: string | number;
  limit?: string | number;
}) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const offset = (page - 1) * limit;

  const andParts: object[] = [];

  if (query.status?.trim()) {
    const resolved = normalizeApplicationStatusInput(query.status.trim());
    if (!resolved) {
      throw new AppError(
        'Invalid status filter — use a backend value (e.g. under_review) or Uniwizer UI label (e.g. Review)',
        400,
      );
    }
    andParts.push({ status: resolved });
  }

  if (query.search?.trim()) {
    const q = `%${query.search.trim()}%`;
    const matchingStudents = await db.StudentProfile.findAll({
      attributes: ['id'],
      include: [
        {
          model: db.User,
          as: 'user',
          required: true,
          where: {
            [Op.or]: [{ name: { [Op.iLike]: q } }, { email: { [Op.iLike]: q } }],
          },
        },
      ],
    });
    const studentIds = matchingStudents.map(s => s.id);

    andParts.push({
      [Op.or]: [
        { universityName: { [Op.iLike]: q } },
        { programName: { [Op.iLike]: q } },
        { notes: { [Op.iLike]: q } },
        { country: { [Op.iLike]: q } },
        { applicationNumber: { [Op.iLike]: q } },
        ...(studentIds.length ? [{ studentId: { [Op.in]: studentIds } }] : []),
      ],
    });
  }

  const where = andParts.length ? { [Op.and]: andParts } : {};

  const { rows, count } = await db.Application.findAndCountAll({
    where,
    order: [['updatedAt', 'DESC']],
    limit,
    offset,
    distinct: true,
    include: [
      {
        model: db.StudentProfile,
        as: 'studentProfile',
        required: false,
        include: [{ model: db.User, as: 'user', attributes: ['id', 'name', 'email', 'phone'] }],
      },
      {
        model: db.Course,
        as: 'course',
        required: false,
        include: [{ model: db.University, as: 'university', required: false }],
      },
    ],
  });

  const data = rows.map((a: any) => {
    const plain = a.get ? a.get({ plain: true }) : a;
    return {
      ...plain,
      statusLabel: backendApplicationStatusToUi(plain.status),
    };
  });

  return { data, page, limit, total: count };
};

export const updateApplicationStatusForAdmin = async (
  idOrRef: string,
  status: (typeof APPLICATION_STATUSES)[number],
) => {
  if (!(APPLICATION_STATUSES as readonly string[]).includes(status)) {
    throw new AppError('Invalid application status', 400);
  }
  const app = await db.Application.findOne({ where: applicationWhereByIdOrRef(idOrRef) });
  if (!app) {
    throw new AppError('Application not found', 404);
  }
  const previousStatus = app.status;
  app.status = status;
  await app.save();
  const { notifyApplicationStatusChange } = await import('./application-email.service');
  notifyApplicationStatusChange(app.id, previousStatus, status);
  return getApplicationForAdmin(app.id);
};

export const updateApplicationStatusFromUiForAdmin = async (idOrRef: string, uiStatus: string) => {
  const resolved = normalizeApplicationStatusInput(uiStatus);
  if (!resolved) {
    throw new AppError('Invalid status — use an Uniwizer label (e.g. Review) or backend enum (e.g. under_review)', 400);
  }
  return updateApplicationStatusForAdmin(idOrRef, resolved);
};

export const getApplicationStatusOptionsForAdmin = () => {
  return (APPLICATION_STATUSES as readonly string[]).map(s => ({
    value: s,
    uiLabel: backendApplicationStatusToUi(s),
  }));
};

export const listUniversitiesForAdmin = async (query?: {
  search?: string;
  page?: string | number;
  limit?: string | number;
}) => {
  const page = Math.max(1, Number(query?.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(query?.limit) || 100));
  const offset = (page - 1) * limit;

  const q = query?.search && String(query.search).trim() ? `%${String(query.search).trim()}%` : null;
  const where = q
    ? {
        [Op.or]: [{ name: { [Op.iLike]: q } }, { country: { [Op.iLike]: q } }],
      }
    : undefined;

  const { rows, count } = await db.University.findAndCountAll({
    where: where ?? {},
    order: [['name', 'ASC']],
    limit,
    offset,
  });

  const universities = await Promise.all(
    rows.map(async uni => {
      const plain = uni.get({ plain: true }) as {
        id: number;
        name: string;
        [key: string]: unknown;
      };
      const scope = applicationScopeForUniversity(plain.id, plain.name);
      const [programsCount, applicantsCount, offersCount] = await Promise.all([
        db.Course.count({ where: { universityId: plain.id } }),
        db.Application.count({
          where: { [Op.and]: [scope, { status: { [Op.ne]: 'draft' } }] },
        }),
        db.Application.count({
          where: { [Op.and]: [scope, { status: 'offer_generated' }] },
        }),
      ]);
      return {
        ...plain,
        programsCount,
        applicantsCount,
        offersCount,
      };
    }),
  );

  return { universities, page, limit, total: count };
};

const mapCsvHeaderToCourseField = (
  h: string,
): 'courseName' | 'degree' | 'fee' | 'duration' | null => {
  const k = h.trim().toLowerCase().replace(/\s+/g, '_');
  if (['course_name', 'coursename', 'program', 'course', 'program_name'].includes(k)) {
    return 'courseName';
  }
  if (k === 'degree' || k === 'qualification') {
    return 'degree';
  }
  if (k === 'fee' || k === 'tuition') {
    return 'fee';
  }
  if (k === 'duration' || k === 'length') {
    return 'duration';
  }
  return null;
};

/**
 * Bulk-import **courses** for a university from a CSV file (admin “Upload university data”).
 * Required columns: course name, degree, fee, duration (flexible header names).
 */
export const importUniversityCoursesCsvForAdmin = async (
  universityId: number,
  file: Express.Multer.File,
) => {
  if (!file) {
    throw new AppError('CSV file is required', 400);
  }
  const uid = Number(universityId);
  if (!Number.isFinite(uid) || uid < 1) {
    throw new AppError('Invalid universityId', 400);
  }
  const uni = await db.University.findByPk(uid);
  if (!uni) {
    throw new AppError('University not found', 404);
  }

  const raw = fs.readFileSync(file.path, 'utf8');
  const table = parseSimpleCsvLines(raw);
  if (table.length < 2) {
    throw new AppError('CSV must include a header row and at least one data row', 400);
  }

  const headerRow = table[0];
  const colIndex: Partial<Record<'courseName' | 'degree' | 'fee' | 'duration', number>> = {};
  headerRow.forEach((cell, idx) => {
    const f = mapCsvHeaderToCourseField(cell);
    if (f) {
      colIndex[f] = idx;
    }
  });
  if (
    colIndex.courseName == null ||
    colIndex.degree == null ||
    colIndex.fee == null ||
    colIndex.duration == null
  ) {
    throw new AppError(
      'CSV headers must map to course name, degree, fee, and duration (e.g. courseName, degree, fee, duration)',
      400,
    );
  }

  let created = 0;
  let updated = 0;
  const rowErrors: { line: number; message: string }[] = [];

  for (let r = 1; r < table.length; r++) {
    const row = table[r];
    const courseName = row[colIndex.courseName!]?.trim();
    const degree = row[colIndex.degree!]?.trim();
    const feeRaw = row[colIndex.fee!]?.trim();
    const duration = row[colIndex.duration!]?.trim();
    if (!courseName && !degree && !feeRaw && !duration) {
      continue;
    }
    if (!courseName || !degree || !duration) {
      rowErrors.push({ line: r + 1, message: 'Missing course name, degree, or duration' });
      continue;
    }
    const fee = parseFloat(String(feeRaw).replace(/[^0-9.-]/g, ''));
    if (!Number.isFinite(fee)) {
      rowErrors.push({ line: r + 1, message: 'Invalid fee' });
      continue;
    }

    const [course, isCreated] = await db.Course.findOrCreate({
      where: { universityId: uid, courseName },
      defaults: {
        universityId: uid,
        courseName,
        degree,
        fee,
        duration,
      },
    });

    if (isCreated) {
      created += 1;
    } else {
      course.degree = degree;
      course.fee = fee;
      course.duration = duration;
      await course.save();
      updated += 1;
    }
  }

  try {
    fs.unlinkSync(file.path);
  } catch {
    /* ignore */
  }

  return {
    universityId: uid,
    created,
    updated,
    rowErrors,
    message:
      rowErrors.length === 0
        ? 'Import completed'
        : `Import completed with ${rowErrors.length} row warning(s)`,
  };
};

/**
 * Bulk catalog import: each row is its own university (name + country + fee columns).
 * No `universityId` — creates or updates institutions and stores **programFeeRanges** (Excel/CSV).
 */
export const importUniversityCatalogFileForAdmin = async (file: Express.Multer.File) => {
  if (!file) {
    throw new AppError('File is required', 400);
  }

  let matrix: string[][];
  try {
    matrix = readCatalogSpreadsheetToMatrix(file.path);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new AppError(msg, 400);
  }

  if (matrix.length < 2) {
    throw new AppError('File must include a header row and at least one data row', 400);
  }

  const headerIdx = findCatalogHeaderRowIndex(matrix);
  const headerRow = (matrix[headerIdx] ?? []).map(c => String(c));
  const colIndex = buildColumnIndexMap(headerRow);

  const debugInfo = {
    headerRow,
    colIndex,
    firstRows: [] as any[],
  };

  if (colIndex.university == null || colIndex.country == null) {
    throw new AppError(
      'Could not find University and Country columns. First sheet must include headers such as University, Country, and UG/PG fee columns.',
      400,
    );
  }

  let created = 0;
  let updated = 0;
  const rowErrors: { line: number; message: string }[] = [];

  for (let r = headerIdx + 1; r < matrix.length; r++) {
    const row = matrix[r];
    if (!row || row.every(c => !String(c ?? '').trim())) {
      continue;
    }

    const parsed = rowToFeeRanges(row.map(c => String(c ?? '')), colIndex);
    if (r <= headerIdx + 5) {
      debugInfo.firstRows.push({ rowIndex: r, row, parsed });
    }
    if (!parsed) {
      rowErrors.push({ line: r + 1, message: 'Missing university name or country' });
      continue;
    }

    let uni = await db.University.findOne({
      where: {
        [Op.and]: [
          { name: { [Op.iLike]: parsed.name.trim() } },
          { country: { [Op.iLike]: parsed.country.trim() } },
        ],
      },
    });

    if (!uni) {
      uni = await db.University.create({
        name: parsed.name.trim(),
        country: (parsed.country.trim() || 'General').slice(0, 200),
        status: true,
        programFeeRanges: parsed.ranges,
      });
      created += 1;
    } else {
      await uni.update({ programFeeRanges: parsed.ranges });
      updated += 1;
    }

    if (parsed.commission) {
      const pct = parseCommissionValue(parsed.commission);
      if (pct !== null) {
        const commission = await db.Commission.findOne({
          where: { universityId: uni.id },
        });
        const slabDetails = JSON.stringify({
          partnerCommissionPercent: pct,
          rates: {},
          source: 'catalog-import',
          rawFormat: parsed.commission.trim(),
        });
        if (commission) {
          await commission.update({
            percentage: pct,
            slabDetails,
          });
        } else {
          await db.Commission.create({
            universityId: uni.id,
            percentage: pct,
            slabDetails,
          });
        }
      }
    }
  }

  try {
    fs.writeFileSync(
      path.join(__dirname, '..', 'debug_import.json'),
      JSON.stringify(debugInfo, null, 2),
      'utf8'
    );
  } catch {
    /* ignore */
  }

  try {
    fs.unlinkSync(file.path);
  } catch {
    /* ignore */
  }

  return {
    created,
    updated,
    rowErrors,
    message:
      rowErrors.length === 0
        ? 'Catalog import completed'
        : `Catalog import completed with ${rowErrors.length} row warning(s)`,
  };
};

export const listCoursesForAdmin = async (universityId: number) => {
  if (!Number.isFinite(universityId) || universityId < 1) {
    throw new AppError('Invalid universityId', 400);
  }
  return db.Course.findAll({
    where: { universityId },
    include: [{ model: db.University, as: 'university', attributes: ['id', 'name', 'country'] }],
    order: [['courseName', 'ASC']],
  });
};

export const createCourseForAdmin = async (body: {
  universityId: number;
  courseName: string;
  degree: string;
  fee: number;
  duration: string;
}) => {
  if (!Number.isFinite(body.universityId) || body.universityId < 1) {
    throw new AppError('Invalid universityId', 400);
  }
  const uni = await db.University.findByPk(body.universityId);
  if (!uni) {
    throw new AppError('University not found', 404);
  }
  const course = await db.Course.create({
    universityId: body.universityId,
    courseName: String(body.courseName).trim(),
    degree: String(body.degree).trim(),
    fee: Number(body.fee),
    duration: String(body.duration).trim(),
  });
  return course.reload({
    include: [{ model: db.University, as: 'university', attributes: ['id', 'name', 'country'] }],
  });
};

export const patchCourseForAdmin = async (
  courseId: number,
  body: Partial<{ courseName: string; degree: string; fee: number; duration: string }>,
) => {
  if (!Number.isFinite(courseId) || courseId < 1) {
    throw new AppError('Invalid course id', 400);
  }
  const c = await db.Course.findByPk(courseId);
  if (!c) {
    throw new AppError('Course not found', 404);
  }
  if (body.courseName !== undefined) {
    c.courseName = String(body.courseName).trim();
  }
  if (body.degree !== undefined) {
    c.degree = String(body.degree).trim();
  }
  if (body.fee !== undefined) {
    c.fee = Number(body.fee);
  }
  if (body.duration !== undefined) {
    c.duration = String(body.duration).trim();
  }
  await c.save();
  return c.reload({
    include: [{ model: db.University, as: 'university', attributes: ['id', 'name', 'country'] }],
  });
};

/**
 * Matches Uniwizer admin "Add intake row" (free-text university) — creates university/course if needed.
 */
export const createIntakeRowForAdmin = async (body: {
  universityName: string;
  country?: string;
  intakeLabel: string;
  applicationDeadline?: string;
  scholarshipDeadline?: string;
  depositDeadline?: string;
  intakeStart?: string;
}) => {
  const name = body.universityName.trim();
  if (!name) {
    throw new AppError('universityName is required', 400);
  }
  if (!body.intakeLabel?.trim()) {
    throw new AppError('intakeLabel is required', 400);
  }
  const country = (body.country || 'General').trim() || 'General';
  let uni = await db.University.findOne({
    where: { name: { [Op.iLike]: name } },
  });
  if (!uni) {
    uni = await db.University.create({ name, country, status: true });
  }
  let course = await db.Course.findOne({
    where: { universityId: uni.id },
    order: [['id', 'ASC']],
  });
  if (!course) {
    course = await db.Course.create({
      universityId: uni.id,
      courseName: 'General programs',
      degree: 'Various',
      fee: 0,
      duration: 'N/A',
    });
  }
  const dateMatrix: Record<string, string | null> = {
    applicationDeadline: body.applicationDeadline?.trim() || null,
    scholarshipDeadline: body.scholarshipDeadline?.trim() || null,
    depositDeadline: body.depositDeadline?.trim() || null,
    intakeStart: body.intakeStart?.trim() || null,
  };
  const primary =
    dateMatrix.applicationDeadline ||
    dateMatrix.depositDeadline ||
    dateMatrix.scholarshipDeadline ||
    dateMatrix.intakeStart ||
    new Date().toISOString().slice(0, 10);
  const row = await db.Deadline.create({
    universityId: uni.id,
    courseId: course.id,
    deadlineDate: new Date(primary),
    intakeLabel: body.intakeLabel.trim(),
    dateMatrix,
  });
  return row.reload({
    include: [
      { model: db.University, as: 'university', attributes: ['id', 'name', 'country'] },
      { model: db.Course, as: 'course', attributes: ['id', 'courseName', 'degree'] },
    ],
  });
};

const normalizeMatchStr = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

const compactAlnum = (s: string) => normalizeMatchStr(s).replace(/[^a-z0-9]/g, '');

/** Common degree / program shorthands → phrases that may appear in course names. */
const PROGRAM_QUERY_SYNONYMS: Record<string, string[]> = {
  msc: ['master of science', 'master', 'm.sc', 'postgraduate taught', 'pgt'],
  'm.sc': ['master of science', 'msc'],
  meng: ['master of engineering', 'm.eng'],
  mres: ['master of research'],
  ma: ['master of arts'],
  mba: ['master of business'],
  bsc: ['bachelor of science', 'bachelor', 'undergraduate'],
  ba: ['bachelor of arts'],
  phd: ['doctor of philosophy', 'doctorate', 'dphil'],
  ug: ['undergraduate', 'bachelor'],
  pg: ['postgraduate', 'graduate'],
};

const synonymPhrasesForProgramQuery = (q: string): string[] => {
  const key = normalizeMatchStr(q).replace(/\s+/g, '');
  return PROGRAM_QUERY_SYNONYMS[key] ?? [];
};

/**
 * Lenient match for typed hints: substrings, compact form (no spaces/punctuation),
 * word prefixes, and a small synonym list for degrees (e.g. "msc" vs "Master of Science …").
 */
const fieldLooselyMatches = (query: string, ...rawValues: (string | null | undefined)[]): boolean => {
  const q = normalizeMatchStr(query);
  if (!q) {
    return true;
  }
  const values = rawValues.map(v => (v ? normalizeMatchStr(String(v)) : '')).filter(Boolean);
  for (const field of values) {
    if (field.includes(q) || q.includes(field)) {
      return true;
    }
    const qC = compactAlnum(q);
    const fC = compactAlnum(field);
    if (qC.length >= 2 && fC.includes(qC)) {
      return true;
    }
    if (fC.length >= 4 && qC.length >= 2 && qC.includes(fC)) {
      return true;
    }
    const words = field.split(' ').filter(w => w.length > 0);
    for (const w of words) {
      if (w.startsWith(q) || (q.length <= w.length && w.startsWith(q))) {
        return true;
      }
      if (q.length >= 2 && q.length <= 6 && w.includes(q)) {
        return true;
      }
    }
    for (const syn of synonymPhrasesForProgramQuery(q)) {
      const s = normalizeMatchStr(syn);
      if (field.includes(s) || s.includes(field)) {
        return true;
      }
    }
  }
  return false;
};

export const findApplicationForOfferMatch = async (opts: {
  studentName: string;
  program: string;
  university: string;
  studentEmail?: string;
}) => {
  const sn = opts.studentName.trim();
  const prog = opts.program.trim();
  const uni = opts.university.trim();
  const emailRaw = opts.studentEmail?.trim().toLowerCase() || '';

  if (!emailRaw && (!sn || !prog || !uni)) {
    throw new AppError(
      'Provide studentName, program, and university — or add studentEmail (or applicationId / APP-xxxxx) to narrow the match.',
      400,
    );
  }
  if (emailRaw && !sn && !prog && !uni) {
    // single-app-by-email resolution below
  } else if (!emailRaw && (!prog || !uni)) {
    throw new AppError('program and university are required when studentEmail is not used', 400);
  }

  const candidates = await db.Application.findAll({
    include: [
      {
        model: db.StudentProfile,
        as: 'studentProfile',
        required: true,
        include: [{ model: db.User, as: 'user', required: true }],
      },
      {
        model: db.Course,
        as: 'course',
        required: false,
        include: [{ model: db.University, as: 'university', required: false }],
      },
    ],
    order: [['updatedAt', 'DESC']],
    limit: 2000,
  });

  const getUser = (app: any) => app.studentProfile?.user as { name?: string; email?: string } | undefined;

  if (emailRaw) {
    const byEmail = candidates.filter(a => getUser(a)?.email?.toLowerCase() === emailRaw);
    if (byEmail.length === 1) {
      return byEmail[0];
    }
    if (byEmail.length > 1) {
      const narrowed = byEmail.filter(
        a =>
          fieldLooselyMatches(prog, (a as any).programName, (a as any).course?.courseName) &&
          fieldLooselyMatches(uni, (a as any).universityName, (a as any).course?.university?.name),
      );
      if (narrowed.length === 1) {
        return narrowed[0];
      }
    }
  }

  const studentMatches = (user: { name?: string | null; email?: string | null }) => {
    if (emailRaw && user.email?.toLowerCase() === emailRaw) {
      return true;
    }
    if (!sn) {
      return false;
    }
    const uname = normalizeMatchStr(user.name || '');
    const snNorm = normalizeMatchStr(sn);
    if (!uname) {
      return false;
    }
    if (uname.includes(snNorm) || snNorm.includes(uname)) {
      return true;
    }
    const words = snNorm.split(' ').filter(w => w.length > 1);
    if (words.length && words.every(w => uname.includes(w))) {
      return true;
    }
    return false;
  };

  const programMatches = (app: { programName?: string | null; course?: { courseName?: string } | null }) =>
    fieldLooselyMatches(prog, app.programName, app.course?.courseName);

  const universityMatches = (app: {
    universityName?: string | null;
    course?: { university?: { name?: string } | null } | null;
  }) => fieldLooselyMatches(uni, app.universityName, app.course?.university?.name);

  for (const app of candidates) {
    const user = getUser(app);
    if (!user) {
      continue;
    }
    if (studentMatches(user) && programMatches(app as any) && universityMatches(app as any)) {
      return app;
    }
  }

  throw new AppError(
    'No matching application — try studentEmail, fuller program/university names, spelling, or pass applicationId (UUID or APP-xxxxx). Recent applications (last 2000 updates) are searched.',
    404,
  );
};

export const uploadOfferLetterByMatchForAdmin = async (
  file: Express.Multer.File,
  fields: {
    studentName: string;
    program: string;
    university: string;
    applicationId?: string;
    studentEmail?: string;
  },
) => {
  if (!file) {
    throw new AppError('File is required', 400);
  }
  const app = fields.applicationId?.trim()
    ? await getApplicationForAdmin(fields.applicationId.trim())
    : await findApplicationForOfferMatch({
        studentName: fields.studentName,
        program: fields.program,
        university: fields.university,
        studentEmail: fields.studentEmail,
      });
  let letter = await db.OfferLetter.findOne({ where: { applicationId: app.id } });
  if (!letter) {
    const student = await db.StudentProfile.findByPk((app as any).studentId, {
      include: [{ model: db.User, as: 'user', attributes: ['name'] }],
    });
    const user = (student as any)?.user;
    letter = await db.OfferLetter.create({
      applicationId: app.id,
      fileUrl: null,
      uploadedAt: new Date(),
      status: 'pending',
      universityName: (app as any).universityName,
      programName: (app as any).programName,
      studentDisplayName: user?.name || null,
      expiresAt: null,
      notes: null,
    });
  }
  const url = file.path.replace(/\\/g, '/');
  letter.fileUrl = url;
  letter.status = 'active';
  letter.uploadedAt = new Date();
  await letter.save();
  return letter;
};

export const createCommissionSlabRichForAdmin = async (body: {
  universityName: string;
  partnerCommissionPercent: number;
  rates?: Partial<Record<string, number>>;
  country?: string;
}) => {
  const name = body.universityName.trim();
  if (!name) {
    throw new AppError('universityName is required', 400);
  }
  let uni = await db.University.findOne({
    where: { name: { [Op.iLike]: name } },
  });
  if (!uni) {
    uni = await db.University.create({
      name,
      country: (body.country || 'General').trim() || 'General',
      status: true,
    });
  }
  const slabDetails = JSON.stringify({
    partnerCommissionPercent: Number(body.partnerCommissionPercent),
    rates: body.rates ?? {},
    source: 'admin-ui',
  });
  return db.Commission.create({
    universityId: uni.id,
    percentage: Number(body.partnerCommissionPercent),
    slabDetails,
  });
};

export const patchAgentSubscriptionForAdmin = async (
  agentProfileId: number,
  subscriptionPlanId: number | null,
) => {
  const agent = await db.AgentProfile.findByPk(agentProfileId);
  if (!agent) {
    throw new AppError('Agent profile not found', 404);
  }
  if (subscriptionPlanId != null) {
    const plan = await db.SubscriptionPlan.findByPk(subscriptionPlanId);
    if (!plan) {
      throw new AppError('Subscription plan not found', 404);
    }
  }
  agent.subscriptionPlanId = subscriptionPlanId;
  await agent.save();
  return agent.reload({
    include: [{ model: db.SubscriptionPlan, as: 'subscriptionPlan', required: false }],
  });
};

export const deleteApplicationForAdmin = async (idOrRef: string) => {
  const app = await db.Application.findOne({ where: applicationWhereByIdOrRef(idOrRef) });
  if (!app) {
    throw new AppError('Application not found', 404);
  }
  await app.destroy();
};

export const listUsersForAdmin = async (query: {
  search?: string;
  role?: string;
  page?: string | number;
  limit?: string | number;
}) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const offset = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (query.role?.trim()) {
    const r = query.role.trim().toLowerCase();
    if (!(USER_ROLES as readonly string[]).includes(r)) {
      throw new AppError('Invalid role filter', 400);
    }
    where.role = r;
  }

  if (query.search?.trim()) {
    const q = `%${query.search.trim()}%`;
    (where as any)[Op.or] = [
      { name: { [Op.iLike]: q } },
      { email: { [Op.iLike]: q } },
      Sequelize.where(Sequelize.cast(Sequelize.col('User.role'), 'TEXT'), { [Op.iLike]: q }),
    ];
  }

  const { rows, count } = await db.User.findAndCountAll({
    where,
    attributes: { exclude: ['password'] },
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });

  return { data: rows, page, limit, total: count };
};

type CreateAdminUserBody = {
  fullName: string;
  email: string;
  password: string;
  role: UserRole;
  phone?: string | null;
  agencyName?: string | null;
  targetCountries?: string[];
  universityId?: number;
};

export const createUserForAdmin = async (body: CreateAdminUserBody) => {
  const email = String(body.email).trim().toLowerCase();
  if (await db.User.findOne({ where: { email } })) {
    throw new AppError('Email already taken', 400);
  }

  const role = body.role;
  if (!(USER_ROLES as readonly string[]).includes(role)) {
    throw new AppError('Invalid role', 400);
  }

  const user = await db.User.create({
    name: String(body.fullName).trim(),
    email,
    password: body.password,
    role,
    phone: body.phone?.trim() || null,
    status: true,
  });

  if (role === 'student') {
    await db.StudentProfile.create({
      userId: user.id,
      academicDetails: null,
      preferredCountry: null,
      targetCountries: Array.isArray(body.targetCountries) ? body.targetCountries : [],
    });
  } else if (role === 'agent') {
    const agency = body.agencyName?.trim() || 'Agency';
    await db.AgentProfile.create({
      userId: user.id,
      agencyName: agency,
      primaryMarket: null,
    });
  } else if (role === 'university') {
    const uid = body.universityId;
    if (!uid || !Number.isFinite(uid) || uid < 1) {
      throw new AppError('universityId is required for university users', 400);
    }
    const uni = await db.University.findByPk(uid);
    if (!uni) {
      throw new AppError('University not found', 404);
    }
    await db.UniversityProfile.create({
      userId: user.id,
      universityId: uid,
      jobTitle: null,
    });
  }

  return user.toSafeObject();
};

export const updateUserRoleForAdmin = async (
  userId: string,
  newRole: UserRole,
  actorUserId: string,
) => {
  if (userId === actorUserId) {
    throw new AppError('You cannot change your own role', 400);
  }
  if (!(USER_ROLES as readonly string[]).includes(newRole)) {
    throw new AppError('Invalid role', 400);
  }

  const user = await db.User.findByPk(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (user.role === 'admin' && newRole !== 'admin') {
    const adminCount = await db.User.count({ where: { role: 'admin' } });
    if (adminCount <= 1) {
      throw new AppError('Cannot remove the last administrator', 400);
    }
  }

  const prev = user.role;
  user.role = newRole;
  await user.save();

  if (newRole === 'student' && !(await db.StudentProfile.findOne({ where: { userId } }))) {
    await db.StudentProfile.create({
      userId,
      academicDetails: null,
      preferredCountry: null,
      targetCountries: [],
    });
  }
  if (newRole === 'agent' && !(await db.AgentProfile.findOne({ where: { userId } }))) {
    await db.AgentProfile.create({
      userId,
      agencyName: 'Agency',
      primaryMarket: null,
    });
  }
  if (newRole === 'university' && !(await db.UniversityProfile.findOne({ where: { userId } }))) {
    throw new AppError(
      'Cannot switch to university role without a university profile. Create a new user with role university and universityId.',
      400,
    );
  }

  void prev;

  return user.toSafeObject();
};

export const deleteUserForAdmin = async (userId: string, actorUserId: string) => {
  if (userId === actorUserId) {
    throw new AppError('You cannot delete your own account', 400);
  }
  const user = await db.User.findByPk(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }
  if (user.role === 'admin') {
    const adminCount = await db.User.count({ where: { role: 'admin' } });
    if (adminCount <= 1) {
      throw new AppError('Cannot delete the last administrator', 400);
    }
  }
  await user.destroy();
};

export const listDeadlinesForAdmin = async (query: { search?: string; page?: number; limit?: number }) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(500, Math.max(1, Number(query.limit) || 50));
  const offset = (page - 1) * limit;

  const all = await db.Deadline.findAll({
    include: [
      { model: db.University, as: 'university', attributes: ['id', 'name', 'country'] },
      { model: db.Course, as: 'course', attributes: ['id', 'courseName', 'degree'] },
    ],
    order: [['deadlineDate', 'ASC']],
    limit: 2000,
  });

  const q = query.search?.trim().toLowerCase();
  const filtered = q
    ? all.filter(r => {
        const uni = (r as any).university?.name?.toLowerCase() || '';
        const intake = String((r as any).intakeLabel || '').toLowerCase();
        const cn = (r as any).course?.courseName?.toLowerCase() || '';
        return uni.includes(q) || intake.includes(q) || cn.includes(q);
      })
    : all;

  const total = filtered.length;
  const data = filtered.slice(offset, offset + limit);
  return { data, page, limit, total };
};

export const createDeadlineForAdmin = async (body: {
  universityId: number;
  courseId: number;
  deadlineDate: string;
  intakeLabel?: string | null;
  dateMatrix?: Record<string, unknown> | null;
}) => {
  const uni = await db.University.findByPk(body.universityId);
  if (!uni) {
    throw new AppError('University not found', 404);
  }
  const course = await db.Course.findOne({
    where: { id: body.courseId, universityId: body.universityId },
  });
  if (!course) {
    throw new AppError('Course not found for this university', 404);
  }
  return db.Deadline.create({
    universityId: body.universityId,
    courseId: body.courseId,
    deadlineDate: new Date(body.deadlineDate),
    intakeLabel: body.intakeLabel?.trim() || null,
    dateMatrix: body.dateMatrix ?? null,
  });
};

export const updateDeadlineForAdmin = async (
  id: number,
  body: Partial<{
    deadlineDate: string;
    intakeLabel: string | null;
    dateMatrix: Record<string, unknown> | null;
    universityId: number;
    courseId: number;
  }>,
) => {
  const row = await db.Deadline.findByPk(id);
  if (!row) {
    throw new AppError('Deadline not found', 404);
  }
  if (body.deadlineDate !== undefined) {
    row.deadlineDate = new Date(body.deadlineDate);
  }
  if (body.intakeLabel !== undefined) {
    row.intakeLabel = body.intakeLabel === null || body.intakeLabel === '' ? null : String(body.intakeLabel).trim();
  }
  if (body.dateMatrix !== undefined) {
    row.dateMatrix = body.dateMatrix;
  }
  if (body.universityId !== undefined || body.courseId !== undefined) {
    const uniId = body.universityId ?? row.universityId;
    const courseId = body.courseId ?? row.courseId;
    const course = await db.Course.findOne({ where: { id: courseId, universityId: uniId } });
    if (!course) {
      throw new AppError('Course not found for this university', 404);
    }
    row.universityId = uniId;
    row.courseId = courseId;
  }
  await row.save();
  return row.reload({
    include: [
      { model: db.University, as: 'university', attributes: ['id', 'name', 'country'] },
      { model: db.Course, as: 'course', attributes: ['id', 'courseName', 'degree'] },
    ],
  });
};

export const deleteDeadlineForAdmin = async (id: number) => {
  const row = await db.Deadline.findByPk(id);
  if (!row) {
    throw new AppError('Deadline not found', 404);
  }
  await row.destroy();
};

const offerLetterClause = (param: string): { id?: number; referenceCode?: string } => {
  const t = param.trim();
  if (/^\d+$/.test(t)) {
    return { id: parseInt(t, 10) };
  }
  const ref = normalizeOfferReference(t);
  if (ref) {
    return { referenceCode: ref };
  }
  throw new AppError('Invalid offer letter id (numeric id or OFR-123)', 400);
};

export const listOfferLettersForAdmin = async (query: { search?: string }) => {
  const rows = await db.OfferLetter.findAll({
    include: [
      {
        model: db.Application,
        as: 'application',
        required: false,
        attributes: ['id', 'applicationNumber'],
        include: [
          {
            model: db.StudentProfile,
            as: 'studentProfile',
            required: false,
            include: [{ model: db.User, as: 'user', attributes: ['name', 'email'] }],
          },
        ],
      },
    ],
    order: [['createdAt', 'DESC']],
    limit: 500,
  });

  const mapped = rows.map((letter: any) => {
    const plain = letter.get ? letter.get({ plain: true }) : letter;
    const fileName = plain.fileUrl ? path.basename(String(plain.fileUrl)) : null;
    const signedFileName = plain.signedFileUrl ? path.basename(String(plain.signedFileUrl)) : null;
    return { ...plain, fileName, signedFileName };
  });

  if (!query.search?.trim()) {
    return mapped;
  }
  const q = query.search.trim().toLowerCase();
  return mapped.filter(
    (r: any) =>
      String(r.referenceCode || '').toLowerCase().includes(q) ||
      String(r.studentDisplayName || '').toLowerCase().includes(q) ||
      String(r.universityName || '').toLowerCase().includes(q) ||
      String(r.programName || '').toLowerCase().includes(q) ||
      String(r.fileName || '').toLowerCase().includes(q) ||
      String(r.signedFileName || '').toLowerCase().includes(q),
  );
};

export const createOfferLetterForAdmin = async (body: {
  applicationId: string;
  universityName?: string | null;
  programName?: string | null;
  studentDisplayName?: string | null;
  notes?: string | null;
  expiresAt?: string | null;
}) => {
  const app = await getApplicationForAdmin(body.applicationId);
  const existing = await db.OfferLetter.findOne({ where: { applicationId: app.id } });
  if (existing) {
    throw new AppError('An offer letter already exists for this application', 409);
  }
  const student = await db.StudentProfile.findByPk((app as any).studentId, {
    include: [{ model: db.User, as: 'user', attributes: ['name'] }],
  });
  const user = (student as any)?.user;

  return db.OfferLetter.create({
    applicationId: app.id,
    fileUrl: null,
    uploadedAt: new Date(),
    status: 'pending',
    universityName: body.universityName?.trim() || (app as any).universityName,
    programName: body.programName?.trim() || (app as any).programName,
    studentDisplayName: body.studentDisplayName?.trim() || user?.name || null,
    expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    notes: body.notes?.trim() || null,
  });
};

export const uploadOfferLetterFileForAdmin = async (param: string, file: Express.Multer.File) => {
  if (!file) {
    throw new AppError('File is required', 400);
  }
  const clause = offerLetterClause(param);
  const letter = await db.OfferLetter.findOne({ where: clause });
  if (!letter) {
    throw new AppError('Offer letter not found', 404);
  }
  const url = file.path.replace(/\\/g, '/');
  letter.fileUrl = url;
  letter.status = 'active';
  letter.uploadedAt = new Date();
  await letter.save();
  return letter;
};

export const deleteOfferLetterForAdmin = async (param: string) => {
  const clause = offerLetterClause(param);
  const letter = await db.OfferLetter.findOne({ where: clause });
  if (!letter) {
    throw new AppError('Offer letter not found', 404);
  }
  await letter.destroy();
};

const tierFromMetrics = (conversionRate: number, applicationCount: number) => {
  if (applicationCount <= 0) {
    return 'Bronze';
  }
  if (conversionRate >= 70) {
    return 'Gold';
  }
  if (conversionRate >= 50) {
    return 'Silver';
  }
  return 'Bronze';
};

const tierSortRank = (tier: string) => (tier === 'Gold' ? 3 : tier === 'Silver' ? 2 : 1);

type AgentDashboardRow = {
  id: number;
  agencyName: string;
  primaryMarket: string | null;
  logoUrl: string | null;
  agreementStatus: string;
  signedAgreementUrl: string | null;
  agreementSentAt: Date | null;
  agreementUploadedAt: Date | null;
  agreementApprovedAt: Date | null;
  agreementRejectionReason: string | null;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string | null;
  userStatus: boolean;
  rankingId: number | null;
  rankingTotalApplications: number | null;
  rankingDeposits: number | null;
  rankingVisaSuccessRate: number | null;
  rankingEnrollments: number | null;
  subscriptionPlanId: number | null;
  subscriptionPlanName: string | null;
  subscriptionPlanPrice: unknown;
  studentCount: number;
  applicationCount: number;
  wonCount: number;
};

export const listAgentsForAdmin = async (query: {
  search?: string;
  sort?: string;
  page?: string | number;
  limit?: string | number;
}) => {
  const rawRows = (await db.sequelize.query(
    `
    SELECT
      ap.id AS "id",
      ap.agency_name AS "agencyName",
      ap.primary_market AS "primaryMarket",
      ap.logo_url AS "logoUrl",
      ap.agreement_status AS "agreementStatus",
      ap.signed_agreement_url AS "signedAgreementUrl",
      ap.agreement_sent_at AS "agreementSentAt",
      ap.agreement_uploaded_at AS "agreementUploadedAt",
      ap.agreement_approved_at AS "agreementApprovedAt",
      ap.agreement_rejection_reason AS "agreementRejectionReason",
      u.id AS "userId",
      u.name AS "userName",
      u.email AS "userEmail",
      u.phone AS "userPhone",
      u.status AS "userStatus",
      ar.id AS "rankingId",
      ar.total_applications AS "rankingTotalApplications",
      ar.deposits AS "rankingDeposits",
      ar.visa_success_rate AS "rankingVisaSuccessRate",
      ar.enrollments AS "rankingEnrollments",
      spl.id AS "subscriptionPlanId",
      spl.name AS "subscriptionPlanName",
      spl.price AS "subscriptionPlanPrice",
      (
        SELECT COUNT(*)::int FROM student_profiles sp
        WHERE sp.agent_profile_id = ap.id
      ) AS "studentCount",
      (
        SELECT COUNT(*)::int FROM applications a
        WHERE a.agent_id = ap.id
           OR EXISTS (
             SELECT 1 FROM student_profiles sp2
             WHERE sp2.id = a.student_id AND sp2.agent_profile_id = ap.id
           )
      ) AS "applicationCount",
      (
        SELECT COUNT(*)::int FROM applications a
        WHERE (
          a.agent_id = ap.id
          OR EXISTS (
            SELECT 1 FROM student_profiles sp2
            WHERE sp2.id = a.student_id AND sp2.agent_profile_id = ap.id
          )
        )
        AND a.status IN ('enrolled', 'visa_approved', 'deposit_paid')
      ) AS "wonCount"
    FROM agent_profiles ap
    INNER JOIN users u ON u.id = ap.user_id AND u.role = 'agent'
    LEFT JOIN agent_rankings ar ON ar.agent_id = ap.id
    LEFT JOIN subscription_plans spl ON spl.id = ap.subscription_plan_id
    ORDER BY ap.agency_name ASC
    `,
    { type: QueryTypes.SELECT },
  )) as AgentDashboardRow[];

  const enriched = rawRows.map(r => {
    const applicationCount = Number(r.applicationCount) || 0;
    const wonCount = Number(r.wonCount) || 0;
    const conversionRate = applicationCount
      ? Math.round((wonCount / applicationCount) * 1000) / 10
      : 0;
    const tier = tierFromMetrics(conversionRate, applicationCount);
    const primaryMarket = r.primaryMarket ?? null;
    return {
      id: r.id,
      agencyName: r.agencyName,
      primaryMarket,
      /** UI label — same as primary market / region */
      country: primaryMarket,
      logoUrl: r.logoUrl,
      agreement: {
        status: r.agreementStatus,
        signedAgreementUrl: r.signedAgreementUrl,
        agreementSentAt: r.agreementSentAt,
        agreementUploadedAt: r.agreementUploadedAt,
        agreementApprovedAt: r.agreementApprovedAt,
        rejectionReason: r.agreementRejectionReason,
      },
      user: {
        id: r.userId,
        name: r.userName,
        email: r.userEmail,
        phone: r.userPhone,
        status: r.userStatus,
      },
      ranking: r.rankingId
        ? {
            id: r.rankingId,
            totalApplications: r.rankingTotalApplications ?? 0,
            deposits: r.rankingDeposits ?? 0,
            visaSuccessRate: r.rankingVisaSuccessRate ?? 0,
            enrollments: r.rankingEnrollments ?? 0,
          }
        : null,
      subscriptionPlan:
        r.subscriptionPlanId != null
          ? {
              id: r.subscriptionPlanId,
              name: r.subscriptionPlanName,
              price: r.subscriptionPlanPrice,
            }
          : null,
      studentCount: Number(r.studentCount) || 0,
      applicationCount,
      wonCount,
      conversionRate,
      tier,
    };
  });

  let rows = enriched;
  if (query.search?.trim()) {
    const q = query.search.trim().toLowerCase();
    rows = enriched.filter(
      r =>
        r.agencyName.toLowerCase().includes(q) ||
        String(r.primaryMarket || '').toLowerCase().includes(q) ||
        String(r.country || '').toLowerCase().includes(q) ||
        String(r.user?.name || '')
          .toLowerCase()
          .includes(q),
    );
  }

  const sort = query.sort?.trim() || 'name';
  if (sort === 'conversion') {
    rows = [...rows].sort((a, b) => b.conversionRate - a.conversionRate || a.agencyName.localeCompare(b.agencyName));
  } else if (sort === 'students') {
    rows = [...rows].sort((a, b) => b.studentCount - a.studentCount || a.agencyName.localeCompare(b.agencyName));
  } else if (sort === 'tier') {
    rows = [...rows].sort(
      (a, b) =>
        tierSortRank(b.tier) - tierSortRank(a.tier) ||
        b.conversionRate - a.conversionRate ||
        a.agencyName.localeCompare(b.agencyName),
    );
  } else {
    rows = [...rows].sort((a, b) => a.agencyName.localeCompare(b.agencyName));
  }

  const page = Math.max(1, Number(query.page) || 1);
  const limitRaw = Number(query.limit);
  const limit = query.limit != null && query.limit !== '' ? Math.min(200, Math.max(1, limitRaw)) : null;

  const total = rows.length;
  if (limit != null) {
    const offset = (page - 1) * limit;
    rows = rows.slice(offset, offset + limit);
  }

  return {
    agents: rows,
    page: limit != null ? page : 1,
    limit: limit ?? total,
    total,
  };
};

const AGENT_AGREEMENT_PUBLIC_FIELDS = [
  'id',
  'agencyName',
  'primaryMarket',
  'agreementStatus',
  'signedAgreementUrl',
  'agreementSentAt',
  'agreementUploadedAt',
  'agreementApprovedAt',
  'agreementApprovedByUserId',
  'agreementRejectionReason',
  'createdAt',
  'updatedAt',
] as const;

/**
 * Admin: list agent partnership agreements, optionally filtered by workflow status.
 * Defaults to `submitted` so admins land on the "needs review" queue.
 */
export const listAgentAgreementsForAdmin = async (query: {
  status?: string;
  page?: string | number;
  limit?: string | number;
}) => {
  const allowed = new Set(['pending', 'submitted', 'approved', 'rejected']);
  const status = query.status && allowed.has(String(query.status)) ? String(query.status) : 'submitted';
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(query.limit) || 50));
  const offset = (page - 1) * limit;

  const { rows, count } = await db.AgentProfile.findAndCountAll({
    where: { agreementStatus: status },
    attributes: AGENT_AGREEMENT_PUBLIC_FIELDS as unknown as string[],
    include: [
      {
        model: db.User,
        as: 'user',
        attributes: ['id', 'name', 'email', 'phone', 'status'],
      },
    ],
    order: [['agreementUploadedAt', 'DESC']],
    limit,
    offset,
  });

  return {
    agreements: rows.map(r => r.get({ plain: true })),
    page,
    limit,
    total: count,
    status,
  };
};

const requireAgentProfileForAdmin = async (agentProfileId: number) => {
  const profile = await db.AgentProfile.findByPk(agentProfileId, {
    include: [{ model: db.User, as: 'user', attributes: ['id', 'name', 'email'] }],
  });
  if (!profile) {
    throw new AppError('Agent profile not found', 404);
  }
  return profile;
};

/** Admin approves an agent's signed agreement, unlocking their portal. */
export const approveAgentAgreement = async (agentProfileId: number, adminUserId: string) => {
  const profile = await requireAgentProfileForAdmin(agentProfileId);
  if (profile.agreementStatus === 'approved') {
    return profile.get({ plain: true });
  }
  if (profile.agreementStatus !== 'submitted') {
    throw new AppError(
      'Only submitted agreements can be approved. The agent has not uploaded a signed copy yet.',
      400,
    );
  }
  profile.agreementStatus = 'approved';
  profile.agreementApprovedAt = new Date();
  profile.agreementApprovedByUserId = adminUserId || null;
  profile.agreementRejectionReason = null;
  await profile.save();
  return profile.get({ plain: true });
};

/** Admin rejects an agent's signed agreement; agent can re-upload. */
export const rejectAgentAgreement = async (
  agentProfileId: number,
  adminUserId: string,
  reason?: string | null,
) => {
  const profile = await requireAgentProfileForAdmin(agentProfileId);
  if (profile.agreementStatus !== 'submitted') {
    throw new AppError(
      'Only submitted agreements can be rejected.',
      400,
    );
  }
  profile.agreementStatus = 'rejected';
  profile.agreementApprovedAt = null;
  profile.agreementApprovedByUserId = adminUserId || null;
  profile.agreementRejectionReason =
    typeof reason === 'string' && reason.trim() ? reason.trim().slice(0, 2000) : null;
  await profile.save();
  return profile.get({ plain: true });
};

/**
 * Admin removes the stored signed agreement and resets the workflow to `pending`.
 * The agent must upload a new signed copy and an admin must approve again; the portal locks until approval.
 */
export const deleteAgentAgreement = async (agentProfileId: number) => {
  const profile = await requireAgentProfileForAdmin(agentProfileId);
  const url = profile.signedAgreementUrl;
  if (url && !String(url).trim().startsWith('http')) {
    const abs = path.isAbsolute(url) ? url : path.join(process.cwd(), url);
    if (fs.existsSync(abs)) {
      fs.unlinkSync(abs);
    }
  }
  profile.agreementStatus = 'pending';
  profile.signedAgreementUrl = null;
  profile.agreementUploadedAt = null;
  profile.agreementApprovedAt = null;
  profile.agreementApprovedByUserId = null;
  profile.agreementRejectionReason = null;
  await profile.save();
  return profile.get({ plain: true });
};

export const getDashboardForAdmin = async () => {
  const [userCounts, appStatusRows, paymentPending, agents] = await Promise.all([
    db.User.findAll({
      attributes: ['role', [fn('COUNT', Sequelize.col('User.id')), 'count']],
      group: ['User.role'],
      raw: true,
      subQuery: false,
    }) as unknown as Promise<{ role: string; count: string }[]>,
    db.Application.findAll({
      attributes: ['status', [fn('COUNT', Sequelize.col('Application.id')), 'count']],
      group: ['Application.status'],
      raw: true,
      subQuery: false,
    }) as unknown as Promise<{ status: string; count: string }[]>,
    db.Payment.count({ where: { status: 'pending' } }),
    db.AgentProfile.count(),
  ]);

  return {
    usersByRole: Object.fromEntries(userCounts.map(r => [r.role, parseInt(r.count, 10)])),
    applicationsByStatus: Object.fromEntries(appStatusRows.map(r => [r.status, parseInt(r.count, 10)])),
    pendingPayments: paymentPending,
    agentAccounts: agents,
  };
};

export const listPaymentsForAdmin = async (query: { status?: string; page?: number; limit?: number }) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 30));
  const offset = (page - 1) * limit;
  const where: Record<string, unknown> = {};
  if (query.status) {
    if (!(PAYMENT_STATUSES as readonly string[]).includes(query.status as (typeof PAYMENT_STATUSES)[number])) {
      throw new AppError('Invalid payment status filter', 400);
    }
    where.status = query.status;
  }
  const { rows, count } = await db.Payment.findAndCountAll({
    where,
    include: [
      { model: db.User, as: 'user', attributes: ['id', 'name', 'email'] },
      { model: db.Application, as: 'application', attributes: ['id', 'applicationNumber'], required: false },
      { model: db.AgentProfile, as: 'agentProfile', attributes: ['id', 'agencyName'], required: false },
    ],
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });
  const data = rows.map(p => {
    const plain = p.get ? p.get({ plain: true }) : p;
    const st = (plain as { status?: string }).status;
    const statusUi = st === 'success' ? 'paid' : st;
    return { ...plain, statusUi };
  });
  return { data, page, limit, total: count };
};

export const listCommissionsForAdmin = async () => {
  const rows = await db.Commission.findAll({
    include: [{ model: db.University, as: 'university', attributes: ['id', 'name', 'country'] }],
    order: [['universityId', 'ASC']],
  });
  return rows.map(c => {
    const plain = c.get ? c.get({ plain: true }) : c;
    let parsedSlab: Record<string, unknown> | null = null;
    const raw = (plain as { slabDetails?: string | null }).slabDetails;
    if (raw && typeof raw === 'string' && raw.trim().startsWith('{')) {
      try {
        parsedSlab = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        parsedSlab = null;
      }
    }
    return { ...plain, parsedSlab };
  });
};

export const createCommissionForAdmin = async (body: {
  universityId: number;
  percentage: number;
  slabDetails?: string | null;
}) => {
  const uni = await db.University.findByPk(body.universityId);
  if (!uni) {
    throw new AppError('University not found', 404);
  }
  return db.Commission.create({
    universityId: body.universityId,
    percentage: Number(body.percentage),
    slabDetails: body.slabDetails?.trim() || null,
  });
};

export const updateCommissionForAdmin = async (
  id: number,
  body: Partial<{ percentage: number; slabDetails: string | null }>,
) => {
  const row = await db.Commission.findByPk(id);
  if (!row) {
    throw new AppError('Commission slab not found', 404);
  }
  if (body.percentage !== undefined) {
    row.percentage = Number(body.percentage);
  }
  if (body.slabDetails !== undefined) {
    row.slabDetails = body.slabDetails === null || body.slabDetails === '' ? null : String(body.slabDetails).trim();
  }
  await row.save();
  return row.reload({
    include: [{ model: db.University, as: 'university', attributes: ['id', 'name', 'country'] }],
  });
};

export const deleteCommissionForAdmin = async (id: number) => {
  const row = await db.Commission.findByPk(id);
  if (!row) {
    throw new AppError('Commission slab not found', 404);
  }
  await row.destroy();
};

export const listSubscriptionPlansForAdmin = async () => {
  return db.SubscriptionPlan.findAll({ order: [['id', 'ASC']] });
};

export const createSubscriptionPlanForAdmin = async (body: { name: string; price: number; features?: string | null }) => {
  return db.SubscriptionPlan.create({
    name: body.name.trim(),
    price: body.price,
    features: body.features?.trim() || null,
  });
};

export const updateSubscriptionPlanForAdmin = async (
  id: number,
  body: Partial<{ name: string; price: number; features: string | null }>,
) => {
  const row = await db.SubscriptionPlan.findByPk(id);
  if (!row) {
    throw new AppError('Subscription plan not found', 404);
  }
  if (body.name !== undefined) {
    row.name = String(body.name).trim();
  }
  if (body.price !== undefined) {
    row.price = Number(body.price);
  }
  if (body.features !== undefined) {
    row.features = body.features === null || body.features === '' ? null : String(body.features).trim();
  }
  await row.save();
  return row;
};

export const deleteSubscriptionPlanForAdmin = async (id: number) => {
  const row = await db.SubscriptionPlan.findByPk(id);
  if (!row) {
    throw new AppError('Subscription plan not found', 404);
  }
  await row.destroy();
};

export const createUniversityForAdmin = async (body: { name: string; country: string; status?: boolean }) => {
  return db.University.create({
    name: body.name.trim(),
    country: body.country.trim(),
    status: body.status !== false,
  });
};

export const updateUniversityForAdmin = async (
  id: number,
  body: Partial<{
    name: string;
    country: string;
    status: boolean;
    agreementPackageReference: string | null;
    agreementDispatchedAt: string | Date | null;
    countersignedVerifiedAt: string | Date | null;
  }>,
) => {
  const row = await db.University.findByPk(id);
  if (!row) {
    throw new AppError('University not found', 404);
  }
  if (body.name !== undefined) {
    row.name = String(body.name).trim();
  }
  if (body.country !== undefined) {
    row.country = String(body.country).trim();
  }
  if (body.status !== undefined) {
    row.status = Boolean(body.status);
  }
  if (body.agreementPackageReference !== undefined) {
    const v = body.agreementPackageReference;
    (row as any).agreementPackageReference =
      v === null || v === '' ? null : String(v).trim().slice(0, 120);
  }
  if (body.agreementDispatchedAt !== undefined) {
    const v = body.agreementDispatchedAt;
    (row as any).agreementDispatchedAt =
      v === null || v === '' ? null : v instanceof Date ? v : new Date(String(v));
  }
  if (body.countersignedVerifiedAt !== undefined) {
    const v = body.countersignedVerifiedAt;
    (row as any).countersignedVerifiedAt =
      v === null || v === '' ? null : v instanceof Date ? v : new Date(String(v));
  }
  await row.save();
  return row;
};

export const deleteUniversityForAdmin = async (id: number) => {
  const row = await db.University.findByPk(id);
  if (!row) {
    throw new AppError('University not found', 404);
  }
  await row.destroy();
};

export const adminGlobalSearch = async (q: string) => {
  if (!q.trim()) {
    return { applications: [], users: [], universities: [] };
  }
  const qq = `%${q.trim()}%`;

  const applications = await db.Application.findAll({
    where: {
      [Op.or]: [
        { universityName: { [Op.iLike]: qq } },
        { programName: { [Op.iLike]: qq } },
        { applicationNumber: { [Op.iLike]: qq } },
      ],
    },
    limit: 15,
    attributes: ['id', 'applicationNumber', 'universityName', 'programName', 'status'],
  });

  const users = await db.User.findAll({
    where: {
      [Op.or]: [{ name: { [Op.iLike]: qq } }, { email: { [Op.iLike]: qq } }],
    },
    limit: 15,
    attributes: ['id', 'name', 'email', 'role'],
  });

  const universities = await db.University.findAll({
    where: { name: { [Op.iLike]: qq } },
    limit: 10,
    attributes: ['id', 'name', 'country'],
  });

  return { applications, users, universities };
};

export const syncChatKnowledgeForAdmin = async () => syncKnowledgeBase();

export const syncRecommendationKnowledgeForAdmin = async () => {
  const { syncRecommendationKnowledgeBase } = await import('../src/modules/recommendations/recommendation-knowledge-sync.service');
  return syncRecommendationKnowledgeBase();
};

export const patchStudentCounsellingForAdmin = async (studentProfileId: number, counsellingCompleted: boolean) => {
  const row = await db.StudentProfile.findByPk(studentProfileId);
  if (!row) {
    throw new AppError('Student profile not found', 404);
  }
  row.counsellingCompletedAt = counsellingCompleted ? new Date() : null;
  await row.save();
  return row.get({ plain: true });
};

export const getRolesMetadataForAdmin = () => ({
  roles: [...USER_ROLES],
  descriptions: {
    student: 'Student applicant',
    agent: 'Recruitment partner / agency',
    admin: 'Platform administrator',
    university: 'Institution portal user',
  },
});

export const listActivityLogsForAdmin = async (query: {
  page?: string | number;
  limit?: string | number;
  search?: string;
  role?: string;
  userId?: string;
  module?: string;
  action?: string;
  status?: string;
  method?: string;
  startDate?: string;
  endDate?: string;
}) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(query.limit) || 50));
  const offset = (page - 1) * limit;

  const andParts: any[] = [];

  // Global search
  if (query.search?.trim()) {
    const q = `%${query.search.trim()}%`;
    andParts.push({
      [Op.or]: [
        { fullName: { [Op.iLike]: q } },
        { email: { [Op.iLike]: q } },
        { activity: { [Op.iLike]: q } },
        { endpoint: { [Op.iLike]: q } },
        { entityName: { [Op.iLike]: q } },
        { ipAddress: { [Op.iLike]: q } },
      ],
    });
  }

  // Filter by role
  if (query.role && query.role !== 'all') {
    andParts.push({ role: query.role });
  }

  // Filter by user ID
  if (query.userId && query.userId !== 'all') {
    andParts.push({ userId: query.userId });
  }

  // Filter by module
  if (query.module && query.module !== 'all') {
    andParts.push({ module: query.module });
  }

  // Filter by action
  if (query.action && query.action !== 'all') {
    andParts.push({ action: query.action });
  }

  // Filter by status
  if (query.status && query.status !== 'all') {
    andParts.push({ status: query.status });
  }

  // Filter by HTTP method
  if (query.method && query.method !== 'all') {
    andParts.push({ method: query.method.toUpperCase() });
  }

  // Filter by date range
  if (query.startDate) {
    andParts.push({
      createdAt: { [Op.gte]: new Date(query.startDate) },
    });
  }
  if (query.endDate) {
    const end = new Date(query.endDate);
    end.setHours(23, 59, 59, 999);
    andParts.push({
      createdAt: { [Op.lte]: end },
    });
  }

  const where = andParts.length ? { [Op.and]: andParts } : {};

  const { rows, count } = await db.ActivityLog.findAndCountAll({
    where,
    include: [{ model: db.User, as: 'user', attributes: ['id', 'name', 'email', 'role'] }],
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });

  return { data: rows, page, limit, total: count };
};
