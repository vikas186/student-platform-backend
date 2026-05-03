import swaggerJsdoc from 'swagger-jsdoc';
import { openapiSchemas } from './swagger/openapiSchemas';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Student Requirement Platform API',
    version: '1.0.0',
    description:
      'REST API for the Student Requirement Platform — student counselling, applications, and agent partner tools. Use **Authorize** and paste `Bearer <access_token>` from login. JWT is only required on protected routes.',
  },
  servers: [
    {
      url: '/',
      description:
        'Same origin as this page — Try it out hits /api/v1/... on the host serving /api-docs (recommended).',
    },
    {
      url: 'http://localhost:4001',
      description:
        'Explicit origin only — paths below already include /api/v1 (do not append /api/v1 here or requests become /api/v1/api/v1/... and 404).',
    },
  ],
  tags: [
    { name: 'Auth', description: 'Public signup & login; token refresh' },
    { name: 'User', description: 'Any authenticated role' },
    { name: 'Catalog', description: 'Universities & courses (auth required)' },
    { name: 'Student', description: 'Student portal — role `student`' },
    { name: 'Agent', description: 'Agent portal — role `agent`' },
    { name: 'Admin', description: 'Admin workspace — role `admin` only (`Bearer` token)' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Paste: `Bearer ` + access token from `POST /auth/login` or `POST /auth/refresh-token`',
      },
    },
    schemas: {
      SignupRequest: {
        type: 'object',
        required: ['role', 'fullName', 'email', 'password', 'confirmPassword'],
        description:
          'Public signup for **student** or **agent**. Required fields depend on `role`: students must send `phoneNumber` and `targetCountries` (omit agency fields). Agents must send `agencyName` and `primaryMarket` (omit `targetCountries`). `phoneNumber` is optional for agents.',
        properties: {
          role: {
            type: 'string',
            enum: ['student', 'agent'],
            example: 'student',
          },
          fullName: { type: 'string', example: 'Alex Johnson' },
          email: { type: 'string', format: 'email', example: 'user@example.com' },
          password: { type: 'string', format: 'password', minLength: 8, example: 'SecurePass1' },
          confirmPassword: { type: 'string', format: 'password', example: 'SecurePass1' },
          phoneNumber: {
            type: 'string',
            description: 'Required when `role` is `student`. Optional for `agent` (stored on user if sent).',
            example: '+91 9876543210',
          },
          targetCountries: {
            type: 'array',
            items: { type: 'string' },
            description: 'Required when `role` is `student` (at least one country). Omit for agents.',
            example: ['Canada', 'United Kingdom'],
          },
          agencyName: {
            type: 'string',
            description: 'Required when `role` is `agent`. Omit for students.',
            example: 'GlobalEdu Consulting',
          },
          primaryMarket: {
            type: 'string',
            description: 'Required when `role` is `agent`. Omit for students.',
            example: 'India',
          },
        },
      },
      ...openapiSchemas,
    },
  },
};

const options = {
  swaggerDefinition,
  apis: ['./swagger/*.ts', './routes/*.ts'], // Path to the API routes in your Node.js application
};

const swaggerDoc = swaggerJsdoc(options);

// Use 'export default' instead of 'export =' to comply with ECMAScript modules
export default swaggerDoc;
