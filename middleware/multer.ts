import multer, { StorageEngine, FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';

// Set storage for uploaded files
const storage: StorageEngine = multer.diskStorage({
  destination: (req: any, file: Express.Multer.File, cb: (error: any, destination: string) => void): void => {
    const fileType = file.mimetype.split('/')[0];
    const uploadPath = `uploads/${fileType}s/`;
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req: any, file: Express.Multer.File, cb: (error: any, filename: string) => void): void => {
    const uniqueName = `${Date.now()}-${file.fieldname}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// Multer configuration
const upload = multer({
  storage,
  limits: {
    fileSize: 45 * 1024 * 1024, // 45MB
  },
  fileFilter: (req: any, file: Express.Multer.File, cb: FileFilterCallback): void => {
    const allowedExtensions = /\.(jpg|jpeg|png|pdf|mp3|mp4|mov|mkv|flv|csv)$/i;

    if (!file.originalname.match(allowedExtensions)) {
      return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Invalid file type.'));
    }
    cb(null, true);
  },
});

/** Student portal: PDF / images only, max 1 MB (matches Enroll UI). */
const studentDocStorage: StorageEngine = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadPath = 'uploads/student-documents/';
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const studentDocumentUpload = multer({
  storage: studentDocStorage,
  limits: { fileSize: 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/\.(pdf|jpg|jpeg|png)$/i.test(file.originalname)) {
      return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Only PDF, JPG, or PNG files are allowed.'));
    }
    cb(null, true);
  },
});

/** Agent portal documents / offers: PDF or images, max 5 MB */
const agentPortalDocStorage: StorageEngine = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadPath = 'uploads/agent-documents/';
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const agentDocumentUpload = multer({
  storage: agentPortalDocStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/\.(pdf|jpg|jpeg|png)$/i.test(file.originalname)) {
      return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Only PDF, JPG, or PNG files are allowed.'));
    }
    cb(null, true);
  },
});

export { upload, studentDocumentUpload, agentDocumentUpload };
