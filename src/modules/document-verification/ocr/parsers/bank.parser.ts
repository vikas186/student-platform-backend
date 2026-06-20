export type ParsedBankFields = {
  accountHolderName: string | null;
  bankName: string | null;
  statementDate: string | null;
  openingBalance: string | null;
  closingBalance: string | null;
};

const parseDate = (raw: string | null): string | null => {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
};

export const parseBankText = (text: string): ParsedBankFields => {
  const joined = text.replace(/\s+/g, ' ');

  let accountHolderName: string | null = null;
  const holderMatch = joined.match(
    /(?:account\s*holder|customer\s*name|name\s*of\s*account\s*holder|holder)\s*[:\-]\s*([A-Za-z .]{3,80})/i,
  );
  if (holderMatch?.[1]) accountHolderName = holderMatch[1].trim();

  let bankName: string | null = null;
  const bankMatch = joined.match(/(?:bank\s*name|bank)\s*[:\-]\s*([A-Za-z0-9 .,&\-()]{3,80})/i);
  if (bankMatch?.[1]) bankName = bankMatch[1].trim();

  let statementDate: string | null = null;
  const dateMatch = joined.match(
    /(?:statement\s*date|period|as\s*on|date)\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/i,
  );
  if (dateMatch?.[1]) statementDate = parseDate(dateMatch[1]);

  let openingBalance: string | null = null;
  let closingBalance: string | null = null;
  const openMatch = joined.match(/(?:opening\s*balance|opening)\s*[:\-]?\s*(?:INR|Rs\.?|₹)?\s*([\d,]+(?:\.\d{2})?)/i);
  if (openMatch?.[1]) openingBalance = openMatch[1];
  const closeMatch = joined.match(/(?:closing\s*balance|closing|balance)\s*[:\-]?\s*(?:INR|Rs\.?|₹)?\s*([\d,]+(?:\.\d{2})?)/i);
  if (closeMatch?.[1]) closingBalance = closeMatch[1];

  return { accountHolderName, bankName, statementDate, openingBalance, closingBalance };
};

export const isStatementWithinDays = (statementDate: string | null, maxDays: number): boolean => {
  if (!statementDate) return false;
  const d = new Date(statementDate);
  if (Number.isNaN(d.getTime())) return false;
  const diffMs = Date.now() - d.getTime();
  return diffMs >= 0 && diffMs <= maxDays * 24 * 60 * 60 * 1000;
};
