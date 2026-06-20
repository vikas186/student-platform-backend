export type ParsedAcademicFields = {
  studentName: string | null;
  institutionName: string | null;
  degree: string | null;
  course: string | null;
  passingYear: string | null;
  cgpa: string | null;
};

export const parseAcademicText = (text: string): ParsedAcademicFields => {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const joined = text.replace(/\s+/g, ' ');

  const yearMatch = joined.match(/\b(19|20)\d{2}\b/g);
  const passingYear = yearMatch?.length ? yearMatch[yearMatch.length - 1] : null;

  const cgpaMatch =
    joined.match(/\b(?:CGPA|GPA|G\.P\.A\.?|Percentage|Marks?)\s*[:\-]?\s*([\d.]+%?)/i) ??
    joined.match(/\b(\d{1,2}(?:\.\d{1,2})?)\s*(?:%|CGPA|GPA)\b/i);
  const cgpa = cgpaMatch?.[1] ?? null;

  let studentName: string | null = null;
  const namePatterns = [
    /(?:name|student\s*name|candidate)\s*[:\-]\s*([A-Za-z .]{3,80})/i,
    /^([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){1,4})$/,
  ];
  for (const line of lines) {
    for (const pat of namePatterns) {
      const m = line.match(pat);
      if (m?.[1]) {
        studentName = m[1].trim();
        break;
      }
    }
    if (studentName) break;
  }

  let institutionName: string | null = null;
  const instMatch = joined.match(
    /(?:university|college|institution|school|board)\s*[:\-]?\s*([A-Za-z0-9 .,&\-()]{4,120})/i,
  );
  if (instMatch?.[1]) institutionName = instMatch[1].trim();

  let degree: string | null = null;
  const degreeMatch = joined.match(
    /\b(B\.?Tech|M\.?Tech|B\.?Sc|M\.?Sc|B\.?A|M\.?A|B\.?Com|MBA|BCA|MCA|Diploma|Bachelor|Master|Ph\.?D)\b/i,
  );
  if (degreeMatch?.[0]) degree = degreeMatch[0];

  let course: string | null = null;
  const courseMatch = joined.match(/(?:course|program|specialization)\s*[:\-]\s*([A-Za-z0-9 .,&\-()]{3,80})/i);
  if (courseMatch?.[1]) course = courseMatch[1].trim();

  return { studentName, institutionName, degree, course, passingYear, cgpa };
};

export const academicHasRequiredFields = (fields: ParsedAcademicFields): boolean =>
  Boolean(fields.studentName && (fields.institutionName || fields.degree || fields.course) && fields.passingYear);
