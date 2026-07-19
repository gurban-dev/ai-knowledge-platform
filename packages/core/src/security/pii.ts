/**
 * Lightweight, dependency-free PII detection and redaction.
 *
 * Used at ingestion (to optionally redact sensitive content before it is chunked
 * and embedded) and on model inputs/outputs. This is deterministic and fast; it
 * is not a replacement for a full DLP engine, but it catches the high-frequency
 * identifiers that matter for regulated customers (email, phone, SSN, cards, IPs).
 */

export type PiiType = 'email' | 'phone' | 'ssn' | 'credit_card' | 'ipv4';

export interface PiiFinding {
  type: PiiType;
  value: string;
  start: number;
  end: number;
}

interface Detector {
  type: PiiType;
  pattern: RegExp;
  /** Optional extra validation (e.g. Luhn for cards). */
  validate?: (match: string) => boolean;
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// North-American style phone numbers with optional country code and separators.
const PHONE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
const SSN = /\b\d{3}-\d{2}-\d{4}\b/g;
const CREDIT_CARD = /\b(?:\d[ -]?){13,19}\b/g;
const IPV4 =
  /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g;

/** Luhn checksum — rejects random digit runs that merely look card-shaped. */
function luhnValid(input: string): boolean {
  const digits = input.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

const DETECTORS: Detector[] = [
  { type: 'email', pattern: EMAIL },
  { type: 'ssn', pattern: SSN },
  { type: 'credit_card', pattern: CREDIT_CARD, validate: luhnValid },
  { type: 'ipv4', pattern: IPV4 },
  { type: 'phone', pattern: PHONE },
];

/** Detect PII occurrences in a string, ordered by position. */
export function detectPii(text: string): PiiFinding[] {
  const findings: PiiFinding[] = [];
  for (const detector of DETECTORS) {
    const re = new RegExp(detector.pattern.source, detector.pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const value = match[0];
      if (detector.validate && !detector.validate(value)) continue;
      findings.push({
        type: detector.type,
        value,
        start: match.index,
        end: match.index + value.length,
      });
    }
  }
  return findings.sort((a, b) => a.start - b.start);
}

/**
 * Replace detected PII with a stable token like `[REDACTED_EMAIL]`. Overlapping
 * matches are resolved by preferring the earliest, longest finding.
 */
export function redactPii(text: string): { redacted: string; findings: PiiFinding[] } {
  const findings = detectPii(text);
  if (findings.length === 0) return { redacted: text, findings };

  // Resolve overlaps: keep non-overlapping findings in positional order.
  const kept: PiiFinding[] = [];
  let cursor = -1;
  for (const finding of findings) {
    if (finding.start >= cursor) {
      kept.push(finding);
      cursor = finding.end;
    }
  }

  let result = '';
  let last = 0;
  for (const finding of kept) {
    result += text.slice(last, finding.start);
    result += `[REDACTED_${finding.type.toUpperCase()}]`;
    last = finding.end;
  }
  result += text.slice(last);
  return { redacted: result, findings: kept };
}

/** True if any PII is present. */
export function containsPii(text: string): boolean {
  return detectPii(text).length > 0;
}
