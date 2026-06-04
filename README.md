# Payment Service API

A Node.js payment service for processing invoices and webhooks with support for idempotent operations, HMAC signature verification, and concurrent request handling.

## Features

- **Invoice Creation**: Create payment invoices with automatic fee calculation
- **Webhook Processing**: Secure webhook handling with HMAC-SHA256 signature verification
- **Idempotent Operations**: Protection against duplicate webhook processing
- **Concurrent Safety**: Distributed locking to prevent race conditions
- **TypeScript Support**: Full TypeScript implementation with type safety
- **Comprehensive Testing**: Unit and integration tests for all critical paths

## Tech Stack

- **Node.js** + **Express** - Web framework
- **MongoDB** + **Mongoose** - Database and ODM
- **Redis** - Caching and distributed locking
- **TypeScript** - Type safety and better developer experience
- **Jest** - Testing framework
- **CryptoJS** - HMAC-SHA256 signature generation/verification

## API Endpoints

### 1. Create Invoice
```http
POST /invoice
Content-Type: application/json

{
  "merchantId": "merchant_123",
  "amount": 100.50,
  "currency": "USD"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "invoiceId": "507f1f77bcf86cd799439011",
    "amount": 100.5,
    "currency": "USD",
    "feePercent": 2.5,
    "feeAmount": 2.51,
    "amountToReceive": 97.99,
    "status": "pending",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 2. Get Invoice Status
```http
GET /invoice/:id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "invoiceId": "507f1f77bcf86cd799439011",
    "amount": 100.5,
    "currency": "USD",
    "feePercent": 2.5,
    "feeAmount": 2.51,
    "amountToReceive": 97.99,
    "status": "pending",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 3. Process Webhook
```http
POST /webhook
X-Signature: hmac-sha256-signature
X-Timestamp: 1672531200000
X-Nonce: unique-nonce-value
Content-Type: application/json

{
  "invoiceId": "507f1f77bcf86cd799439011",
  "status": "paid"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Invoice status updated to paid",
  "data": {
    "invoiceId": "507f1f77bcf86cd799439011",
    "status": "paid"
  }
}
```

## Installation

### Prerequisites
- **Node.js 16+** - [Download Node.js](https://nodejs.org/)
- **MongoDB 4.4+** (optional for development) - OR use Docker: `docker run -d -p 27017:27017 mongo`
- **Redis 6+** (optional for development) - OR use Docker: `docker run -d -p 6379:6379 redis`

### Quick Setup with Docker (Recommended)

If you have Docker installed, this is the easiest way:

```bash
# Start MongoDB and Redis with Docker
docker run -d -p 27017:27017 --name mongodb-payment mongo
docker run -d -p 6379:6379 --name redis-payment redis

# Or use Docker Compose (starts both services)
docker-compose up -d

# Then setup the application
npm install
cp .env.example .env
npm run dev
```

### Manual Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd payment-service
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Update `.env` with your configuration:
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/payment-service  # Update if MongoDB is not on localhost
REDIS_URL=redis://localhost:6379                       # Update if Redis is not on localhost
SECRET_KEY=your-secret-key-for-hmac-signatures
WEBHOOK_TIMEOUT=300000
MAX_TIMESTAMP_DIFF=300000
```

5. **Important**: Make sure MongoDB and Redis are running:
   - **MongoDB**: Run `mongod` or start MongoDB service
   - **Redis**: Run `redis-server` or start Redis service

6. Start development server:
```bash
npm run dev
```

### Development Without Databases

For quick testing without installing databases:

1. **Run tests only** (tests use in-memory/mock databases):
```bash
npm test
```

2. **Use Docker Compose** (starts everything automatically):
```bash
docker-compose up
```

3. **Check the demo script** for API examples:
```bash
node demo.js
```

### Troubleshooting Connection Errors

If you see connection errors when running `npm run dev`:

1. **MongoDB not running**: Start MongoDB or use Docker
2. **Redis not running**: Start Redis or use Docker  
3. **Use different connection strings**: Update `.env` file
4. **Run tests instead**: `npm test` works without databases
5. **Check the error messages**: The app provides helpful instructions

## Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Security Features

### 1. HMAC Signature Verification
- All webhooks require `X-Signature` header with HMAC-SHA256 signature
- Signature is calculated from request body using secret key
- Prevents unauthorized webhook injections

### 2. Timestamp Validation
- `X-Timestamp` header must be within 5 minutes of current time
- Prevents replay attacks with old webhooks

### 3. Nonce Uniqueness
- `X-Nonce` header must be unique per webhook
- Stored in Redis and database for fast duplicate detection
- Ensures idempotent webhook processing

### 4. Distributed Locking
- Redis-based locking for invoice status updates
- Prevents race conditions in concurrent webhook processing
- Automatic lock expiration for deadlock prevention

### 5. Input Validation
- Comprehensive validation for all API inputs
- Decimal precision validation for monetary amounts
- MongoDB ObjectId validation
- Enum validation for status values

## Database Models

### Invoice
```typescript
{
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
}
```

### Merchant
```typescript
{
  merchantId: string;
  feePercent: number;
  webhookUrl?: string;
  secretKey: string;
  isActive: boolean;
}
```

### Webhook Log
```typescript
{
  nonce: string;
  invoiceId: string;
  status: string;
  signature: string;
  timestamp: number;
  processed: boolean;
  processedAt?: Date;
  error?: string;
}
```

## Design Decisions

### 1. Idempotency
- Implemented at multiple levels (Redis cache, database log)
- Nonce-based duplicate detection with 24-hour TTL
- Webhook logging for audit trail

### 2. Concurrency Control
- Redis distributed locks for invoice updates
- Optimistic concurrency checks in database
- Transaction-like behavior without MongoDB transactions

### 3. Monetary Calculations
- Fixed decimal precision (2 decimal places)
- Fee calculation: `fee = amount × feePercent / 100`
- Amount to receive: `amount - fee`
- Rounding to prevent floating point errors

### 4. Error Handling
- Structured error responses
- Operational vs programmer errors
- Graceful degradation
- Comprehensive logging

### 5. Testing Strategy
- Unit tests for business logic
- Integration tests for API endpoints
- Property-based testing for edge cases
- Mock external services (Redis, MongoDB)

## Assumptions

1. **Merchant Configuration**: Merchant fee percentages are stored in a separate collection
2. **Currency Support**: Currently supports USD as default, extensible for other currencies
3. **Fee Calculation**: Fees are calculated at invoice creation time
4. **Webhook Security**: HMAC signatures use a shared secret key
5. **Idempotency Window**: 24-hour window for nonce uniqueness
6. **Timestamp Tolerance**: 5-minute window for timestamp validation

## Development Notes

### What's Included
- Complete API implementation with all required endpoints
- Comprehensive input validation and error handling
- Security features (signature verification, idempotency)
- Database models with proper indexes
- Redis integration for caching and locking
- Test suite covering critical functionality

### What Could Be Improved
- **Authentication**: Add JWT-based authentication for merchant endpoints
- **Rate Limiting**: Implement rate limiting for API endpoints
- **Monitoring**: Add metrics and monitoring (Prometheus, Grafana)
- **Retry Logic**: Add retry mechanism for failed webhook processing
- **Webhook Queue**: Implement message queue for webhook processing
- **Admin Dashboard**: Add admin interface for invoice management
- **Multiple Environments**: Separate configs for dev/staging/prod

## Running with Docker

```bash
# Build Docker image
docker build -t payment-service .

# Run with Docker Compose
docker-compose up
```

## License

MIT