import { Op } from 'sequelize';
import { db } from '../../../config/database';

export type NoticeItemDto = {
  id: number;
  title: string;
  source: string;
  href: string | null;
  sourceUrl: string | null;
  generatedBy: string;
  expiresAt: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

function toDto(row: {
  id: number;
  title: string;
  source: string;
  href?: string | null;
  sourceUrl?: string | null;
  generatedBy?: string;
  expiresAt?: Date | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): NoticeItemDto {
  return {
    id: row.id,
    title: row.title,
    source: row.source,
    href: row.href ?? null,
    sourceUrl: row.sourceUrl ?? null,
    generatedBy: row.generatedBy ?? 'ai',
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listActiveNotices(): Promise<NoticeItemDto[]> {
  const rows = await db.NoticeTickerItem.findAll({
    where: { isActive: true },
    order: [
      ['sortOrder', 'ASC'],
      ['id', 'ASC'],
    ],
  });
  return rows.map(r => toDto(r as any));
}

export async function listAdminNotices(query: {
  q?: string;
  includeInactive?: boolean;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 50));
  const offset = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (!query.includeInactive) {
    where.isActive = true;
  }
  const q = query.q?.trim();
  if (q) {
    (where as any)[Op.or] = [
      { title: { [Op.iLike]: `%${q}%` } },
      { source: { [Op.iLike]: `%${q}%` } },
    ];
  }

  const { rows, count } = await db.NoticeTickerItem.findAndCountAll({
    where,
    order: [
      ['sortOrder', 'ASC'],
      ['id', 'ASC'],
    ],
    limit,
    offset,
  });

  return {
    data: rows.map(r => toDto(r as any)),
    page,
    limit,
    total: count,
    totalPages: Math.max(1, Math.ceil(count / limit)),
  };
}
