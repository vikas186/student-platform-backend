import type { RawCourseRow } from './types';
import { isRealCourse } from '../validators/is-real-course.util';

export type CapturedApiResponse = { url: string; body: string };

const SKIP_API_URL_RE =
  /google-analytics|googletagmanager|facebook|doubleclick|hotjar|sentry|clarity|segment|intercom|webpack|chunk\.js|favicon|\.woff|\.png|\.svg|\.css/i;

const DATA_API_URL_RE =
  /\/api\/|graphql|\.json(\?|$)|program|course|university|academic|degree|catalog|search|listing|cms|aeccglobal|scholarship/i;

const NAME_KEYS = new Set(['name', 'title', 'coursename', 'course_name', 'programname', 'program_name', 'degree', 'major']);
const UNI_KEYS = new Set(['university', 'universityname', 'university_name', 'institution', 'school']);
const COUNTRY_KEYS = new Set(['country', 'destination', 'nation']);
const CITY_KEYS = new Set(['city', 'location']);
const LEVEL_KEYS = new Set(['degreelevel', 'degree_level', 'level', 'studylevel', 'study_level']);
const DURATION_KEYS = new Set(['duration', 'timerequired', 'length']);
const TUITION_KEYS = new Set(['tuition', 'tuitionfee', 'tuition_fee', 'fees', 'price', 'cost']);
const INTAKE_KEYS = new Set(['intake', 'startdate', 'start_date', 'commencement']);
const REQ_KEYS = new Set(['requirements', 'entryrequirements', 'eligibility', 'academicrequirement']);
const IELTS_KEYS = new Set(['ielts', 'englishrequirement', 'english_requirement', 'language']);
const URL_KEYS = new Set(['url', 'link', 'href', 'courseurl', 'course_url', 'permalink']);

const asString = (v: unknown): string => {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  return '';
};

const pickField = (obj: Record<string, unknown>, keys: Set<string>): string => {
  for (const [k, v] of Object.entries(obj)) {
    if (keys.has(k.toLowerCase().replace(/[\s-]/g, '_'))) return asString(v);
  }
  return '';
};

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

export const shouldCaptureApiResponse = (url: string, contentType: string, body: string): boolean => {
  if (SKIP_API_URL_RE.test(url)) return false;
  if (!contentType.includes('json') && !url.includes('graphql')) return false;
  if (body.length < 80 || body.length > 500_000) return false;
  if (DATA_API_URL_RE.test(url)) return true;
  if (body.includes('"course') || body.includes('"program')) return true;
  return body.length >= 400 && body.length <= 120_000;
};

const mapObjectToCourse = (obj: Record<string, unknown>, pageUrl: string): RawCourseRow | null => {
  const courseName = pickField(obj, NAME_KEYS);
  if (!courseName || courseName.length < 3) return null;

  const universityName = pickField(obj, UNI_KEYS) || 'Unknown University';
  const courseUrl = pickField(obj, URL_KEYS);

  return {
    universityName,
    courseName,
    country: pickField(obj, COUNTRY_KEYS) || undefined,
    city: pickField(obj, CITY_KEYS) || undefined,
    studyLevel: pickField(obj, LEVEL_KEYS) || undefined,
    duration: pickField(obj, DURATION_KEYS) || undefined,
    tuitionFee: pickField(obj, TUITION_KEYS) || undefined,
    intake: pickField(obj, INTAKE_KEYS) || undefined,
    academicRequirement: pickField(obj, REQ_KEYS) || undefined,
    ieltsRequirement: pickField(obj, IELTS_KEYS) || undefined,
    courseUrl: courseUrl || pageUrl,
  };
};

const looksLikeCourse = (obj: Record<string, unknown>): boolean => {
  const name = pickField(obj, NAME_KEYS);
  if (name.length < 8) return false;
  const url = pickField(obj, URL_KEYS);
  return isRealCourse(name, url);
};

const walkJson = (node: unknown, pageUrl: string, acc: RawCourseRow[], seen: Set<string>, depth = 0): void => {
  if (depth > 14 || node == null) return;
  if (Array.isArray(node)) {
    for (const item of node) walkJson(item, pageUrl, acc, seen, depth + 1);
    return;
  }
  if (!isPlainObject(node)) return;

  if (looksLikeCourse(node)) {
    const row = mapObjectToCourse(node, pageUrl);
    if (row && isRealCourse(row.courseName, row.courseUrl || pageUrl)) {
      const key = `${row.universityName}::${row.courseName}::${row.courseUrl || ''}`.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        acc.push(row);
      }
    }
  }
  for (const v of Object.values(node)) walkJson(v, pageUrl, acc, seen, depth + 1);
};

export const extractCoursesFromApiResponses = (
  responses: CapturedApiResponse[],
  pageUrl: string,
): RawCourseRow[] => {
  const courses: RawCourseRow[] = [];
  const seen = new Set<string>();
  for (const res of responses) {
    try {
      walkJson(JSON.parse(res.body), pageUrl, courses, seen);
    } catch {
      /* skip */
    }
  }
  return courses;
};
