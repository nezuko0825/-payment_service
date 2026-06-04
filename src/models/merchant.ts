import mongoose, { Document, Schema } from 'mongoose';

export interface IMerchant extends Document {
  merchantId: string;
  feePercent: number;
  webhookUrl?: string;
  secretKey: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

const merchantSchema = new Schema<IMerchant>({
  merchantId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  feePercent: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    default: 2.5
  },
  webhookUrl: {
    type: String,
    default: null
  },
  secretKey: {
    type: String,
    required: true,
    select: false // Don't include in query results by default
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: true
});

export const Merchant = mongoose.model<IMerchant>('Merchant', merchantSchema);