import mongoose, { Document, Schema } from 'mongoose';

export interface IWebhookLog extends Document {
  nonce: string;
  invoiceId: string;
  status: string;
  signature: string;
  timestamp: number;
  processed: boolean;
  processedAt?: Date;
  error?: string;
  createdAt: Date;
}

const webhookLogSchema = new Schema<IWebhookLog>({
  nonce: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  invoiceId: {
    type: String,
    required: true,
    index: true
  },
  status: {
    type: String,
    required: true,
    enum: ['paid', 'failed']
  },
  signature: {
    type: String,
    required: true
  },
  timestamp: {
    type: Number,
    required: true,
    index: true
  },
  processed: {
    type: Boolean,
    default: false,
    index: true
  },
  processedAt: {
    type: Date,
    default: null
  },
  error: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// TTL index for automatic cleanup of old webhook logs (30 days)
webhookLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const WebhookLog = mongoose.model<IWebhookLog>('WebhookLog', webhookLogSchema);