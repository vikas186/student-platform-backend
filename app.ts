// Environment & Config
import dotenv from 'dotenv';
dotenv.config({ path: `config/.env.${process.env.NODE_ENV}` });
import path from 'path';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import swaggerDoc from './swagger';
import { globalResponse } from './utils/others';
import ErrorMiddleware from './middleware/Error';
import allRoutes from './routes/index';
import { morgan, customFormat } from './utils/morganSettings';
import { verifyDiditWebhook } from './middleware/verifyDiditWebhook';
import { diditWebhookHandler } from './src/modules/didit/didit.controller';
import auditMiddleware from './middleware/audit.middleware';
import { requestContextMiddleware } from './middleware/requestContext.middleware';

// Load environment variables

// Initialize Express App
const app: any = express();

app.use(requestContextMiddleware);

// Didit webhook — raw body required for HMAC verification (before express.json)
app.post(
  '/api/v1/didit/webhook',
  express.raw({ type: 'application/json' }),
  verifyDiditWebhook,
  diditWebhookHandler,
);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: '*' }));
app.use(morgan(customFormat)); // Logging
app.use(globalResponse); // Global response formatting
app.use(auditMiddleware);

// Swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));

// Routes (scrape + auth + portals under /api/v1)
app.use('/api/v1', allRoutes);
app.get('/', (req: Request, res: Response) => res.json({ success: true, message: 'Server is Running' }));

// Static Files
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use('/api/uploads', express.static(path.join(process.cwd(), 'uploads')));

// 404 and Error Handling
app.use('*', (req: Request, res: Response, next: NextFunction) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Error Middleware
app.use(ErrorMiddleware);

export default app;
