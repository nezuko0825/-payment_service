import { Request, Response, NextFunction } from 'express';
import { body, param, header, validationResult } from 'express-validator';

export const validateCreateInvoice = [
  body('merchantId')
    .trim()
    .notEmpty()
    .withMessage('Merchant ID is required')
    .isString()
    .withMessage('Merchant ID must be a string')
    .isLength({ min: 1, max: 100 })
    .withMessage('Merchant ID must be between 1 and 100 characters'),

  body('amount')
    .notEmpty()
    .withMessage('Amount is required')
    .isFloat({ min: 0.01, max: 1000000 })
    .withMessage('Amount must be a positive number between 0.01 and 1,000,000')
    .custom((value) => {
      // Validate decimal places
      const decimalPlaces = (value.toString().split('.')[1] || '').length;
      return decimalPlaces <= 2;
    })
    .withMessage('Amount must have at most 2 decimal places'),

  body('currency')
    .optional()
    .trim()
    .isString()
    .withMessage('Currency must be a string')
    .isLength({ min: 3, max: 3 })
    .withMessage('Currency must be 3 characters')
    .isUppercase()
    .withMessage('Currency must be uppercase'),

  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    return next();
  }
];

export const validateWebhook = [
  header('X-Signature')
    .notEmpty()
    .withMessage('X-Signature header is required')
    .isString()
    .withMessage('X-Signature must be a string')
    .isLength({ min: 64, max: 64 })
    .withMessage('X-Signature must be 64 characters (HMAC-SHA256)'),

  header('X-Timestamp')
    .notEmpty()
    .withMessage('X-Timestamp header is required')
    .isInt()
    .withMessage('X-Timestamp must be an integer')
    .custom((value) => {
      const timestamp = parseInt(value, 10);
      return timestamp > 0 && timestamp <= Date.now() + 5 * 60 * 1000;
    })
    .withMessage('X-Timestamp must be a valid timestamp'),

  header('X-Nonce')
    .notEmpty()
    .withMessage('X-Nonce header is required')
    .isString()
    .withMessage('X-Nonce must be a string')
    .isLength({ min: 32, max: 64 })
    .withMessage('X-Nonce must be between 32 and 64 characters'),

  body('invoiceId')
    .notEmpty()
    .withMessage('invoiceId is required')
    .isString()
    .withMessage('invoiceId must be a string')
    .isMongoId()
    .withMessage('invoiceId must be a valid MongoDB ObjectId'),

  body('status')
    .notEmpty()
    .withMessage('status is required')
    .isString()
    .withMessage('status must be a string')
    .isIn(['paid', 'failed'])
    .withMessage('status must be either "paid" or "failed"'),

  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    return next();
  }
];

export const validateGetInvoice = [
  param('id')
    .notEmpty()
    .withMessage('Invoice ID is required')
    .isMongoId()
    .withMessage('Invoice ID must be a valid MongoDB ObjectId'),

  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    return next();
  }
];