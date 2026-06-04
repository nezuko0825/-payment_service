import { Router, Request, Response } from 'express';
import { validateWebhook } from '../middleware/validation';
import { WebhookService } from '../services/webhookService';
import { InvoiceService } from '../services/invoiceService';
import { AppError } from '../middleware/errorHandler';

const router = Router();

/**
 * @route   POST /webhook
 * @desc    Process payment webhook
 * @access  Public
 */
router.post('/', validateWebhook, async (req: Request, res: Response) => {
  try {
    const payload = {
      invoiceId: req.body.invoiceId,
      status: req.body.status
    };

    const headers = {
      signature: req.header('X-Signature') || '',
      timestamp: parseInt(req.header('X-Timestamp') || '0', 10),
      nonce: req.header('X-Nonce') || ''
    };

    // Get Redis client from app locals
    const redisClient = req.app.locals.redis;

    if (!redisClient) {
      throw new AppError('Redis client not available', 500);
    }

    // Process webhook
    const result = await WebhookService.processWebhook(
      payload,
      headers,
      InvoiceService,
      redisClient
    );

    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        invoiceId: result.invoiceId,
        status: payload.status
      }
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message
      });
    } else {
      console.error('Webhook processing error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process webhook'
      });
    }
  }
});

/**
 * @route   GET /webhook/test-signature
 * @desc    Test signature generation (for testing purposes)
 * @access  Public
 */
router.get('/test-signature', (_req: Request, res: Response) => {
  try {
    const testPayload = {
      invoiceId: '507f1f77bcf86cd799439011',
      status: 'paid'
    };

    const secretKey = process.env.SECRET_KEY || 'test-secret';
    const nonce = 'test-nonce-' + Date.now();
    const timestamp = Date.now();

    // Import dynamically to avoid circular dependencies
    const { CryptoUtils } = require('../utils/crypto');
    
    const signature = CryptoUtils.generateSignature(testPayload, secretKey);

    res.status(200).json({
      success: true,
      data: {
        payload: testPayload,
        headers: {
          'X-Signature': signature,
          'X-Timestamp': timestamp,
          'X-Nonce': nonce
        },
        instructions: 'Use these headers to test the webhook endpoint'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to generate test signature'
    });
  }
});

/**
 * @route   POST /webhook/simulate
 * @desc    Simulate webhook for testing (development only)
 * @access  Public
 */
router.post('/simulate', async (req: Request, res: Response) => {
  try {
    const { invoiceId, status = 'paid' } = req.body;

    if (!invoiceId) {
      return res.status(400).json({
        success: false,
        error: 'invoiceId is required'
      });
    }

    const secretKey = process.env.SECRET_KEY || 'test-secret';
    const nonce = 'simulated-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const timestamp = Date.now();

    const payload = { invoiceId, status };
    
    // Import dynamically to avoid circular dependencies
    const { CryptoUtils } = require('../utils/crypto');
    
    const signature = CryptoUtils.generateSignature(payload, secretKey);

    // Generate signature for webhook

    const redisClient = req.app.locals.redis;

    if (!redisClient) {
      throw new AppError('Redis client not available', 500);
    }

    const result = await WebhookService.processWebhook(
      payload,
      { signature, timestamp, nonce },
      InvoiceService,
      redisClient
    );

    res.status(200).json({
      success: true,
      message: 'Webhook simulated successfully',
      data: {
        invoiceId,
        status,
        signature,
        timestamp,
        nonce,
        result: result.message
      }
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message
      });
    } else {
      console.error('Webhook simulation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to simulate webhook'
      });
    }
  }
});

export default router;