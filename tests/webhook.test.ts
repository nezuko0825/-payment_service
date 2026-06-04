import request from 'supertest';
import app from '../src/index';
import { Invoice } from '../src/models/invoice';
import { Merchant } from '../src/models/merchant';
import { WebhookLog } from '../src/models/webhookLog';
import mongoose from 'mongoose';
import { createClient } from 'redis';
import { CryptoUtils } from '../src/utils/crypto';

describe('Webhook API', () => {
  let redisClient: any;
  let testMerchantId: string;
  let testInvoiceId: string;
  let secretKey: string;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect('mongodb://localhost:27017/test-payment-service');
    
    // Setup Redis client
    redisClient = createClient({
      url: 'redis://localhost:6379'
    });
    await redisClient.connect();
    
    // Setup environment
    secretKey = process.env.SECRET_KEY = 'test-webhook-secret';
    testMerchantId = 'test-merchant-webhook-' + Date.now();
    
    // Create test merchant
    await Merchant.create({
      merchantId: testMerchantId,
      feePercent: 2.5,
      secretKey: secretKey,
      isActive: true
    });
    
    // Attach Redis to app
    app.locals.redis = redisClient;
  });

  afterAll(async () => {
    // Cleanup test data
    await Invoice.deleteMany({});
    await Merchant.deleteMany({});
    await WebhookLog.deleteMany({});
    await redisClient.quit();
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await Invoice.deleteMany({});
    await WebhookLog.deleteMany({});
    
    // Create a test invoice
    const invoice = await Invoice.create({
      merchantId: testMerchantId,
      amount: 100.50,
      currency: 'USD',
      feePercent: 2.5,
      feeAmount: 2.51,
      amountToReceive: 97.99,
      status: 'pending'
    });
    
    testInvoiceId = invoice._id.toString();
  });

  describe('POST /webhook', () => {
    const generateWebhookHeaders = (payload: any, nonce?: string) => {
      const timestamp = Date.now();
      const nonceValue = nonce || `test-nonce-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;
      const signature = CryptoUtils.generateSignature(payload, secretKey);
      
      return {
        'X-Signature': signature,
        'X-Timestamp': timestamp.toString(),
        'X-Nonce': nonceValue
      };
    };

    it('should process valid webhook', async () => {
      const payload = {
        invoiceId: testInvoiceId,
        status: 'paid'
      };

      const headers = generateWebhookHeaders(payload);

      const response = await request(app)
        .post('/webhook')
        .set(headers)
        .send(payload)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Invoice status updated to paid');
      expect(response.body.data.invoiceId).toBe(testInvoiceId);
      expect(response.body.data.status).toBe('paid');

      // Verify invoice was updated
      const updatedInvoice = await Invoice.findById(testInvoiceId);
      expect(updatedInvoice?.status).toBe('paid');
      expect(updatedInvoice?.paidAt).toBeDefined();

      // Verify webhook was logged
      const webhookLog = await WebhookLog.findOne({ nonce: headers['X-Nonce'] });
      expect(webhookLog).toBeDefined();
      expect(webhookLog?.processed).toBe(true);
    });

    it('should be idempotent for duplicate webhooks', async () => {
      const payload = {
        invoiceId: testInvoiceId,
        status: 'paid'
      };

      const headers = generateWebhookHeaders(payload, 'test-nonce-unique');

      // First request
      const firstResponse = await request(app)
        .post('/webhook')
        .set(headers)
        .send(payload)
        .expect(200);

      expect(firstResponse.body.success).toBe(true);

      // Second identical request
      const secondResponse = await request(app)
        .post('/webhook')
        .set(headers)
        .send(payload)
        .expect(200);

      expect(secondResponse.body.success).toBe(true);
      expect(secondResponse.body.message).toContain('already processed');

      // Should only have one webhook log entry
      const webhookLogs = await WebhookLog.find({ nonce: headers['X-Nonce'] });
      expect(webhookLogs.length).toBe(1);
    });

    it('should reject invalid signature', async () => {
      const payload = {
        invoiceId: testInvoiceId,
        status: 'paid'
      };

      const headers = generateWebhookHeaders(payload);
      headers['X-Signature'] = 'invalid-signature';

      const response = await request(app)
        .post('/webhook')
        .set(headers)
        .send(payload)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid signature');
    });

    it('should reject old timestamp', async () => {
      const payload = {
        invoiceId: testInvoiceId,
        status: 'paid'
      };

      const timestamp = Date.now() - 10 * 60 * 1000; // 10 minutes ago
      const signature = CryptoUtils.generateSignature(payload, secretKey);

      const headers = {
        'X-Signature': signature,
        'X-Timestamp': timestamp.toString(),
        'X-Nonce': `test-nonce-${Date.now()}`
      };

      const response = await request(app)
        .post('/webhook')
        .set(headers)
        .send(payload)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Timestamp');
    });

    it('should reject future timestamp', async () => {
      const payload = {
        invoiceId: testInvoiceId,
        status: 'paid'
      };

      const timestamp = Date.now() + 10 * 60 * 1000; // 10 minutes in future
      const signature = CryptoUtils.generateSignature(payload, secretKey);

      const headers = {
        'X-Signature': signature,
        'X-Timestamp': timestamp.toString(),
        'X-Nonce': `test-nonce-${Date.now()}`
      };

      const response = await request(app)
        .post('/webhook')
        .set(headers)
        .send(payload)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Timestamp');
    });

    it('should process failed status', async () => {
      const payload = {
        invoiceId: testInvoiceId,
        status: 'failed'
      };

      const headers = generateWebhookHeaders(payload);

      const response = await request(app)
        .post('/webhook')
        .set(headers)
        .send(payload)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Invoice status updated to failed');

      const updatedInvoice = await Invoice.findById(testInvoiceId);
      expect(updatedInvoice?.status).toBe('failed');
      expect(updatedInvoice?.failedAt).toBeDefined();
    });

    it('should handle concurrent webhooks gracefully', async () => {
      const payload = {
        invoiceId: testInvoiceId,
        status: 'paid'
      };

      const nonce1 = `concurrent-nonce-1-${Date.now()}`;
      const nonce2 = `concurrent-nonce-2-${Date.now()}`;

      const headers1 = generateWebhookHeaders(payload, nonce1);
      const headers2 = generateWebhookHeaders(payload, nonce2);

      // Send concurrent requests
      const [response1, response2] = await Promise.all([
        request(app).post('/webhook').set(headers1).send(payload),
        request(app).post('/webhook').set(headers2).send(payload)
      ]);

      // One should succeed, one should detect conflict
      expect(response1.status + response2.status).toBe('200409');

      const successResponse = response1.status === 200 ? response1 : response2;
      const conflictResponse = response1.status === 409 ? response1 : response2;

      expect(successResponse.body.success).toBe(true);
      expect(conflictResponse.body.success).toBe(false);
      expect(conflictResponse.body.error).toContain('currently being processed');
    });
  });

  describe('POST /webhook/simulate', () => {
    it('should simulate webhook successfully', async () => {
      const response = await request(app)
        .post('/webhook/simulate')
        .send({
          invoiceId: testInvoiceId,
          status: 'paid'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('simulated successfully');
      expect(response.body.data.signature).toBeDefined();
      expect(response.body.data.nonce).toBeDefined();
      expect(response.body.data.timestamp).toBeDefined();

      // Verify invoice was updated
      const updatedInvoice = await Invoice.findById(testInvoiceId);
      expect(updatedInvoice?.status).toBe('paid');
    });
  });
});