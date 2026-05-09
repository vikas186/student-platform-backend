const Joi = require('joi');

const listUniversityApplicationsQueryJoiSchema = {
  query: Joi.object().keys({
    search: Joi.string().trim().max(500).optional().allow(''),
    status: Joi.string().trim().max(120).optional().allow(''),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    applicationNumber: Joi.string().trim().max(40).optional().allow(''),
    id: Joi.string().uuid().optional(),
  }),
};

const patchUniversityApplicationStatusJoiSchema = {
  body: Joi.object().keys({
    status: Joi.string().trim().min(1).max(120).required(),
  }),
};

const patchUniversityDocumentJoiSchema = {
  body: Joi.object().keys({
    status: Joi.string().valid('pending', 'verified', 'rejected').required(),
  }),
};

export {
  listUniversityApplicationsQueryJoiSchema,
  patchUniversityApplicationStatusJoiSchema,
  patchUniversityDocumentJoiSchema,
};
