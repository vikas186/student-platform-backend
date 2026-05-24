import { extractCoursesFromApiResponses } from '../scrapers/api-course-extract.util';
import type { PageCapture, RawCourseRow } from './types';
import { extractCountryHint, extractTitleFromText, firstMatch } from './text-parse.util';

export const extractCourse = (page: PageCapture): RawCourseRow | null => {
  const fromApi = extractCoursesFromApiResponses(page.apiResponses, page.url);
  if (fromApi.length) return fromApi[0];

  const title = page.title || extractTitleFromText(page.mainText);
  if (!title || title.length < 4) return null;

  const country = extractCountryHint(page.url, page.mainText);
  const duration = firstMatch(page.mainText, [
    /duration[:\s]+([^.;\n]{3,60})/i,
    /(\d+\s*(?:year|years|month|months|semester)s?)/i,
  ]);
  const tuitionFee = firstMatch(page.mainText, [
    /tuition(?: fee)?s?[:\s]+([^.;\n]{3,80})/i,
    /(?:fee|fees)[:\s]+([$£€]?\s?[\d,.]+(?:\s?(?:USD|AUD|GBP|CAD|INR))?[^.\n]{0,30})/i,
  ]);
  const intake = firstMatch(page.mainText, [/intake[:\s]+([^.;\n]{3,80})/i, /start date[:\s]+([^.;\n]{3,60})/i]);
  const studyLevel = firstMatch(page.mainText, [
    /\b(Bachelor|Master|MBA|MSc|BSc|PhD|Diploma|Undergraduate|Postgraduate)\b/i,
  ]);
  const universityName =
    firstMatch(page.mainText, [
      /(?:university|institution|college)[:\s]+([A-Z][^.;\n]{3,120})/i,
      /at\s+([A-Z][A-Za-z\s&'.-]{5,80}University)/,
    ]) || 'Unknown University';

  const academicRequirement = firstMatch(page.mainText, [
    /(?:entry|admission|academic) requirements?[:\s]+([^.]{20,500})/i,
  ]);
  const ieltsRequirement = firstMatch(page.mainText, [/IELTS[:\s]+([^.;\n]{3,60})/i]);

  if (!duration && !tuitionFee && !studyLevel && !academicRequirement) return null;

  return {
    universityName,
    courseName: title,
    country,
    studyLevel,
    duration,
    tuitionFee,
    intake,
    ieltsRequirement,
    academicRequirement,
    courseUrl: page.url,
  };
};
