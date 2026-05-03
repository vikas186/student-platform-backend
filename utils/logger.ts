// utils/logger.js
const logInfo = (message: any, meta: any) => {
  console.log(`[INFO]: ${message}`, meta || {});
};

const logError = (message: any, meta: any) => {
  console.error(`[ERROR]: ${message}`, meta || {});
};

export { logInfo, logError };
