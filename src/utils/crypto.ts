import CryptoJS from 'crypto-js';

export class CryptoUtils {
  /**
   * Generate HMAC-SHA256 signature
   */
  static generateSignature(data: string | object, secretKey: string): string {
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    return CryptoJS.HmacSHA256(dataString, secretKey).toString(CryptoJS.enc.Hex);
  }

  /**
   * Verify HMAC-SHA256 signature
   */
  static verifySignature(data: string | object, signature: string, secretKey: string): boolean {
    const expectedSignature = this.generateSignature(data, secretKey);
    return signature === expectedSignature;
  }

  /**
   * Generate a unique nonce
   */
  static generateNonce(): string {
    return CryptoJS.lib.WordArray.random(16).toString(CryptoJS.enc.Hex);
  }

  /**
   * Validate timestamp is within acceptable range
   */
  static validateTimestamp(timestamp: number, maxDiffMs: number = 5 * 60 * 1000): boolean {
    const now = Date.now();
    const diff = Math.abs(now - timestamp);
    return diff <= maxDiffMs;
  }

  /**
   * Safe string comparison to prevent timing attacks
   */
  static safeStringCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }
}