import fs from 'fs';
import path from 'path';
import { createWorker } from 'tesseract.js';

export type OcrResult = {
  text: string;
  confidence: number;
};

const isPdf = (filePath: string): boolean => /\.pdf$/i.test(filePath);

const extractPdfText = async (absolutePath: string): Promise<OcrResult | null> => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text?: string }>;
    const buf = fs.readFileSync(absolutePath);
    const data = await pdfParse(buf);
    const text = (data.text ?? '').trim();
    if (!text) return null;
    return { text, confidence: 92 };
  } catch {
    return null;
  }
};

const extractImageText = async (absolutePath: string): Promise<OcrResult> => {
  const worker = await createWorker('eng');
  try {
    const result = await worker.recognize(absolutePath);
    const text = result.data.text?.trim() ?? '';
    const confidence = typeof result.data.confidence === 'number' ? result.data.confidence : 0;
    return { text, confidence };
  } finally {
    await worker.terminate();
  }
};

export const resolveAbsolutePath = (fileUrl: string): string => {
  const normalized = fileUrl.replace(/\\/g, '/');
  if (path.isAbsolute(normalized)) return normalized;
  return path.join(process.cwd(), normalized);
};

export const runOcrOnFile = async (fileUrl: string): Promise<OcrResult> => {
  const absolutePath = resolveAbsolutePath(fileUrl);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found for OCR: ${absolutePath}`);
  }

  if (isPdf(absolutePath)) {
    const pdfResult = await extractPdfText(absolutePath);
    if (pdfResult?.text) return pdfResult;
    console.warn('[doc-verify] PDF has no text layer; OCR on scanned PDFs may be limited');
    return { text: '', confidence: 0 };
  }

  return extractImageText(absolutePath);
};
