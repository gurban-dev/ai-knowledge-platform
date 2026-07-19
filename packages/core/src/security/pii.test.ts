import { describe, expect, it } from 'vitest';
import { containsPii, detectPii, redactPii } from './pii.js';

describe('detectPii', () => {
  it('finds emails', () => {
    const findings = detectPii('contact me at jane.doe@example.com please');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.type).toBe('email');
    expect(findings[0]?.value).toBe('jane.doe@example.com');
  });

  it('finds SSNs', () => {
    expect(detectPii('SSN 123-45-6789').some((f) => f.type === 'ssn')).toBe(true);
  });

  it('validates credit cards with Luhn', () => {
    // Valid Visa test number (passes Luhn).
    expect(detectPii('card 4111 1111 1111 1111').some((f) => f.type === 'credit_card')).toBe(true);
    // Fails Luhn -> not flagged as a card.
    expect(detectPii('id 4111 1111 1111 1112').some((f) => f.type === 'credit_card')).toBe(false);
  });

  it('finds IPv4 addresses', () => {
    expect(detectPii('from 192.168.1.10').some((f) => f.type === 'ipv4')).toBe(true);
  });
});

describe('redactPii', () => {
  it('replaces PII with typed tokens', () => {
    const { redacted, findings } = redactPii('email a@b.com or call 415-555-1234');
    expect(redacted).toContain('[REDACTED_EMAIL]');
    expect(redacted).toContain('[REDACTED_PHONE]');
    expect(redacted).not.toContain('a@b.com');
    expect(findings.length).toBeGreaterThanOrEqual(2);
  });

  it('leaves clean text untouched', () => {
    const { redacted, findings } = redactPii('no sensitive data here');
    expect(redacted).toBe('no sensitive data here');
    expect(findings).toHaveLength(0);
  });
});

describe('containsPii', () => {
  it('returns a boolean', () => {
    expect(containsPii('x@y.com')).toBe(true);
    expect(containsPii('hello world')).toBe(false);
  });
});
