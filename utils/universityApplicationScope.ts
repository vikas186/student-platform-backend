import { Op, Sequelize } from 'sequelize';
import AppError from './errorHandler';

/**
 * Applications visible to an institution: linked via `Course.universityId`, or free-text `universityName`
 * when `courseId` is null (same rules as the university portal).
 */
export const applicationScopeForUniversity = (universityId: number, universityName: string) => {
  const uid = Number(universityId);
  if (!Number.isFinite(uid) || uid < 1) {
    throw new AppError('Invalid university scope', 400);
  }
  return {
    [Op.or]: [
      Sequelize.literal(
        `(EXISTS (SELECT 1 FROM courses AS c WHERE c.id = "Application"."course_id" AND c.university_id = ${uid}))`,
      ),
      {
        [Op.and]: [
          { courseId: { [Op.is]: null } },
          { universityName: { [Op.iLike]: `%${universityName}%` } },
        ],
      },
    ],
  };
};

/** Same scope when `Application` is included as alias `application`. */
export const applicationScopeOnIncludedApplicationForUniversity = (
  universityId: number,
  universityName: string,
) => {
  const uid = Number(universityId);
  return {
    [Op.or]: [
      Sequelize.literal(
        `(EXISTS (SELECT 1 FROM courses AS c WHERE c.id = "application"."course_id" AND c.university_id = ${uid}))`,
      ),
      {
        [Op.and]: [
          { courseId: { [Op.is]: null } },
          { universityName: { [Op.iLike]: `%${universityName}%` } },
        ],
      },
    ],
  };
};
