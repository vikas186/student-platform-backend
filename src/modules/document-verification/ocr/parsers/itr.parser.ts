export type ParsedItrFields = {
  pan: string | null;
  taxpayerName: string | null;
  assessmentYear: string | null;
  totalIncome: string | null;
};

export const parseItrText = (text: string): ParsedItrFields => {
  const joined = text.replace(/\s+/g, ' ');

  let pan: string | null = null;
  const panMatch = joined.match(/\b([A-Z]{5}[0-9]{4}[A-Z])\b/);
  if (panMatch?.[1]) pan = panMatch[1];

  let taxpayerName: string | null = null;
  const nameMatch = joined.match(/(?:name|taxpayer|assessee)\s*[:\-]\s*([A-Za-z .]{3,80})/i);
  if (nameMatch?.[1]) taxpayerName = nameMatch[1].trim();

  let assessmentYear: string | null = null;
  const ayMatch = joined.match(/(?:assessment\s*year|A\.?Y\.?)\s*[:\-]?\s*((?:19|20)\d{2}[-–\/](?:19|20)\d{2}|\d{4}[-–\/]\d{2})/i);
  if (ayMatch?.[1]) assessmentYear = ayMatch[1];

  let totalIncome: string | null = null;
  const incomeMatch = joined.match(
    /(?:total\s*income|gross\s*total\s*income|net\s*income)\s*[:\-]?\s*(?:INR|Rs\.?|₹)?\s*([\d,]+(?:\.\d{2})?)/i,
  );
  if (incomeMatch?.[1]) totalIncome = incomeMatch[1];

  return { pan, taxpayerName, assessmentYear, totalIncome };
};
