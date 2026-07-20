import { Op } from 'sequelize';
import { db } from '../config/database';
import { formatAgentMembershipId } from '../utils/agentMembershipId';

type AgentProfileRow = InstanceType<typeof db.AgentProfile>;

/** Assign AGT-xxxxx from profile PK if missing. */
export const ensureAgentMembershipId = async (
  profile: AgentProfileRow,
): Promise<AgentProfileRow> => {
  const existing = String(profile.membershipId ?? '').trim();
  if (existing) return profile;
  const next = formatAgentMembershipId(profile.id);
  profile.membershipId = next;
  await profile.save();
  return profile;
};

/** Backfill all agent profiles missing a membership ID (idempotent). */
export const backfillAgentMembershipIds = async (): Promise<number> => {
  const rows = await db.AgentProfile.findAll({
    where: {
      [Op.or]: [{ membershipId: null }, { membershipId: '' }],
    },
  });
  let n = 0;
  for (const row of rows) {
    await ensureAgentMembershipId(row);
    n += 1;
  }
  return n;
};
