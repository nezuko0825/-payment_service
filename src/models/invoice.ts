import mongoose, { Document, Schema } from 'mongoose';

export interface IInvoice extends Document {
  merchantId: string;
  amount: number;
  currency: string;
  feePercent: number;
  feeAmount: number;
  amountToReceive: number;
  status: 'pending' | 'paid' | 'failed';
  createdAt: Date;
  updatedAt: Date;
  paidAt?: Date;
  failedAt?: Date;
  externalReference?: string;
}

const invoiceSchema = new Schema<IInvoice>({
  merchantId: {
    type: String,
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0.01,
    validate: {
      validator: (value: number) => {
        // Ensure amount has at most 2 decimal places
        return Math.round(value * 100) / 100 === value;
      },
      message: 'Amount must have at most 2 decimal places'
    }
  },
  currency: {
    type: String,
    required: true,
    default: 'USD',
    uppercase: true,
    length: 3
  },
  feePercent: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    default: 2.5 // Default fee percentage
  },
  feeAmount: {
    type: Number,
    required: true,
    min: 0
  },
  amountToReceive: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending',
    index: true
  },
  paidAt: {
    type: Date,
    default: null
  },
  failedAt: {
    type: Date,
    default: null
  },
  externalReference: {
    type: String,
    default: null,
    index: true
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
invoiceSchema.index({ merchantId: 1, createdAt: -1 });
invoiceSchema.index({ status: 1, createdAt: -1 });

export const Invoice = mongoose.model<IInvoice>('Invoice', invoiceSchema);