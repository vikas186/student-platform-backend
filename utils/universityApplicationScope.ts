import { Op, Sequelize } from 'sequelize';
import AppError from './errorHandler';

/**
 * Applications visible to an institution: linked via `Course.universityId`,
 * exact free-text `universityName` match, or legacy null-course ILIKE match.
 */
export const applicationScopeForUniversity = (universityId: number, universityName: string) => {
  const uid = Number(universityId);
  if (!Number.isFinite(uid) || uid < 1) {
    throw new AppError('Invalid university scope', 400);
  }
  const name = universityName.trim();
  return {
    [Op.or]: [
      Sequelize.literal(
        `(EXISTS (SELECT 1 FROM courses AS c WHERE c.id = "Application"."course_id" AND c.university_id = ${uid}))`,
      ),
      ...(name
        ? [
            { universityName: { [Op.iLike]: name } },
            {
              [Op.and]: [
                { courseId: { [Op.is]: null } },
                { universityName: { [Op.iLike]: `%${name}%` } },
              ],
            },
          ]
        : []),
    ],
  };
};

/** Same scope when `Application` is included as alias `application`. */
export const applicationScopeOnIncludedApplicationForUniversity = (
  universityId: number,
  universityName: string,
) => {
  const uid = Number(universityId);
  const name = universityName.trim();
  return {
    [Op.or]: [
      Sequelize.literal(
        `(EXISTS (SELECT 1 FROM courses AS c WHERE c.id = "application"."course_id" AND c.university_id = ${uid}))`,
      ),
      ...(name
        ? [
            { universityName: { [Op.iLike]: name } },
            {
              [Op.and]: [
                { courseId: { [Op.is]: null } },
                { universityName: { [Op.iLike]: `%${name}%` } },
              ],
            },
          ]
        : []),
    ],
  };
};
