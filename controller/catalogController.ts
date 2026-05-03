import { Request, Response } from 'express';
import { db } from '../config/database';
import { catchAsyncError } from '../middleware/catchAsyncError';
import constant from '../constant';

export const listUniversities = catchAsyncError(async (_req: Request, res: Response) => {
  const rows = await db.University.findAll({ order: [['id', 'ASC']] });
  res.status(constant.msgCode.successCode).json({
    success: true,
    data: rows,
  });
});

export const listCourses = catchAsyncError(async (req: Request, res: Response) => {
  const { universityId } = req.query;
  const where = universityId ? { universityId: Number(universityId) } : {};
  const rows = await db.Course.findAll({
    where,
    include: [{ model: db.University, as: 'university', attributes: ['id', 'name', 'country'] }],
    order: [['id', 'ASC']],
  });
  res.status(constant.msgCode.successCode).json({
    success: true,
    data: rows,
  });
});
