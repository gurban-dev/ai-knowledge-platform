import { describe, expect, it } from 'vitest';
import { ApiScope, areValidScopes, scopeSatisfies } from './scopes.js';

describe('scopeSatisfies', () => {
  it('matches an explicitly granted scope', () => {
    expect(scopeSatisfies([ApiScope.DocumentsRead], ApiScope.DocumentsRead)).toBe(true);
  });

  it('denies a scope that was not granted', () => {
    expect(scopeSatisfies([ApiScope.DocumentsRead], ApiScope.DocumentsWrite)).toBe(false);
  });

  it('honors the wildcard', () => {
    expect(scopeSatisfies([ApiScope.Wildcard], ApiScope.ToolsExecute)).toBe(true);
  });
});

describe('areValidScopes', () => {
  it('accepts known scopes and the wildcard', () => {
    expect(areValidScopes([ApiScope.Wildcard, ApiScope.SearchRead])).toBe(true);
  });

  it('rejects unknown scopes', () => {
    expect(areValidScopes(['documents:delete'])).toBe(false);
  });
});
