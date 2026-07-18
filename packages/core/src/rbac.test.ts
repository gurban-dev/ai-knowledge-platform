import { describe, expect, it } from 'vitest';
import { highestRole, Role, roleSatisfies } from './rbac.js';

describe('roleSatisfies', () => {
  it('honors the role hierarchy', () => {
    expect(roleSatisfies(Role.OWNER, Role.ADMIN)).toBe(true);
    expect(roleSatisfies(Role.ADMIN, Role.ADMIN)).toBe(true);
    expect(roleSatisfies(Role.MEMBER, Role.ADMIN)).toBe(false);
    expect(roleSatisfies(Role.VIEWER, Role.MEMBER)).toBe(false);
  });
});

describe('highestRole', () => {
  it('returns the most privileged role', () => {
    expect(highestRole([Role.VIEWER, Role.ADMIN, Role.MEMBER])).toBe(Role.ADMIN);
    expect(highestRole([Role.OWNER])).toBe(Role.OWNER);
    expect(highestRole([])).toBeUndefined();
  });
});
