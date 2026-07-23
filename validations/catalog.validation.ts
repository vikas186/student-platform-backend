const Joi = require('joi');

const publicUniversitiesQueryJoiSchema = {
  query: Joi.object({
    search: Joi.string().trim().max(200).optional().allow(''),
    country: Joi.string().trim().max(120).optional().allow(''),
    countries: Joi.string().trim().max(4000).optional().allow(''),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
  }),
};

export { publicUniversitiesQueryJoiSchema };
