class AppError extends Error {
  statusCode: number;
  stack: string | undefined;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;

    // Ensure the error's stack trace is assigned correctly
    this.stack = new Error().stack;

    // Set the prototype explicitly (for compatibility with certain environments like Node.js)
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export default AppError;
