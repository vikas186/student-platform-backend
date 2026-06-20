import Joi from 'joi';

export const listAdminNoticesJoiSchema = {
  query: Joi.object({
    q: Joi.string().trim().max(200).optional(),
    includeInactive: Joi.string().valid('true', 'false').optional(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
  }),
};
