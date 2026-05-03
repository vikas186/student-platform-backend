import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const generateUniqueName = (originalname: any) => {
  const ext = path.extname(originalname);
  const uniqueSuffix = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  return `${uniqueSuffix}${ext}`;
};

const cleanupTempFiles = (attachments: any, tempFolder: any) => {
  attachments.forEach(({ filename }: { filename: string }) => {
    const filePath = path.join(tempFolder, filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  });
};

export { generateUniqueName, cleanupTempFiles };
