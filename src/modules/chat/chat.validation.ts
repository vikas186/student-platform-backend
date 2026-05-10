import Joi from 'joi';

export const postChatMessageJoiSchema = {
  body: Joi.object({
    sessionId: Joi.string().uuid().optional(),
    message: Joi.string().trim().min(1).max(8000).required(),
  }),
};

export const getChatHistoryJoiSchema = {
  query: Joi.object({
    sessionId: Joi.string().uuid().required(),
    limit: Joi.number().integer().min(1).max(100).default(50),
    cursor: Joi.string().pattern(/^\d+$/).optional(),
  }),
};

export const deleteChatHistoryJoiSchema = {
  query: Joi.object({
    sessionId: Joi.string().uuid().optional(),
    all: Joi.string().valid('true', 'false').optional(),
  }),
};

export const postChatFeedbackJoiSchema = {
  body: Joi.object({
    messageId: Joi.number().integer().positive().required(),
    rating: Joi.number().integer().min(-1).max(5).required(),
    comment: Joi.string().trim().max(2000).allow('', null).optional(),
  }),
};
