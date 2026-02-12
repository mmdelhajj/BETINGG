import { describe, it, expect } from 'vitest';
import { SecurityAudit } from '../../src/utils/securityAudit';
import { sanitizeInput, sanitizeObject } from '../../src/middleware/security';

describe('SecurityAudit', () => {
  describe('validatePasswordStrength', () => {
    it('rejects short passwords', () => {
      const result = SecurityAudit.validatePasswordStrength('short');
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Password must be at least 8 characters');
    });

    it('rejects passwords without uppercase', () => {
      const result = SecurityAudit.validatePasswordStrength('lowercase123!');
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Password must contain an uppercase letter');
    });

    it('rejects passwords without lowercase', () => {
      const result = SecurityAudit.validatePasswordStrength('UPPERCASE123!');
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Password must contain a lowercase letter');
    });

    it('rejects passwords without numbers', () => {
      const result = SecurityAudit.validatePasswordStrength('NoNumbers!abc');
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Password must contain a number');
    });

    it('rejects common passwords', () => {
      const result = SecurityAudit.validatePasswordStrength('password');
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Password is too common');
    });

    it('accepts strong passwords', () => {
      const result = SecurityAudit.validatePasswordStrength('Str0ng!P@ssword');
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe('validateEmail', () => {
    it('accepts valid emails', () => {
      expect(SecurityAudit.validateEmail('user@example.com')).toBe(true);
      expect(SecurityAudit.validateEmail('test.user+tag@domain.co.uk')).toBe(true);
    });

    it('rejects invalid emails', () => {
      expect(SecurityAudit.validateEmail('not-an-email')).toBe(false);
      expect(SecurityAudit.validateEmail('@no-user.com')).toBe(false);
      expect(SecurityAudit.validateEmail('user@')).toBe(false);
    });
  });

  describe('validateCryptoAddress', () => {
    it('validates BTC addresses', () => {
      expect(SecurityAudit.validateCryptoAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', 'BTC')).toBe(true);
      expect(SecurityAudit.validateCryptoAddress('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', 'BTC')).toBe(true);
      expect(SecurityAudit.validateCryptoAddress('invalid', 'BTC')).toBe(false);
    });

    it('validates ETH addresses', () => {
      expect(SecurityAudit.validateCryptoAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f6E309', 'ETH')).toBe(true);
      expect(SecurityAudit.validateCryptoAddress('invalid', 'ETH')).toBe(false);
    });

    it('accepts unknown currencies', () => {
      expect(SecurityAudit.validateCryptoAddress('any-address', 'UNKNOWN')).toBe(true);
    });
  });

  describe('validateAmount', () => {
    it('rejects empty amounts', () => {
      expect(SecurityAudit.validateAmount('').valid).toBe(false);
    });

    it('rejects negative amounts', () => {
      expect(SecurityAudit.validateAmount('-1').valid).toBe(false);
    });

    it('rejects zero amounts', () => {
      expect(SecurityAudit.validateAmount('0').valid).toBe(false);
    });

    it('rejects excessively large amounts', () => {
      expect(SecurityAudit.validateAmount('9999999999999999').valid).toBe(false);
    });

    it('accepts valid amounts', () => {
      expect(SecurityAudit.validateAmount('0.001').valid).toBe(true);
      expect(SecurityAudit.validateAmount('100').valid).toBe(true);
      expect(SecurityAudit.validateAmount('999999').valid).toBe(true);
    });

    it('rejects too many decimal places', () => {
      expect(SecurityAudit.validateAmount('1.0000000000000000001').valid).toBe(false);
    });
  });
});

describe('Input Sanitization', () => {
  describe('sanitizeInput', () => {
    it('strips HTML tags', () => {
      expect(sanitizeInput('<script>alert("xss")</script>')).toBe('scriptalert("xss")/script');
    });

    it('strips javascript: protocol', () => {
      expect(sanitizeInput('javascript:alert(1)')).toBe('alert(1)');
    });

    it('strips inline event handlers', () => {
      expect(sanitizeInput('onerror=alert(1)')).toBe('alert(1)');
    });

    it('strips null bytes', () => {
      expect(sanitizeInput('hello\x00world')).toBe('helloworld');
    });

    it('preserves safe strings', () => {
      expect(sanitizeInput('Hello World 123')).toBe('Hello World 123');
    });
  });

  describe('sanitizeObject', () => {
    it('sanitizes nested objects', () => {
      const input = { name: '<script>alert(1)</script>', nested: { value: 'javascript:void(0)' } };
      const result = sanitizeObject(input);
      expect(result.name).not.toContain('<script>');
      expect(result.nested.value).not.toContain('javascript:');
    });

    it('sanitizes arrays', () => {
      const input = ['<img onerror=alert(1)>', 'safe string'];
      const result = sanitizeObject(input);
      expect(result[0]).not.toContain('onerror');
      expect(result[1]).toBe('safe string');
    });
  });
});
