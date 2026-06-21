import { Op } from 'sequelize';
import type { Model } from 'sequelize';
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

function toIso(value: unknown): string | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function toDto(row: Model): NoticeItemDto {
  const p = row.get({ plain: true }) as Record<string, unknown>;
  return {
    id: Number(p.id),
    title: String(p.title ?? ''),
    source: String(p.source ?? ''),
    href: p.href != null ? String(p.href) : null,
    sourceUrl: p.sourceUrl != null ? String(p.sourceUrl) : null,
    generatedBy: String(p.generatedBy ?? 'ai'),
    expiresAt: toIso(p.expiresAt),
    sortOrder: Number(p.sortOrder ?? 0),
    isActive: Boolean(p.isActive),
    createdAt: toIso(p.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(p.updatedAt) ?? new Date().toISOString(),
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
  return rows.map(r => toDto(r));
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
    data: rows.map(r => toDto(r)),
    page,
    limit,
    total: count,
    totalPages: Math.max(1, Math.ceil(count / limit)),
  };
}
