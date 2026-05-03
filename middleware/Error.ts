import constant from '../constant';
import { db } from '../models';

interface ErrorWithStack extends Error {
  stack?: string;
  statusCode?: number;
}
interface ErrorResponse {
  success: boolean;
  message: string;
  stack?: string; // stack is optional
}

const ErrorMiddleware = async (err: any, req: any, res: any, next: any): Promise<void> => {
  // Default error properties
  let statusCode = err.statusCode || constant.msgCode.internalServerError;
  let message = err.message || constant.msg.internalServerError;

  // Database error handling
  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    statusCode = 400; // Bad Request
    message = err.errors?.map((error: any) => error.message).join(', ') || message;
  } else if (err.name === 'SequelizeDatabaseError') {
    statusCode = 500; // Internal Server Error
    message = 'A database error occurred. Please try again later.';
    if (['development', 'staging'].includes(process.env.NODE_ENV || '') && err.parent?.message) {
      message = err.parent.message;
    }
  } else if (err.name === 'SequelizeConnectionError' || err.name === 'SequelizeConnectionRefusedError') {
    statusCode = 503; // Service Unavailable
    message = 'Database connection failed. Please try again later.';
  }

  // Prepare response
  const response: any = {
    success: false,
    message,
  };

  // Include stack trace for non-production environments
  if (['development', 'staging'].includes(process.env.NODE_ENV || '')) {
    response.stack = err.stack;
  }

  // Log the error to the console
  console.error('Error occurred:', err);

  // Log the error to the database
  // if (ErrorLogs) {
  try {
    await db.ErrorLogs.create({
      statusCode,
      message,
      stack: err.stack,
      userEmail: req?.user?.email || null,
      apiRoute: req.originalUrl || null,
    });
  } catch (logError) {
    console.error('Failed to log error to the database:', logError);
  }
  // } else {
  //   console.warn('ErrorLogs model is not initialized. Error not logged to the database.');
  // }

  // Send response to the client
  res.status(statusCode).json(response);
};

export default ErrorMiddleware;
