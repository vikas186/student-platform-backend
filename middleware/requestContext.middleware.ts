import { AsyncLocalStorage } from 'async_hooks';
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export interface EntityChange {
  entityType: string;
  entityId: string;
  previousData: any;
  newData: any;
}

export interface RequestContextStore {
  req: Request;
  res: Response;
  requestId: string;
  changes: EntityChange[];
}

export const requestContextStore = new AsyncLocalStorage<RequestContextStore>();

export const requestContextMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  res.setHeader('X-Request-ID', requestId);

  const store: RequestContextStore = {
    req,
    res,
    requestId,
    changes: [],
  };

  requestContextStore.run(store, () => {
    next();
  });
};

export const getRequestContext = (): RequestContextStore | undefined => {
  return requestContextStore.getStore();
};

export const addEntityChange = (change: EntityChange) => {
  const store = requestContextStore.getStore();
  if (store) {
    store.changes.push(change);
  }
};
