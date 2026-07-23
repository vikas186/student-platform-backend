const Joi = require('joi');
import { APPLICATION_STATUSES } from '../models/Application.model';

const studentProfilePatchJoiSchema = {
  body: Joi.object().keys({
    fullName: Joi.string().trim().max(200).optional(),
    name: Joi.string().trim().max(200).optional(),
    email: Joi.string().email().optional(),
    phone: Joi.string().trim().max(64).allow(null, ''),
    password: Joi.string().min(8).max(128).optional(),
    countryOfResidence: Joi.string().trim().max(120).allow(null, ''),
    targetCountries: Joi.array().items(Joi.string().trim().min(1)).max(50).optional(),
    highestEducation: Joi.string().trim().max(120).allow(null, ''),
    gradeGpa: Joi.string().trim().max(32).allow(null, ''),
    linkedAgentProfileId: Joi.number().integer().positive().allow(null),
    agentProfileId: Joi.number().integer().positive().allow(null),
  }),
};

const applicationBodyJoiSchema = {
  body: Joi.object().keys({
    universityName: Joi.string().trim().max(300).allow('', null),
    programName: Joi.string().trim().max(300).allow('', null),
    notes: Joi.string().trim().max(8000).allow('', null),
    country: Joi.string().trim().max(120).allow('', null),
    courseId: Joi.alternatives()
      .try(Joi.number().integer().positive(), Joi.string().pattern(/^\d+$/))
      .allow(null, ''),
  }),
};

const listApplicationsQueryJoiSchema = {
  query: Joi.object().keys({
    search: Joi.string().trim().max(200).optional().allow(''),
    status: Joi.string()
      .valid(...APPLICATION_STATUSES)
      .optional(),
    country: Joi.string().trim().max(120).optional().allow(''),
    id: Joi.string().uuid().optional(),
    applicationNumber: Joi.string().trim().max(32).optional().allow(''),
  }),
};

const universitiesQueryJoiSchema = {
  query: Joi.object().keys({
    search: Joi.string().trim().max(200).optional().allow(''),
    country: Joi.string().trim().max(120).optional().allow(''),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(200).optional(),
  }),
};

const tuitionPayLinkBodyJoiSchema = {
  body: Joi.object()
    .keys({
      applicationId: Joi.string().trim().min(3).max(80).required(),
      amount: Joi.alternatives().try(Joi.number().positive(), Joi.string()).optional().allow(null, ''),
      currency: Joi.string().trim().max(8).optional(),
    })
    .required(),
};

export {
  studentProfilePatchJoiSchema,
  applicationBodyJoiSchema,
  listApplicationsQueryJoiSchema,
  universitiesQueryJoiSchema,
  tuitionPayLinkBodyJoiSchema,
};
