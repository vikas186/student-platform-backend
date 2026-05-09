const Joi = require('joi');
import { APPLICATION_STATUSES } from '../models/Application.model';
import { USER_ROLES } from '../models/User.model';

const paginationQuery = {
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
};

const listUsersQueryJoiSchema = {
  query: Joi.object({
    search: Joi.string().trim().max(200).optional().allow(''),
    role: Joi.string().valid(...USER_ROLES).optional(),
    ...paginationQuery,
  }),
};

const createAdminUserJoiSchema = {
  body: Joi.object({
    fullName: Joi.string().trim().min(1).max(200).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).max(128).required(),
    role: Joi.string().valid(...USER_ROLES).required(),
    phone: Joi.string().trim().max(32).optional().allow(null, ''),
    agencyName: Joi.when('role', {
      is: 'agent',
      then: Joi.string().trim().min(1).max(200).optional(),
      otherwise: Joi.forbidden(),
    }),
    targetCountries: Joi.when('role', {
      is: 'student',
      then: Joi.array().items(Joi.string().trim()).optional(),
      otherwise: Joi.forbidden(),
    }),
    universityId: Joi.when('role', {
      is: 'university',
      then: Joi.number().integer().positive().required(),
      otherwise: Joi.forbidden(),
    }),
  }),
};

const patchUserRoleJoiSchema = {
  body: Joi.object({
    role: Joi.string().valid(...USER_ROLES).required(),
  }),
};

const listApplicationsQueryJoiSchema = {
  query: Joi.object({
    search: Joi.string().trim().max(200).optional().allow(''),
    status: Joi.string()
      .valid(...APPLICATION_STATUSES)
      .optional(),
    ...paginationQuery,
  }),
};

const patchApplicationStatusJoiSchema = {
  body: Joi.object({
    status: Joi.string()
      .valid(...APPLICATION_STATUSES)
      .required(),
  }),
};

/** Deadlines list is sliced in memory after loading up to 2000 rows — allow larger page sizes than default admin pagination. */
const listDeadlinesQueryJoiSchema = {
  query: Joi.object({
    search: Joi.string().trim().max(200).optional().allow(''),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(500).optional(),
  }),
};

const createDeadlineJoiSchema = {
  body: Joi.object({
    universityId: Joi.number().integer().positive().required(),
    courseId: Joi.number().integer().positive().required(),
    deadlineDate: Joi.alternatives().try(Joi.date(), Joi.string().isoDate()).required(),
    intakeLabel: Joi.string().trim().max(120).optional().allow(null, ''),
    dateMatrix: Joi.object().optional().allow(null),
  }),
};

const patchDeadlineJoiSchema = {
  body: Joi.object({
    universityId: Joi.number().integer().positive().optional(),
    courseId: Joi.number().integer().positive().optional(),
    deadlineDate: Joi.alternatives().try(Joi.date(), Joi.string().isoDate()).optional(),
    intakeLabel: Joi.string().trim().max(120).optional().allow(null, ''),
    dateMatrix: Joi.object().optional().allow(null),
  }).min(1),
};

const createOfferLetterAdminJoiSchema = {
  body: Joi.object({
    applicationId: Joi.string().trim().required(),
    universityName: Joi.string().trim().max(300).optional().allow(null, ''),
    programName: Joi.string().trim().max(300).optional().allow(null, ''),
    studentDisplayName: Joi.string().trim().max(200).optional().allow(null, ''),
    notes: Joi.string().trim().max(5000).optional().allow(null, ''),
    expiresAt: Joi.alternatives().try(Joi.date(), Joi.string().isoDate()).optional().allow(null),
  }),
};

/** Body is validated strictly in rolePermissions.service (matrix shape per catalog). */
const putPermissionsMatrixJoiSchema = {
  body: Joi.object({
    matrix: Joi.object().required(),
  }).required(),
};

const listAgentsQueryJoiSchema = {
  query: Joi.object({
    search: Joi.string().trim().max(200).optional().allow(''),
    sort: Joi.string().valid('conversion', 'name', 'students', 'tier').optional(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(200).optional(),
  }),
};

const listPaymentsQueryJoiSchema = {
  query: Joi.object({
    status: Joi.string().valid('pending', 'success', 'failed').optional(),
    ...paginationQuery,
  }),
};

const createCommissionJoiSchema = {
  body: Joi.object({
    universityId: Joi.number().integer().positive().required(),
    percentage: Joi.number().min(0).max(100).required(),
    slabDetails: Joi.string().trim().max(5000).optional().allow(null, ''),
  }),
};

const patchCommissionJoiSchema = {
  body: Joi.object({
    percentage: Joi.number().min(0).max(100).optional(),
    slabDetails: Joi.string().trim().max(5000).optional().allow(null, ''),
  }).min(1),
};

const createSubscriptionPlanJoiSchema = {
  body: Joi.object({
    name: Joi.string().trim().min(1).max(200).required(),
    price: Joi.number().min(0).required(),
    features: Joi.string().trim().max(10000).optional().allow(null, ''),
  }),
};

const patchSubscriptionPlanJoiSchema = {
  body: Joi.object({
    name: Joi.string().trim().min(1).max(200).optional(),
    price: Joi.number().min(0).optional(),
    features: Joi.string().trim().max(10000).optional().allow(null, ''),
  }).min(1),
};

const createUniversityJoiSchema = {
  body: Joi.object({
    name: Joi.string().trim().min(1).max(300).required(),
    country: Joi.string().trim().min(1).max(120).required(),
    status: Joi.boolean().optional(),
  }),
};

const patchUniversityJoiSchema = {
  body: Joi.object({
    name: Joi.string().trim().min(1).max(300).optional(),
    country: Joi.string().trim().min(1).max(120).optional(),
    status: Joi.boolean().optional(),
    agreementPackageReference: Joi.string().trim().max(120).optional().allow(null, ''),
    agreementDispatchedAt: Joi.alternatives().try(Joi.date(), Joi.string().isoDate()).optional().allow(null),
    countersignedVerifiedAt: Joi.alternatives().try(Joi.date(), Joi.string().isoDate()).optional().allow(null),
  }).min(1),
};

const globalSearchQueryJoiSchema = {
  query: Joi.object({
    q: Joi.string().trim().min(1).max(200).required(),
  }),
};

const patchApplicationStatusUiJoiSchema = {
  body: Joi.object({
    uiStatus: Joi.string().trim().min(1).max(80).required(),
  }),
};

const listCoursesQueryJoiSchema = {
  query: Joi.object({
    universityId: Joi.number().integer().positive().required(),
  }),
};

/** Admin Universities grid — search by name/country + pagination; metrics included in response. */
const listUniversitiesQueryJoiSchema = {
  query: Joi.object().keys({
    search: Joi.string().trim().max(300).optional().allow(''),
    page: Joi.alternatives()
      .try(Joi.number().integer().min(1), Joi.string().pattern(/^\d+$/))
      .optional(),
    limit: Joi.alternatives()
      .try(Joi.number().integer().min(1).max(200), Joi.string().pattern(/^\d+$/))
      .optional(),
  }),
};

const universityCoursesImportParamsJoiSchema = {
  params: Joi.object().keys({
    universityId: Joi.alternatives()
      .try(Joi.number().integer().positive(), Joi.string().pattern(/^\d+$/))
      .required(),
  }),
};

const createAdminCourseJoiSchema = {
  body: Joi.object({
    universityId: Joi.number().integer().positive().required(),
    courseName: Joi.string().trim().min(1).max(500).required(),
    degree: Joi.string().trim().min(1).max(200).required(),
    fee: Joi.number().min(0).required(),
    duration: Joi.string().trim().min(1).max(120).required(),
  }),
};

const patchAdminCourseJoiSchema = {
  body: Joi.object({
    courseName: Joi.string().trim().min(1).max(500).optional(),
    degree: Joi.string().trim().min(1).max(200).optional(),
    fee: Joi.number().min(0).optional(),
    duration: Joi.string().trim().min(1).max(120).optional(),
  }).or('courseName', 'degree', 'fee', 'duration'),
};

const intakeRowJoiSchema = {
  body: Joi.object({
    universityName: Joi.string().trim().min(1).max(300).required(),
    country: Joi.string().trim().max(120).optional().allow('', null),
    intakeLabel: Joi.string().trim().min(1).max(120).required(),
    applicationDeadline: Joi.string().trim().max(32).optional().allow('', null),
    scholarshipDeadline: Joi.string().trim().max(32).optional().allow('', null),
    depositDeadline: Joi.string().trim().max(32).optional().allow('', null),
    intakeStart: Joi.string().trim().max(32).optional().allow('', null),
  }),
};

const commissionSlabRichJoiSchema = {
  body: Joi.object({
    universityName: Joi.string().trim().min(1).max(300).required(),
    partnerCommissionPercent: Joi.number().min(0).max(100).required(),
    country: Joi.string().trim().max(120).optional().allow('', null),
    rates: Joi.object().pattern(Joi.string(), Joi.number()).optional(),
  }),
};

const patchAgentSubscriptionJoiSchema = {
  body: Joi.object({
    subscriptionPlanId: Joi.alternatives().try(Joi.number().integer().positive(), Joi.valid(null), Joi.string().valid('')),
  }),
};

const listAgentAgreementsQueryJoiSchema = {
  query: Joi.object({
    status: Joi.string().valid('pending', 'submitted', 'approved', 'rejected').optional(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(200).optional(),
  }),
};

const rejectAgentAgreementJoiSchema = {
  body: Joi.object({
    reason: Joi.string().trim().max(2000).optional().allow('', null),
  }),
};

export {
  putPermissionsMatrixJoiSchema,
  listUsersQueryJoiSchema,
  createAdminUserJoiSchema,
  patchUserRoleJoiSchema,
  listApplicationsQueryJoiSchema,
  patchApplicationStatusJoiSchema,
  listDeadlinesQueryJoiSchema,
  createDeadlineJoiSchema,
  patchDeadlineJoiSchema,
  createOfferLetterAdminJoiSchema,
  listAgentsQueryJoiSchema,
  listAgentAgreementsQueryJoiSchema,
  rejectAgentAgreementJoiSchema,
  listPaymentsQueryJoiSchema,
  createCommissionJoiSchema,
  patchCommissionJoiSchema,
  createSubscriptionPlanJoiSchema,
  patchSubscriptionPlanJoiSchema,
  createUniversityJoiSchema,
  patchUniversityJoiSchema,
  globalSearchQueryJoiSchema,
  patchApplicationStatusUiJoiSchema,
  listCoursesQueryJoiSchema,
  listUniversitiesQueryJoiSchema,
  universityCoursesImportParamsJoiSchema,
  createAdminCourseJoiSchema,
  patchAdminCourseJoiSchema,
  intakeRowJoiSchema,
  commissionSlabRichJoiSchema,
  patchAgentSubscriptionJoiSchema,
};
