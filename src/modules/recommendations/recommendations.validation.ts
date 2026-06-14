import Joi from 'joi';

export const publicMatchJoiSchema = {
  body: Joi.object({
    level: Joi.string().trim().min(1).max(80).required(),
    field: Joi.string().trim().min(1).max(120).required(),
    country: Joi.string().trim().min(1).max(120).required(),
    score: Joi.number().min(0).max(100).optional(),
    budget: Joi.alternatives().try(Joi.number().min(0), Joi.string().trim().max(40)).optional(),
    intake: Joi.string().trim().max(80).optional(),
  }),
};

export const agentMatchJoiSchema = {
  body: Joi.object({
    country: Joi.string().trim().min(1).max(120).required(),
    programFocus: Joi.string().trim().min(1).max(120).required(),
    limit: Joi.number().integer().min(1).max(4).optional(),
  }),
};
