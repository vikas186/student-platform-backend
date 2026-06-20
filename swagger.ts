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
    { name: 'Catalog', description: 'Universities & courses — public catalog + authenticated list endpoints' },
    { name: 'Student', description: 'Student portal — role `student`' },
    { name: 'Agent', description: 'Agent portal — role `agent`' },
    {
      name: 'University',
      description: 'University portal — role `university` (`Bearer` token): dashboard, partnership, applications review',
    },
    { name: 'Admin', description: 'Admin workspace — role `admin` only (`Bearer` token)' },
    { name: 'Chat', description: 'AI assistant — all authenticated roles (`Bearer` token)' },
    { name: 'Recommendations', description: 'RAG course recommendations — public + agent pathways' },
    { name: 'Scheduling', description: 'Google Calendar — counselling & mock interview booking' },
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
        required: ['role', 'email', 'password', 'confirmPassword'],
        description:
          'Public signup. **student**: `fullName`, `phoneNumber`, `targetCountries`. **agent**: `fullName`, `agencyName`, `primaryMarket`. **university**: either **`institutionName` + `country`** (Uniwizer UI — creates/links institution) **or** **`universityId` + `fullName`** (link existing institution). Do not send both modes.',
        properties: {
          role: {
            type: 'string',
            enum: ['student', 'agent', 'university'],
            example: 'student',
          },
          fullName: {
            type: 'string',
            description: 'Required for student/agent. For `university` with `universityId`; optional when using `institutionName`+`country` (defaults to institution name).',
            example: 'Alex Johnson',
          },
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
          institutionName: {
            type: 'string',
            maxLength: 300,
            description: 'When `role` is **university**: pair with `country` to find or create institution (same as `POST /auth/university/signup`).',
            example: 'Pacific Northwest University',
          },
          country: {
            type: 'string',
            maxLength: 120,
            description: 'When `role` is **university**: country / region with `institutionName`.',
            example: 'United Kingdom',
          },
          universityId: {
            type: 'integer',
            minimum: 1,
            description:
              'When `role` is **university**: existing institution id; requires **`fullName`** (contact display name). Omit when using `institutionName` + `country`.',
            example: 42,
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
