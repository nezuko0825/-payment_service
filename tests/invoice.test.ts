import request from 'supertest';
import app from '../src/index';
import { Invoice } from '../src/models/invoice';
import { Merchant } from '../src/models/merchant';
import mongoose from 'mongoose';
import { createClient } from 'redis';

describe('Invoice API', () => {
  let redisClient: any;
  let testMerchantId: string;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect('mongodb://localhost:27017/test-payment-service');
    
    // Setup Redis client
    redisClient = createClient({
      url: 'redis://localhost:6379'
    });
    await redisClient.connect();
    
    // Create test merchant
    testMerchantId = 'test-merchant-' + Date.now();
    await Merchant.create({
      merchantId: testMerchantId,
      feePercent: 2.5,
      secretKey: 'test-secret-key',
      isActive: true
    });
    
    // Attach Redis to app
    app.locals.redis = redisClient;
  });

  afterAll(async () => {
    // Cleanup test data
    await Invoice.deleteMany({});
    await Merchant.deleteMany({});
    await redisClient.quit();
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await Invoice.deleteMany({});
  });

  describe('POST /invoice', () => {
    it('should create a new invoice', async () => {
      const response = await request(app)
        .post('/invoice')
        .send({
          merchantId: testMerchantId,
          amount: 100.50,
          currency: 'USD'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('invoiceId');
      expect(response.body.data.amount).toBe(100.5);
      expect(response.body.data.currency).toBe('USD');
      expect(response.body.data.feePercent).toBe(2.5);
      expect(response.body.data.feeAmount).toBe(2.51); // 100.50 * 0.025 = 2.5125 rounded to 2.51
      expect(response.body.data.amountToReceive).toBe(97.99); // 100.50 - 2.51 = 97.99
      expect(response.body.data.status).toBe('pending');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/invoice')
        .send({})
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });

    it('should validate amount minimum', async () => {
      const response = await request(app)
        .post('/invoice')
        .send({
          merchantId: testMerchantId,
          amount: 0,
          currency: 'USD'
        })
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });

    it('should validate decimal places', async () => {
      const response = await request(app)
        .post('/invoice')
        .send({
          merchantId: testMerchantId,
          amount: 100.123,
          currency: 'USD'
        })
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });

    it('should return error for non-existent merchant', async () => {
      const response = await request(app)
        .post('/invoice')
        .send({
          merchantId: 'non-existent-merchant',
          amount: 100.50,
          currency: 'USD'
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Merchant not found');
    });
  });

  describe('GET /invoice/:id', () => {
    it('should get invoice by ID', async () => {
      // First create an invoice
      const createResponse = await request(app)
        .post('/invoice')
        .send({
          merchantId: testMerchantId,
          amount: 50.25,
          currency: 'USD'
        })
        .expect(201);

      const invoiceId = createResponse.body.data.invoiceId;

      // Then retrieve it
      const getResponse = await request(app)
        .get(`/invoice/${invoiceId}`)
        .expect(200);

      expect(getResponse.body.success).toBe(true);
      expect(getResponse.body.data.invoiceId).toBe(invoiceId);
      expect(getResponse.body.data.amount).toBe(50.25);
    });

    it('should return 404 for non-existent invoice', async () => {
      const response = await request(app)
        .get('/invoice/507f1f77bcf86cd799439011')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invoice not found');
    });

    it('should validate invoice ID format', async () => {
      const response = await request(app)
        .get('/invoice/invalid-id')
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });
  });
});