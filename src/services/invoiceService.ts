import { Invoice, IInvoice } from '../models/invoice';
import { Merchant } from '../models/merchant';
import { AppError } from '../middleware/errorHandler';

export interface CreateInvoiceInput {
  merchantId: string;
  amount: number;
  currency: string;
}

export interface InvoiceResponse {
  invoiceId: string;
  amount: number;
  currency: string;
  feePercent: number;
  feeAmount: number;
  amountToReceive: number;
  status: string;
  createdAt: Date;
}

export class InvoiceService {
  /**
   * Create a new invoice
   */
  static async createInvoice(data: CreateInvoiceInput): Promise<InvoiceResponse> {
    try {
      // Get merchant fee settings
      const merchant = await Merchant.findOne({ 
        merchantId: data.merchantId,
        isActive: true 
      }).select('feePercent');

      if (!merchant) {
        throw new AppError('Merchant not found or inactive', 404);
      }

      // Create invoice with calculated fee
      const feePercent = merchant.feePercent;
      const feeAmount = Number((data.amount * feePercent / 100).toFixed(2));
      const amountToReceive = Number((data.amount - feeAmount).toFixed(2));

      const invoice = new Invoice({
        merchantId: data.merchantId,
        amount: data.amount,
        currency: data.currency.toUpperCase() || 'USD',
        feePercent,
        feeAmount,
        amountToReceive,
        status: 'pending'
      });

      await invoice.save();

      return {
        invoiceId: invoice._id.toString(),
        amount: invoice.amount,
        currency: invoice.currency,
        feePercent: invoice.feePercent,
        feeAmount: invoice.feeAmount,
        amountToReceive: invoice.amountToReceive,
        status: invoice.status,
        createdAt: invoice.createdAt
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to create invoice', 500);
    }
  }

  /**
   * Get invoice by ID
   */
  static async getInvoiceById(id: string): Promise<InvoiceResponse> {
    try {
      const invoice = await Invoice.findById(id);

      if (!invoice) {
        throw new AppError('Invoice not found', 404);
      }

      return {
        invoiceId: invoice._id.toString(),
        amount: invoice.amount,
        currency: invoice.currency,
        feePercent: invoice.feePercent,
        feeAmount: invoice.feeAmount,
        amountToReceive: invoice.amountToReceive,
        status: invoice.status,
        createdAt: invoice.createdAt
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to get invoice', 500);
    }
  }

  /**
   * Update invoice status with idempotency check
   */
  static async updateInvoiceStatus(
    invoiceId: string, 
    status: 'paid' | 'failed',
    nonce: string,
    redisClient: any
  ): Promise<{ success: boolean; message: string; invoice?: IInvoice }> {
    const lockKey = `invoice:${invoiceId}:lock`;
    
    try {
      // Acquire distributed lock to prevent race conditions
      const lockAcquired = await redisClient.set(lockKey, '1', {
        EX: 10, // 10 second lock
        NX: true // Only set if not exists
      });

      if (!lockAcquired) {
        throw new AppError('Invoice is currently being processed', 409);
      }

      // Check idempotency using Redis
      const idempotencyKey = `invoice:${invoiceId}:status:${nonce}`;
      const existingResult = await redisClient.get(idempotencyKey);

      if (existingResult) {
        return JSON.parse(existingResult);
      }

      // Update invoice status with optimistic concurrency control
      const invoice = await Invoice.findById(invoiceId);

      if (!invoice) {
        throw new AppError('Invoice not found', 404);
      }

      // Prevent status change if already in final state
      if (invoice.status === 'paid' || invoice.status === 'failed') {
        const result = {
          success: true,
          message: `Invoice already in final state: ${invoice.status}`,
          invoice
        };
        
        // Cache idempotent result
        await redisClient.set(idempotencyKey, JSON.stringify(result), {
          EX: 24 * 60 * 60 // 24 hours
        });

        return result;
      }

      // Update invoice status with timestamps
      invoice.status = status;
      
      // Set appropriate timestamps based on status
      if (status === 'paid') {
        invoice.paidAt = new Date();
        invoice.failedAt = undefined;
      } else if (status === 'failed') {
        invoice.failedAt = new Date();
        invoice.paidAt = undefined;
      }
      
      await invoice.save();

      const result = {
        success: true,
        message: `Invoice status updated to ${status}`,
        invoice
      };

      // Cache idempotent result
      await redisClient.set(idempotencyKey, JSON.stringify(result), {
        EX: 24 * 60 * 60 // 24 hours
      });

      return result;
    } finally {
      // Always release lock
      await redisClient.del(lockKey).catch(() => {
        // Ignore errors when releasing lock
      });
    }
  }

  /**
   * Validate merchant exists and is active
   */
  static async validateMerchant(merchantId: string): Promise<boolean> {
    const merchant = await Merchant.findOne({ 
      merchantId, 
      isActive: true 
    }).select('_id');
    return !!merchant;
  }
}