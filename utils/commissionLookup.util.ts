import { db } from '../config/database';

export type CommissionByUniversity = {
  universityId: number;
  universityName: string;
  percentage: number;
};

/** Latest admin Commission row per university (id DESC). */
export const fetchLatestCommissionByUniversity = async (): Promise<Map<number, CommissionByUniversity>> => {
  const rows = await db.Commission.findAll({
    include: [{ model: db.University, as: 'university', attributes: ['id', 'name'] }],
    order: [['id', 'DESC']],
  });

  const m = new Map<number, CommissionByUniversity>();
  for (const row of rows) {
    if (m.has(row.universityId)) continue;
    const plain = row.get({ plain: true }) as {
      universityId: number;
      percentage: number;
      university?: { name: string };
    };
    m.set(row.universityId, {
      universityId: plain.universityId,
      universityName: plain.university?.name ?? `University ${plain.universityId}`,
      percentage: Number(plain.percentage),
    });
  }
  return m;
};
