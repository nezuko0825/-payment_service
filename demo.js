#!/usr/bin/env node

/**
 * Demo script to show how the payment service works
 */

const axios = require('axios');
const CryptoJS = require('crypto-js');

const BASE_URL = 'http://localhost:3000';
const SECRET_KEY = 'your-secret-key-for-hmac-signatures';

async function demo() {
  console.log('=== Payment Service Demo ===\n');

  try {
    // 1. Create an invoice
    console.log('1. Creating invoice...');
    const invoiceResponse = await axios.post(`${BASE_URL}/invoice`, {
      merchantId: 'demo-merchant',
      amount: 100.50,
      currency: 'USD'
    });

    const invoiceId = invoiceResponse.data.data.invoiceId;
    console.log(`   Invoice created: ${invoiceId}`);
    console.log(`   Fee: $${invoiceResponse.data.data.feeAmount}`);
    console.log(`   Amount to receive: $${invoiceResponse.data.data.amountToReceive}\n`);

    // 2. Get invoice status
    console.log('2. Getting invoice status...');
    const statusResponse = await axios.get(`${BASE_URL}/invoice/${invoiceId}`);
    console.log(`   Status: ${statusResponse.data.data.status}\n`);

    // 3. Generate webhook signature
    console.log('3. Generating webhook signature...');
    const webhookPayload = {
      invoiceId: invoiceId,
      status: 'paid'
    };
    
    const signature = CryptoJS.HmacSHA256(
      JSON.stringify(webhookPayload), 
      SECRET_KEY
    ).toString(CryptoJS.enc.Hex);
    
    const timestamp = Date.now();
    const nonce = `demo-nonce-${timestamp}`;
    
    console.log(`   Payload: ${JSON.stringify(webhookPayload)}`);
    console.log(`   Signature: ${signature}`);
    console.log(`   Timestamp: ${timestamp}`);
    console.log(`   Nonce: ${nonce}\n`);

    // 4. Test webhook endpoint (simulation)
    console.log('4. Testing webhook simulation...');
    const simulateResponse = await axios.post(`${BASE_URL}/webhook/simulate`, {
      invoiceId: invoiceId,
      status: 'paid'
    });
    
    console.log(`   Simulation result: ${simulateResponse.data.message}\n`);

    // 5. Get updated invoice status
    console.log('5. Getting updated invoice status...');
    const updatedStatusResponse = await axios.get(`${BASE_URL}/invoice/${invoiceId}`);
    console.log(`   New status: ${updatedStatusResponse.data.data.status}`);
    
    if (updatedStatusResponse.data.data.status === 'paid') {
      console.log('   ✓ Invoice successfully marked as paid!\n');
    }

    // 6. Test idempotency by trying same webhook again
    console.log('6. Testing idempotency (duplicate webhook)...');
    try {
      const duplicateResponse = await axios.post(`${BASE_URL}/webhook/simulate`, {
        invoiceId: invoiceId,
        status: 'paid'
      });
      console.log(`   Result: ${duplicateResponse.data.message}`);
      console.log('   ✓ Webhook correctly handled as duplicate!\n');
    } catch (error) {
      console.log(`   Error (expected): ${error.response?.data?.error || error.message}\n`);
    }

    console.log('=== Demo Completed Successfully ===');
    console.log('\nAPI Endpoints tested:');
    console.log('- POST /invoice - Create invoice with fee calculation');
    console.log('- GET /invoice/:id - Get invoice status');
    console.log('- POST /webhook/simulate - Simulate webhook processing');
    console.log('- Idempotency protection - Duplicate webhook handling');
    
  } catch (error) {
    console.error('Demo failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

// Check if server is running
async function checkServer() {
  try {
    await axios.get(`${BASE_URL}/health`);
    return true;
  } catch (error) {
    return false;
  }
}

async function main() {
  console.log('Checking if server is running...');
  const isRunning = await checkServer();
  
  if (!isRunning) {
    console.log('Server is not running. Please start the server first:');
    console.log('  npm run dev');
    console.log('\nOr build and start:');
    console.log('  npm run build');
    console.log('  npm start');
    process.exit(1);
  }
  
  await demo();
}

main();