import Joi from 'joi';
import { APPOINTMENT_STATUSES, APPOINTMENT_TYPES } from '../../../models/Appointment.model';

export const setAvailabilityJoiSchema = {
  body: Joi.object({
    timezone: Joi.string().trim().max(64).optional(),
    windows: Joi.array()
      .items(
        Joi.object({
          dayOfWeek: Joi.number().integer().min(0).max(6).required(),
          startTime: Joi.string()
            .pattern(/^\d{2}:\d{2}$/)
            .required(),
          endTime: Joi.string()
            .pattern(/^\d{2}:\d{2}$/)
            .required(),
        }),
      )
      .optional(),
    dates: Joi.array()
      .items(
        Joi.object({
          date: Joi.string().trim().required(),
          startTime: Joi.string()
            .pattern(/^\d{2}:\d{2}$/)
            .required(),
          endTime: Joi.string()
            .pattern(/^\d{2}:\d{2}$/)
            .required(),
        }),
      )
      .optional(),
  }),
};

export const listAdminAppointmentsJoiSchema = {
  query: Joi.object({
    status: Joi.string()
      .valid(...APPOINTMENT_STATUSES)
      .optional(),
    type: Joi.string()
      .valid(...APPOINTMENT_TYPES)
      .optional(),
    from: Joi.date().iso().optional(),
    to: Joi.date().iso().optional(),
  }),
};

export const patchAppointmentStatusJoiSchema = {
  params: Joi.object({
    appointmentId: Joi.string().uuid().required(),
  }),
  body: Joi.object({
    status: Joi.string()
      .valid(...APPOINTMENT_STATUSES)
      .required(),
  }),
};

export const listSlotsJoiSchema = {
  query: Joi.object({
    type: Joi.string()
      .valid(...APPOINTMENT_TYPES)
      .required(),
    from: Joi.date().iso().required(),
    to: Joi.date().iso().required(),
  }),
};

export const bookAppointmentJoiSchema = {
  body: Joi.object({
    type: Joi.string()
      .valid(...APPOINTMENT_TYPES)
      .required(),
    startsAt: Joi.date().iso().required(),
    notes: Joi.string().trim().max(2000).allow('', null).optional(),
  }),
};

export const appointmentIdParamJoiSchema = {
  params: Joi.object({
    appointmentId: Joi.string().uuid().required(),
  }),
};

export const rescheduleAppointmentJoiSchema = {
  params: Joi.object({
    appointmentId: Joi.string().uuid().required(),
  }),
  body: Joi.object({
    startsAt: Joi.date().iso().required(),
  }),
};

export const googleCallbackJoiSchema = {
  query: Joi.object({
    code: Joi.string().optional(),
    state: Joi.string().optional(),
    error: Joi.string().optional(),
    error_description: Joi.string().optional(),
    // Google may append: iss, scope, authuser, hd, prompt, etc.
  }).unknown(true),
};
