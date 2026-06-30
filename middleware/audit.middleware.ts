import { db } from '../config/database';
import { getRequestContext } from './requestContext.middleware';

// Helper to parse User Agent
function parseUserAgent(ua: string) {
  let browser = 'Unknown';
  let os = 'Unknown';
  let device = 'Desktop';

  if (!ua) return { browser, os, device };

  if (/mobile|android|iphone|ipad|phone/i.test(ua)) {
    device = 'Mobile';
  } else if (/tablet|ipad|playbook|silk/i.test(ua)) {
    device = 'Tablet';
  }

  if (/windows/i.test(ua)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  if (/chrome|crios/i.test(ua) && !/edge|opr|opios/i.test(ua)) browser = 'Chrome';
  else if (/safari/i.test(ua) && !/chrome|crios|edge|opr|opios/i.test(ua)) browser = 'Safari';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/edge|edg/i.test(ua)) browser = 'Edge';
  else if (/opr|opera/i.test(ua)) browser = 'Opera';

  return { browser, os, device };
}

// Helper to recursively mask sensitive data
function maskSensitiveData(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj;
  const copy = Array.isArray(obj) ? [...obj] : { ...obj };
  const sensitiveKeys = ['password', 'refreshtoken', 'accesstoken', 'otp', 'apikey', 'authorization', 'cookie', 'cookies', 'secret'];

  for (const key of Object.keys(copy)) {
    if (sensitiveKeys.includes(key.toLowerCase())) {
      copy[key] = '********';
    } else if (typeof copy[key] === 'object') {
      copy[key] = maskSensitiveData(copy[key]);
    }
  }
  return copy;
}

// Helper to get activity details
function getActivityDetails(method: string, path: string, body: any) {
  const m = method.toUpperCase();
  // Strip query parameters
  const cleanPath = (path.split('?')[0] || path).toLowerCase();

  let activity = `${m} ${cleanPath}`;
  let action = 'VIEW';
  let moduleName = 'system';
  let entityId: string | null = null;
  let entityName: string | null = null;

  if (cleanPath.includes('/auth/admin/login') || cleanPath.includes('/auth/login')) {
    activity = cleanPath.includes('/admin') ? 'Admin Login' : 'User Login';
    action = 'LOGIN';
    moduleName = 'auth';
    entityName = body?.email;
  } else if (cleanPath.includes('/auth/logout')) {
    activity = 'User Logout';
    action = 'LOGOUT';
    moduleName = 'auth';
  } else if (cleanPath.includes('/auth/refresh-token')) {
    activity = 'Token Refreshed';
    action = 'VIEW';
    moduleName = 'auth';
  } else if (cleanPath.includes('/auth/change-password')) {
    activity = 'Changed Password';
    action = 'UPDATE';
    moduleName = 'auth';
  }
  
  // GET requests (Views)
  else if (m === 'GET') {
    action = 'VIEW';
    if (cleanPath.includes('/admin/activity-logs')) {
      activity = 'Viewed Activity Logs';
      moduleName = 'system';
    } else if (cleanPath.includes('/admin/dashboard')) {
      activity = 'Viewed Admin Dashboard';
      moduleName = 'system';
    } else if (cleanPath.includes('/admin/universities')) {
      activity = 'Viewed Universities List';
      moduleName = 'universities';
    } else if (cleanPath.includes('/admin/courses')) {
      activity = 'Viewed Courses List';
      moduleName = 'courses';
    } else if (cleanPath.includes('/admin/users')) {
      activity = 'Viewed Users List';
      moduleName = 'users';
    } else if (cleanPath.includes('/admin/commissions')) {
      activity = 'Viewed Commission Slabs';
      moduleName = 'commissions';
    } else if (cleanPath.includes('/admin/subscriptions')) {
      activity = 'Viewed Subscription Plans';
      moduleName = 'subscriptions';
    } else if (cleanPath.includes('/admin/deadlines')) {
      activity = 'Viewed Deadlines';
      moduleName = 'deadlines';
    } else if (cleanPath.includes('/admin/payments')) {
      activity = 'Viewed Payments';
      moduleName = 'payments';
    } else if (cleanPath.includes('/admin/offer-letters')) {
      activity = 'Viewed Offer Letters';
      moduleName = 'offer-letters';
    } else if (cleanPath.includes('/admin/notices')) {
      activity = 'Viewed Notice Ticker';
      moduleName = 'notices';
    } else if (cleanPath.includes('/admin/roles-permissions') || cleanPath.includes('/admin/permissions')) {
      activity = 'Viewed Roles & Permissions';
      moduleName = 'permissions';
    } else if (cleanPath.includes('/admin/scrape')) {
      activity = 'Viewed Scrape Hub';
      moduleName = 'scrape';
    } else if (cleanPath.includes('/admin/verifications')) {
      activity = 'Viewed Verifications';
      moduleName = 'verifications';
    } else if (cleanPath.includes('/admin/applications')) {
      activity = 'Viewed Applications List';
      moduleName = 'applications';
    } else if (cleanPath.includes('/agent/dashboard')) {
      activity = 'Viewed Agent Dashboard';
      moduleName = 'system';
    } else if (cleanPath.includes('/agent/explore')) {
      activity = 'Discovered Universities';
      moduleName = 'universities';
    } else if (cleanPath.includes('/agent/applications')) {
      activity = 'Viewed Agent Applications';
      moduleName = 'applications';
    } else if (cleanPath.includes('/agent/submit')) {
      activity = 'Access New Application Form';
      moduleName = 'applications';
    } else if (cleanPath.includes('/agent/documents')) {
      activity = 'Viewed Agent Documents';
      moduleName = 'documents';
    } else if (cleanPath.includes('/agent/offers')) {
      activity = 'Viewed Agent Offer Letters';
      moduleName = 'offer-letters';
    } else if (cleanPath.includes('/agent/commission')) {
      activity = 'Viewed Agent Commission';
      moduleName = 'commissions';
    } else if (cleanPath.includes('/agent/deposit-payments')) {
      activity = 'Viewed Agent Deposit Payments';
      moduleName = 'payments';
    } else if (cleanPath.includes('/agent/deadlines')) {
      activity = 'Viewed Agent Deadlines';
      moduleName = 'deadlines';
    } else if (cleanPath.includes('/agent/assistant')) {
      activity = 'Used AI Assistant';
      moduleName = 'system';
    } else if (cleanPath.includes('/agent/agreement')) {
      activity = 'Viewed Agent Agreement';
      moduleName = 'permissions';
    } else if (cleanPath.includes('/university/review')) {
      activity = 'Reviewed Applications';
      moduleName = 'applications';
    } else if (cleanPath.includes('/university/agent-ranking')) {
      activity = 'Viewed Agent Rankings';
      moduleName = 'system';
    } else if (cleanPath.includes('/university')) {
      activity = 'Viewed University Dashboard';
      moduleName = 'system';
    } else if (cleanPath.includes('/student/applications')) {
      activity = 'Viewed Student Applications';
      moduleName = 'applications';
    } else if (cleanPath.includes('/student/counselling')) {
      activity = 'Viewed Student Counselling';
      moduleName = 'system';
    } else if (cleanPath.includes('/student/profile')) {
      activity = 'Viewed Student Profile';
      moduleName = 'users';
    } else if (cleanPath.includes('/student/verification')) {
      activity = 'Viewed Student Verification';
      moduleName = 'verifications';
    } else if (cleanPath.includes('/student')) {
      activity = 'Viewed Student Dashboard';
      moduleName = 'system';
    } else {
      const parts = cleanPath.split('/');
      activity = `Viewed ${parts[parts.length - 1] || 'Page'}`;
    }
  }

  // Universities module
  else if (cleanPath.includes('/admin/universities/import-catalog')) {
    activity = 'Imported University Catalog';
    action = 'CREATE';
    moduleName = 'universities';
  } else if (cleanPath.includes('/admin/universities')) {
    moduleName = 'universities';
    if (m === 'POST') {
      activity = 'Created University';
      action = 'CREATE';
      entityName = body?.name;
    } else if (m === 'PATCH' || m === 'PUT') {
      activity = 'Updated University';
      action = 'UPDATE';
      const match = path.match(/\/universities\/([^/]+)/);
      entityId = match ? match[1] : null;
      entityName = body?.name;
    } else if (m === 'DELETE') {
      activity = 'Deleted University';
      action = 'DELETE';
      const match = path.match(/\/universities\/([^/]+)/);
      entityId = match ? match[1] : null;
    }
  }

  // Commissions module
  else if (cleanPath.includes('/admin/commissions')) {
    moduleName = 'commissions';
    if (m === 'POST') {
      activity = 'Created Commission Slab';
      action = 'CREATE';
    } else if (m === 'PATCH' || m === 'PUT') {
      activity = 'Updated Commission Slab';
      action = 'UPDATE';
      const match = path.match(/\/commissions\/([^/]+)/);
      entityId = match ? match[1] : null;
    } else if (m === 'DELETE') {
      activity = 'Deleted Commission Slab';
      action = 'DELETE';
      const match = path.match(/\/commissions\/([^/]+)/);
      entityId = match ? match[1] : null;
    }
  }

  // Users module
  else if (cleanPath.includes('/admin/users') || cleanPath.includes('/users')) {
    moduleName = 'users';
    if (m === 'POST') {
      activity = 'Created User';
      action = 'CREATE';
      entityName = body?.email;
    } else if (m === 'PATCH' || m === 'PUT') {
      activity = 'Updated User';
      action = 'UPDATE';
      const match = path.match(/\/users\/([^/]+)/);
      entityId = match ? match[1] : null;
      entityName = body?.email;
    } else if (m === 'DELETE') {
      activity = 'Deleted User';
      action = 'DELETE';
      const match = path.match(/\/users\/([^/]+)/);
      entityId = match ? match[1] : null;
    }
  }

  // Roles & Permissions
  else if (cleanPath.includes('/admin/roles-permissions') || cleanPath.includes('/admin/permissions')) {
    activity = 'Updated Roles & Permissions';
    action = 'UPDATE';
    moduleName = 'permissions';
  }

  // Applications
  else if (cleanPath.includes('/admin/applications') || cleanPath.includes('/agent/applications')) {
    moduleName = 'applications';
    if (m === 'POST') {
      activity = 'Created Application';
      action = 'CREATE';
    } else if (m === 'PATCH' || m === 'PUT') {
      activity = 'Updated Application';
      action = 'UPDATE';
      const match = path.match(/\/applications\/([^/]+)/);
      entityId = match ? match[1] : null;
    }
  }

  // Deadlines
  else if (cleanPath.includes('/admin/deadlines')) {
    moduleName = 'deadlines';
    activity = m === 'POST' ? 'Created Deadline' : 'Updated Deadline';
    action = m === 'POST' ? 'CREATE' : 'UPDATE';
  }

  // Subscriptions
  else if (cleanPath.includes('/admin/subscriptions')) {
    moduleName = 'subscriptions';
    activity = m === 'POST' ? 'Created Subscription Plan' : 'Updated Subscription Plan';
    action = m === 'POST' ? 'CREATE' : 'UPDATE';
  }

  return { activity, action, moduleName, entityId, entityName };
}

const auditMiddleware = async (req: any, res: any, next: any) => {
  const p = req.originalUrl || req.url || '';

  // Exclude noisy endpoints
  const shouldExclude =
    p.includes('/auth/refresh-token') ||
    p.includes('/admin/activity-logs') ||
    p.includes('/health') ||
    p.includes('/ping') ||
    p.includes('/favicon.ico') ||
    p.startsWith('/static/') ||
    p.startsWith('/assets/') ||
    req.headers.upgrade === 'websocket';

  if (shouldExclude) {
    return next();
  }

  res.on('finish', () => {
    // Run asynchronously in the background so it never slows down the API response
    setImmediate(async () => {
      try {
        const store = getRequestContext();
        const requestId = store?.requestId || null;
        const changes = store?.changes || [];
        const errorMessage = (store as any)?.errorMessage || null;

        let finalUserId = req.user ? req.user.id : null;
        let fullName = req.user ? req.user.name : null;
        let email = req.user ? req.user.email : null;
        let role = req.user ? req.user.role : null;

        // If login request, try to find user by email to associate the log
        if (!finalUserId && (p.includes('/login') || p.includes('/signin')) && req.body?.email) {
          const user = await db.User.findOne({
            where: { email: String(req.body.email).trim().toLowerCase() },
          });
          if (user) {
            finalUserId = user.id;
            fullName = user.name;
            email = user.email;
            role = user.role;
          }
        }

        const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;
        const ua = req.headers['user-agent'] || '';
        const { browser, os, device } = parseUserAgent(ua);

        const maskedBody = maskSensitiveData(req.body || {});
        const maskedHeaders = maskSensitiveData(req.headers || {});

        const { activity, action, moduleName, entityId, entityName } = getActivityDetails(req.method, p, req.body);

        const statusCode = res.statusCode;
        const status = statusCode >= 200 && statusCode < 400 ? 'SUCCESS' : 'FAILED';

        // Find entityId and entityName from changes if they were captured by the Sequelize hooks
        let finalEntityId = entityId;
        let finalEntityName = entityName;
        if (changes.length > 0) {
          const mainChange = changes[0];
          if (mainChange) {
            if (!finalEntityId) finalEntityId = mainChange.entityId;
            if (!finalEntityName) {
              finalEntityName =
                mainChange.newData?.name ||
                mainChange.newData?.email ||
                mainChange.previousData?.name ||
                mainChange.previousData?.email ||
                null;
            }
          }
        }

        await db.ActivityLog.create({
          userId: finalUserId,
          fullName,
          email,
          role: role || (finalUserId ? 'user' : 'System'),
          activity,
          action,
          method: req.method,
          endpoint: p,
          module: moduleName,
          entityId: finalEntityId,
          entityName: finalEntityName,
          ipAddress,
          userAgent: ua,
          browser,
          os,
          device,
          requestId,
          statusCode,
          status,
          errorMessage,
          metadata: {
            headers: maskedHeaders,
            body: maskedBody,
            query: maskSensitiveData(req.query || {}),
            changes: changes.length > 0 ? changes : undefined,
          },
        });
      } catch (err) {
        console.error('[Audit Middleware] Failed to save activity log:', err);
      }
    });
  });

  next();
};

export default auditMiddleware;
