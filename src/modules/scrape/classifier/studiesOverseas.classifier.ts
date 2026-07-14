import { scrapeLogger } from '../logger';
import type { ClassificationResult, PageType } from '../extractors/types';
import { classifyPage } from './page.classifier';

export type StudiesOverseasClassificationResult = ClassificationResult & {
  confidence: number;
};

const emptyScores = (): Record<PageType, number> => ({
  course: 0,
  course_listing: 0,
  university: 0,
  fee: 0,
  scholarship: 0,
  reject: 0,
});

const isRejectPage = (url: string, title: string, content: string): boolean => {
  const checkText = `${url} ${title} ${content}`.toLowerCase();
  const rejectKeywords = [
    '404',
    'access denied',
    'captcha',
    'cloudflare',
    'robots blocked',
    'page not found',
    'login required',
    'maintenance',
    'privacy policy',
    'terms and conditions',
    'cookie policy',
    'contact us',
    'contact page',
    'careers',
    '/contact',
    '/privacy',
    '/terms',
    '/cookie',
  ];
  return rejectKeywords.some(kw => checkText.includes(kw));
};

const logClassification = (
  rule: string,
  classification: string,
  confidence: number,
  reason?: string,
) => {
  scrapeLogger.info('[StudiesOverseasClassifier]', {
    Matched: rule,
    Classification: classification,
    Confidence: confidence,
    Reason: reason,
  });
};

export const classifyStudiesOverseasPage = (
  url: string,
  title: string,
  content: string,
): StudiesOverseasClassificationResult => {
  // Reject checks take priority
  if (isRejectPage(url, title, content)) {
    const scores = { ...emptyScores(), reject: 100 };
    logClassification('Reject Rule', 'reject', 1.0, 'Page matches reject keywords/paths');
    return {
      type: 'reject',
      scores,
      confidence: 1.0,
      reason: 'Rejection keywords matched',
    };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch (err) {
    const fallbackRes = classifyPage(url, title, content);
    logClassification(
      'Fallback Generic (URL parse fail)',
      fallbackRes.type,
      0.5,
      'Failed to parse URL, falling back to generic classifier',
    );
    return {
      ...fallbackRes,
      confidence: 0.5,
    };
  }

  const path = parsedUrl.pathname.toLowerCase().replace(/\/+$/, '');
  const searchParams = parsedUrl.searchParams;
  const section = searchParams.get('section')?.toLowerCase() || '';

  // Rule 1: Listing Page
  if (/^\/universities(?:\/page-\d+)?$/.test(path)) {
    const scores = { ...emptyScores(), course_listing: 100 };
    logClassification('Rule 1', 'course_listing', 1.0, 'University Listing Page');
    return {
      type: 'course_listing',
      scores,
      confidence: 1.0,
    };
  }

  // Rule 3: Courses section
  if (section === 'courses') {
    const scores = { ...emptyScores(), course: 100 };
    logClassification('Rule 3', 'course', 1.0, 'Courses section of university');
    return {
      type: 'course',
      scores,
      confidence: 1.0,
    };
  }

  // Rule 4: Scholarships section
  if (section === 'scholarships') {
    const scores = { ...emptyScores(), scholarship: 100 };
    logClassification('Rule 4', 'scholarship', 1.0, 'Scholarships section of university');
    return {
      type: 'scholarship',
      scores,
      confidence: 1.0,
    };
  }

  // Rule 5: Cost to Study section
  if (section === 'costtostudy') {
    const scores = { ...emptyScores(), fee: 100 };
    logClassification('Rule 5', 'fee', 1.0, 'Cost to Study section of university');
    return {
      type: 'fee',
      scores,
      confidence: 1.0,
    };
  }

  // Rule 6: Admissions section
  if (section === 'admissions') {
    const scores = { ...emptyScores(), university: 100 };
    logClassification('Rule 6', 'university', 1.0, 'Admissions belong to university profile');
    return {
      type: 'university',
      scores,
      confidence: 1.0,
    };
  }

  // Rule 2: University Detail (without section parameter)
  if (/^\/universities\/[^/]+\/[^/]+$/.test(path)) {
    const scores = { ...emptyScores(), university: 100 };
    logClassification('Rule 2', 'university', 1.0, 'University detail page');
    return {
      type: 'university',
      scores,
      confidence: 1.0,
    };
  }

  // Fallback to generic classifier
  const fallbackRes = classifyPage(url, title, content);
  logClassification('Fallback Generic', fallbackRes.type, 0.5, 'No deterministic rules matched');
  return {
    ...fallbackRes,
    confidence: 0.5,
  };
};
