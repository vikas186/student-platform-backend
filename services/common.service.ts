import { Op } from 'sequelize';

const dynamicQueryService = async (
  model: any,
  { where = {}, include = [], page = 1, limit = 10, sort = 'createdAt', order = 'DESC', search = '', searchFields = [], attributes = null },
) => {
  const w: any = { ...where };
  if (search && searchFields.length) {
    w[Op.or] = searchFields.map(field => ({ [field]: { [Op.like]: `%${search}%` } }));
  }

  const offset = (page - 1) * limit;
  const result = await model.findAndCountAll({
    where: w,
    attributes,
    include,
    limit: limit,
    offset,
    order: [[sort, order.toUpperCase()]],
  });

  return {
    data: result.rows,
    pagination: {
      totalItems: result.count,
      totalPages: Math.ceil(result.count / limit),
      currentPage: page,
      pageSize: limit,
    },
  };
};

export { dynamicQueryService };
