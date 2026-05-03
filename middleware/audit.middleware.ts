const { db } = require('../config/database');

const auditMiddleware = async (req: any, res: any, next: any) => {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    const apiRoute = req.originalUrl;
    const httpMethod = req.method;
    const userId = req.user ? req.user.id : null;

    let previousData = null;
    if (httpMethod === 'PATCH' && req.modelInstance) {
      previousData = req.modelInstance.toJSON();
    }

    res.on('finish', async () => {
      const newData = { ...req.body };
      if (newData.password) {
        delete newData.password;
      }
      await db.ActivityLog.create({
        userId,
        action: httpMethod,
        entityType: 'HttpRequest',
        entityId: 0,
        metadata: {
          route: apiRoute,
          previousData,
          newData,
        },
      });
    });
  }

  next();
};

export default auditMiddleware;
