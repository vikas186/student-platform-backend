import Joi from 'joi';
import { VERIFICATION_ENTITY_TYPES } from '../../../models/VerificationAuditLog.model';

const adminVerificationsListQueryInner = Joi.object({
  category: Joi.string().valid(...VERIFICATION_ENTITY_TYPES, 'all').default('all'),
  status: Joi.string().trim().max(64).optional(),
  userId: Joi.string().uuid().optional(),
  q: Joi.string().trim().max(200).optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

export const adminVerificationsListQueryJoiSchema = {
  query: adminVerificationsListQueryInner,
};

export const adminVerificationActionJoiSchema = {
  body: Joi.object({
    notes: Joi.string().trim().max(2000).optional().allow(''),
    reason: Joi.string().trim().max(500).optional().allow(''),
  }),
};

export const adminVerificationResubmitJoiSchema = {
  body: Joi.object({
    notes: Joi.string().trim().min(1).max(2000).required(),
  }),
};

export const adminUserDocumentStatusParamsJoiSchema = {
  params: Joi.object({
    userId: Joi.string().uuid().required(),
  }),
};

export const adminVerificationDetailParamsJoiSchema = {
  params: Joi.object({
    id: Joi.string()
      .pattern(/^(passport|academic|bank|itr):[0-9a-f-]{36}$/i)
      .required(),
  }),
};
