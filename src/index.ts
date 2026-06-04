import express from 'express';
import mongoose from 'mongoose';
import { createClient } from 'redis';
import dotenv from 'dotenv';
import invoiceRoutes from './routes/invoice';
import webhookRoutes from './routes/webhook';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (_, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/invoice', invoiceRoutes);
app.use('/webhook', webhookRoutes);

// Error handling middleware
app.use(errorHandler);

// Database connections
const connectToDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/payment-service');
    console.log('Connected to MongoDB');
  } catch (error: any) {
    console.error('❌ MongoDB connection error:', error?.message || error);
    console.error('💡 Please ensure MongoDB is running or update MONGODB_URI in .env file');
    console.error('📋 Install MongoDB from: https://www.mongodb.com/try/download/community');
    console.error('   Then start MongoDB with: mongod');
    console.error('   Or update .env with a different MongoDB connection string');
    process.exit(1);
  }
};

const connectToRedis = async () => {
  const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });

  redisClient.on('error', (err) => console.error('Redis Client Error', err));

  try {
    await redisClient.connect();
    console.log('Connected to Redis');
  } catch (error: any) {
    console.error('❌ Redis connection error:', error?.message || error);
    console.error('💡 Please ensure Redis is running or update REDIS_URL in .env file');
    console.error('📋 Install Redis from: https://redis.io/download/');
    console.error('   Then start Redis with: redis-server');
    console.error('   Or update .env with a different Redis connection string');
    throw error;
  }
  
  return redisClient;
};

// Start server
const startServer = async () => {
  try {
    await connectToDatabase();
    const redisClient = await connectToRedis();
    
    // Attach Redis client to app locals for easy access
    app.locals.redis = redisClient;
    
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await mongoose.connection.close();
  if (app.locals.redis) {
    await app.locals.redis.quit();
  }
  process.exit(0);
});

startServer();

export default app;