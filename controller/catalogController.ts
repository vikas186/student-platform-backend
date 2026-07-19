import { Request, Response } from 'express';
import { db } from '../config/database';
import { catchAsyncError } from '../middleware/catchAsyncError';
import constant from '../constant';
import { listPublicCatalogCountries, listPublicUniversitiesWithPrograms } from '../services/catalogPublic.service';

export const listUniversities = catchAsyncError(async (_req: Request, res: Response) => {
  const rows = await db.University.findAll({ order: [['id', 'ASC']] });
  res.status(constant.msgCode.successCode).json({
    success: true,
    data: rows,
  });
});

export const listPublicCatalogCountriesHandler = catchAsyncError(async (_req: Request, res: Response) => {
  const data = await listPublicCatalogCountries();
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Catalog countries fetched',
    data,
  });
});

export const listPublicUniversitiesWithProgramsHandler = catchAsyncError(
  async (req: Request, res: Response) => {
    const data = await listPublicUniversitiesWithPrograms(req.query as Record<string, string | undefined>);
    res.status(constant.msgCode.successCode).json({
      success: true,
      message: 'Universities with programs fetched',
      data,
    });
  },
);

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
