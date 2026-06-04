import mongoose from 'mongoose';
import { Merchant } from '../models/merchant';
import dotenv from 'dotenv';

dotenv.config();

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/payment-service');
    console.log('Connected to MongoDB for seeding');

    // Clear existing data
    await Merchant.deleteMany({});
    console.log('Cleared existing merchants');

    // Seed test merchants
    const merchants = [
      {
        merchantId: 'merchant_001',
        feePercent: 2.5,
        secretKey: 'test-secret-key-001',
        isActive: true
      },
      {
        merchantId: 'merchant_002',
        feePercent: 1.9,
        secretKey: 'test-secret-key-002',
        isActive: true
      },
      {
        merchantId: 'merchant_003',
        feePercent: 3.0,
        secretKey: 'test-secret-key-003',
        webhookUrl: 'https://webhook.merchant3.example.com/payment',
        isActive: true
      },
      {
        merchantId: 'inactive_merchant',
        feePercent: 2.0,
        secretKey: 'test-secret-key-inactive',
        isActive: false
      }
    ];

    await Merchant.insertMany(merchants);
    console.log(`Seeded ${merchants.length} merchants`);

    console.log('Database seeding completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();