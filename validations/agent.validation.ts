const Joi = require('joi');
import { APPLICATION_STATUSES } from '../models/Application.model';
import { DOCUMENT_STATUSES } from '../models/Document.model';
import { OFFER_LETTER_STATUSES } from '../models/OfferLetter.model';

const listApplicationsQueryJoiSchema = {
  query: Joi.object().keys({
    search: Joi.string().trim().max(200).optional().allow(''),
    status: Joi.string()
      .valid(...APPLICATION_STATUSES)
      .optional(),
    country: Joi.string().trim().max(120).optional().allow(''),
    id: Joi.string().uuid().optional(),
    applicationNumber: Joi.string().trim().max(32).optional().allow(''),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
  }),
};

const agentNewStudentBodyKeys = {
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(128).optional().allow('', null),
  fullName: Joi.string().trim().max(200).required(),
  phone: Joi.string().trim().max(64).optional().allow('', null),
  targetCountries: Joi.array().items(Joi.string().trim()).max(50).optional(),
  countryOfResidence: Joi.string().trim().max(120).optional().allow('', null),
  dateOfBirth: Joi.string().trim().max(32).optional().allow('', null),
  nationality: Joi.string().trim().max(120).optional().allow('', null),
};

/** POST /agent/students — create a student user linked to this agent */
const createAgentStudentBodyJoiSchema = {
  body: Joi.object().keys(agentNewStudentBodyKeys).required(),
};

const createApplicationBodyJoiSchema = {
  body: Joi.object()
    .keys({
      studentProfileId: Joi.number().integer().positive(),
      student: Joi.object().keys(agentNewStudentBodyKeys),
      universityName: Joi.string().trim().max(300).allow('', null),
      programName: Joi.string().trim().max(300).allow('', null),
      country: Joi.string().trim().max(120).allow('', null),
      courseId: Joi.number().integer().positive().allow(null),
      notes: Joi.string().trim().max(8000).allow('', null),
      commissionAmount: Joi.alternatives().try(Joi.number(), Joi.string()).allow(null),
      commissionSlab: Joi.string().trim().max(255).allow('', null),
      metadata: Joi.object().unknown(true).allow(null),
    })
    .xor('studentProfileId', 'student')
    .required(),
};

const patchApplicationBodyJoiSchema = {
  body: Joi.object().keys({
    universityName: Joi.string().trim().max(300).allow('', null),
    programName: Joi.string().trim().max(300).allow('', null),
    country: Joi.string().trim().max(120).allow('', null),
    courseId: Joi.alternatives().try(Joi.number().integer().positive(), Joi.string().allow('')).allow(null),
    notes: Joi.string().trim().max(8000).allow('', null),
    commissionAmount: Joi.alternatives().try(Joi.number(), Joi.string()).allow(null),
    commissionSlab: Joi.string().trim().max(255).allow('', null),
    metadata: Joi.object().unknown(true).allow(null),
  }),
};

const listDocumentsQueryJoiSchema = {
  query: Joi.object().keys({
    applicationId: Joi.string().trim().max(80).optional().allow(''),
  }),
};

const patchDocumentBodyJoiSchema = {
  body: Joi.object()
    .keys({
      status: Joi.string()
        .valid(...DOCUMENT_STATUSES)
        .required(),
    })
    .required(),
};

const verifyDocumentsBodyJoiSchema = {
  body: Joi.object()
    .keys({
      applicationId: Joi.string().trim().min(3).max(80).required(),
    })
    .required(),
};

const createOfferLetterBodyJoiSchema = {
  body: Joi.object()
    .keys({
      applicationId: Joi.string().trim().min(3).max(80).required(),
      fileUrl: Joi.string().trim().max(2048).allow('', null),
      expiresAt: Joi.alternatives().try(Joi.date(), Joi.string().isoDate()).allow(null),
      notes: Joi.string().trim().max(8000).allow('', null),
      universityName: Joi.string().trim().max(300).allow('', null),
      programName: Joi.string().trim().max(300).allow('', null),
    })
    .required(),
};

const patchOfferLetterBodyJoiSchema = {
  body: Joi.object()
    .keys({
      fileUrl: Joi.string().trim().max(2048).allow('', null),
      signedFileUrl: Joi.string().trim().max(2048).allow('', null),
      status: Joi.string().valid(...OFFER_LETTER_STATUSES),
      expiresAt: Joi.alternatives().try(Joi.date(), Joi.string().isoDate()).allow(null),
      notes: Joi.string().trim().max(8000).allow('', null),
    })
    .min(1),
};

const depositPayLinkBodyJoiSchema = {
  body: Joi.object()
    .keys({
      applicationId: Joi.string().trim().min(3).max(80).required(),
      amount: Joi.alternatives().try(Joi.number().positive(), Joi.string()).required(),
      currency: Joi.string().trim().max(8).optional(),
      studentEmail: Joi.string().email().allow('', null),
    })
    .required(),
};

const discoveryQueryJoiSchema = {
  query: Joi.object().keys({
    q: Joi.string().trim().max(200).optional().allow(''),
  }),
};

const deadlinesQueryJoiSchema = {
  query: Joi.object().keys({
    search: Joi.string().trim().max(200).optional().allow(''),
  }),
};

const globalSearchQueryJoiSchema = {
  query: Joi.object()
    .keys({
      q: Joi.string().trim().min(1).max(200).required(),
    })
    .required(),
};

const agentProfilePatchJoiSchema = {
  body: Joi.object().keys({
    name: Joi.string().trim().max(200).optional(),
    fullName: Joi.string().trim().max(200).optional(),
    agencyName: Joi.string().trim().max(300).optional(),
    primaryMarket: Joi.string().trim().max(120).allow('', null),
    logoUrl: Joi.string().trim().max(2048).allow('', null),
  }),
};

const listStudentsQueryJoiSchema = {
  query: Joi.object().keys({
    search: Joi.string().trim().max(200).optional().allow(''),
  }),
};

export {
  listApplicationsQueryJoiSchema,
  createApplicationBodyJoiSchema,
  createAgentStudentBodyJoiSchema,
  patchApplicationBodyJoiSchema,
  listDocumentsQueryJoiSchema,
  patchDocumentBodyJoiSchema,
  verifyDocumentsBodyJoiSchema,
  createOfferLetterBodyJoiSchema,
  patchOfferLetterBodyJoiSchema,
  depositPayLinkBodyJoiSchema,
  discoveryQueryJoiSchema,
  deadlinesQueryJoiSchema,
  globalSearchQueryJoiSchema,
  agentProfilePatchJoiSchema,
  listStudentsQueryJoiSchema,
};
