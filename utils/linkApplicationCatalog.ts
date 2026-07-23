import { Op } from 'sequelize';
import { db } from '../config/database';

export type CatalogLink = {
  universityId: number | null;
  courseId: number | null;
  country: string | null;
  universityName: string | null;
};

const normalizeName = (value: string | null | undefined): string =>
  typeof value === 'string' ? value.trim() : '';

/**
 * Resolve catalog university + course for an application so university portal
 * scoping (course.universityId) and partner notifications work reliably.
 */
export const resolveCatalogLink = async (opts: {
  courseId?: number | null;
  universityName?: string | null;
  programName?: string | null;
}): Promise<CatalogLink> => {
  const programName = normalizeName(opts.programName);
  const universityName = normalizeName(opts.universityName);
  const requestedCourseId =
    opts.courseId != null && Number.isFinite(Number(opts.courseId)) && Number(opts.courseId) > 0
      ? Number(opts.courseId)
      : null;

  if (requestedCourseId) {
    const course = await db.Course.findByPk(requestedCourseId, {
      include: [{ model: db.University, as: 'university', attributes: ['id', 'name', 'country', 'status'] }],
    });
    if (course) {
      const uni = (course as { university?: { id: number; name: string; country: string; status: boolean } })
        .university;
      if (uni && uni.status !== false) {
        return {
          universityId: uni.id,
          courseId: course.id,
          country: uni.country?.trim() || null,
          universityName: uni.name?.trim() || universityName || null,
        };
      }
    }
  }

  if (!universityName) {
    return { universityId: null, courseId: null, country: null, universityName: null };
  }

  let uni = await db.University.findOne({
    where: { name: { [Op.iLike]: universityName }, status: true },
    attributes: ['id', 'name', 'country'],
  });

  if (!uni) {
    uni = await db.University.findOne({
      where: { name: { [Op.iLike]: `%${universityName}%` }, status: true },
      attributes: ['id', 'name', 'country'],
      order: [['id', 'ASC']],
    });
  }

  if (!uni) {
    return {
      universityId: null,
      courseId: null,
      country: null,
      universityName,
    };
  }

  let courseId: number | null = null;
  if (programName) {
    let course = await db.Course.findOne({
      where: { universityId: uni.id, courseName: { [Op.iLike]: programName } },
      attributes: ['id'],
    });
    if (!course) {
      course = await db.Course.findOne({
        where: { universityId: uni.id, courseName: { [Op.iLike]: `%${programName}%` } },
        attributes: ['id'],
        order: [['id', 'ASC']],
      });
    }
    courseId = course?.id ?? null;
  }

  return {
    universityId: uni.id,
    courseId,
    country: uni.country?.trim() || null,
    universityName: uni.name?.trim() || universityName,
  };
};

/** Apply catalog link onto a mutable Application-like row (does not save). */
export const applyCatalogLinkToApplication = async (app: {
  courseId: number | null;
  universityName: string | null;
  programName: string | null;
  country: string | null;
}): Promise<CatalogLink> => {
  const link = await resolveCatalogLink({
    courseId: app.courseId,
    universityName: app.universityName,
    programName: app.programName,
  });

  if (link.universityName) {
    app.universityName = link.universityName;
  }
  if (link.country) {
    app.country = link.country;
  }

  if (link.courseId) {
    app.courseId = link.courseId;
  } else if (app.courseId && link.universityId) {
    // Drop a course that belongs to a different institution.
    const existing = await db.Course.findByPk(app.courseId, { attributes: ['id', 'universityId'] });
    if (!existing || existing.universityId !== link.universityId) {
      app.courseId = null;
    }
  }

  return link;
};
