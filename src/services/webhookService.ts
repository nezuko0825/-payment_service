import { WebhookLog } from '../models/webhookLog';
import { CryptoUtils } from '../utils/crypto';
import { AppError } from '../middleware/errorHandler';

export interface WebhookPayload {
  invoiceId: string;
  status: 'paid' | 'failed';
}

export interface WebhookHeaders {
  signature: string;
  timestamp: number;
  nonce: string;
}

export class WebhookService {
  /**
   * Validate webhook signature and idempotency
   */
  static async validateWebhook(
    payload: WebhookPayload,
    headers: WebhookHeaders,
    redisClient: any
  ): Promise<{ isValid: boolean; error?: string; merchantSecret?: string }> {
    try {
      // Get merchant secret key (from invoice or merchant lookup)
      // In a real implementation, you would get this from the merchant configuration
      // For now, we'll use the secret from environment
      const merchantSecret = process.env.SECRET_KEY;

      if (!merchantSecret) {
        throw new AppError('Webhook secret not configured', 500);
      }

      // 1. Validate signature
      const isValidSignature = CryptoUtils.verifySignature(
        payload,
        headers.signature,
        merchantSecret
      );

      if (!isValidSignature) {
        throw new AppError('Invalid signature', 401);
      }

      // 2. Validate timestamp (protection against replay attacks)
      const maxTimestampDiff = parseInt(process.env.MAX_TIMESTAMP_DIFF || '300000', 10); // 5 minutes
      const isValidTimestamp = CryptoUtils.validateTimestamp(headers.timestamp, maxTimestampDiff);

      if (!isValidTimestamp) {
        throw new AppError('Timestamp is outside acceptable range', 400);
      }

      // 3. Check nonce uniqueness using Redis for fast lookup
      const nonceKey = `webhook:nonce:${headers.nonce}`;
      const existingNonce = await redisClient.get(nonceKey);

      if (existingNonce) {
        throw new AppError('Nonce already used', 409);
      }

      // 4. Log webhook for idempotency in database
      const webhookLog = new WebhookLog({
        nonce: headers.nonce,
        invoiceId: payload.invoiceId,
        status: payload.status,
        signature: headers.signature,
        timestamp: headers.timestamp,
        processed: false
      });

      await webhookLog.save();

      // 5. Cache nonce in Redis for faster duplicate detection
      await redisClient.set(nonceKey, '1', {
        EX: 24 * 60 * 60 // 24 hours TTL
      });

      return {
        isValid: true,
        merchantSecret
      };
    } catch (error) {
      if (error instanceof AppError) {
        return {
          isValid: false,
          error: error.message
        };
      }
      
      // Log unknown errors but don't expose details
      console.error('Webhook validation error:', error);
      return {
        isValid: false,
        error: 'Webhook validation failed'
      };
    }
  }

  /**
   * Process webhook payment status update
   */
  static async processWebhook(
    payload: WebhookPayload,
    headers: WebhookHeaders,
    invoiceService: any,
    redisClient: any
  ): Promise<{ success: boolean; message: string; invoiceId: string }> {
    try {
      // Validate webhook first
      const validationResult = await this.validateWebhook(payload, headers, redisClient);

      if (!validationResult.isValid) {
        throw new AppError(validationResult.error || 'Webhook validation failed', 400);
      }

      // Check if webhook was already processed (additional idempotency check)
      const existingWebhook = await WebhookLog.findOne({
        nonce: headers.nonce,
        processed: true
      });

      if (existingWebhook) {
        return {
          success: true,
          message: 'Webhook already processed',
          invoiceId: payload.invoiceId
        };
      }

      // Process invoice status update
      const result = await invoiceService.updateInvoiceStatus(
        payload.invoiceId,
        payload.status,
        headers.nonce,
        redisClient
      );

      // Mark webhook as processed
      await WebhookLog.findOneAndUpdate(
        { nonce: headers.nonce },
        { 
          processed: true,
          processedAt: new Date()
        }
      );

      return {
        success: result.success,
        message: result.message,
        invoiceId: payload.invoiceId
      };
    } catch (error) {
      // Update webhook log with error
      await WebhookLog.findOneAndUpdate(
        { nonce: headers.nonce },
        { 
          processed: true,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      ).catch(() => {
        // Ignore errors when updating webhook log
      });

      throw error;
    }
  }
}