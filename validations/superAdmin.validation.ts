const Joi = require('joi');

const getAdmin = {
  query: Joi.object().keys({
    admin_id: Joi.string().required(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).default(10),
    sort: Joi.string().valid('username', 'email', 'createdAt', 'updatedAt').default('createdAt'),
    order: Joi.string().valid('asc', 'desc').default('asc'),
    search: Joi.string().optional(),
  }),
};
export { getAdmin };
