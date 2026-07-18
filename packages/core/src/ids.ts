import { customAlphabet } from 'nanoid';

/**
 * Prefixed, URL-safe, human-scannable identifiers (Stripe-style: `org_...`, `usr_...`).
 * Prefixes make ids self-describing in logs and prevent accidental cross-type mixups.
 * The random component uses a 24-char base-62 alphabet (~142 bits of entropy).
 */
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const generate = customAlphabet(ALPHABET, 24);

export const IdPrefix = {
  organization: 'org',
  user: 'usr',
  membership: 'mem',
  session: 'ses',
  apiKey: 'key',
  document: 'doc',
  chunk: 'chk',
  dataSource: 'src',
  conversation: 'cnv',
  message: 'msg',
  citation: 'cit',
  auditLog: 'aud',
  ingestionJob: 'job',
  evaluation: 'evl',
  inviteToken: 'inv',
} as const;

export type IdPrefix = (typeof IdPrefix)[keyof typeof IdPrefix];

/** Generate a new prefixed id, e.g. `newId(IdPrefix.user)` -> `usr_a1B2...`. */
export function newId(prefix: IdPrefix): string {
  return `${prefix}_${generate()}`;
}

/** Check whether a value is a well-formed id for the given prefix. */
export function isId(value: unknown, prefix: IdPrefix): value is string {
  return typeof value === 'string' && value.startsWith(`${prefix}_`) && value.length > prefix.length + 1;
}
