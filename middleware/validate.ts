import { Request, Response, NextFunction } from 'express';
import Joi, { SchemaMap } from 'joi';
import pick from '../utils/pick';
import AppError from '../utils/errorHandler';

interface ValidationSchema {
  params?: SchemaMap;
  query?: SchemaMap;
  body?: SchemaMap;
}

const validateMiddleware = (schema: ValidationSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Extract only the relevant schema parts
    const validSchema = pick(schema, ['params', 'query', 'body']);
    const object = pick(req, Object.keys(validSchema));

    // Validate the extracted object against the schema
    const { value, error } = Joi.compile(validSchema)
      .prefs({ errors: { label: 'key' }, abortEarly: false })
      .validate(object);

    if (error) {
      const errorMessage = error.details.map(details => details.message.replace(/"/g, '')).join(', ');
      const fieldErrors = error.details.map(details => details.context?.key || '').join(', ');
      const message = { errorMessage, bodyFields: fieldErrors };

      // Pass the error to the next middleware
      return next(new AppError(JSON.stringify(message), 400));
    }

    // Merge validated values into the request object
    Object.assign(req, value);
    next();
  };
};

export default validateMiddleware;
