import { describe, expect, it } from 'vitest';
import { ApiScope, InsufficientScopeError } from '@akp/core';
import { assertToolAuthorized, MCP_TOOLS } from './tools.js';

describe('MCP tool authorization', () => {
  it('allows tools:execute wildcard-style access', () => {
    const tool = MCP_TOOLS[0]!;
    expect(() => assertToolAuthorized([ApiScope.ToolsExecute], tool)).not.toThrow();
  });

  it('allows specific required scope', () => {
    const tool = MCP_TOOLS.find((t) => t.name === 'search_knowledge')!;
    expect(() => assertToolAuthorized([ApiScope.SearchRead], tool)).not.toThrow();
  });

  it('denies missing scopes', () => {
    const tool = MCP_TOOLS.find((t) => t.name === 'ask_question')!;
    expect(() => assertToolAuthorized([ApiScope.DocumentsRead], tool)).toThrow(
      InsufficientScopeError,
    );
  });
});
