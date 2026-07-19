import { ApiScope, InsufficientScopeError, scopeSatisfies } from '@akp/core';

export interface McpToolDef {
  name: string;
  description: string;
  sideEffect: 'READ' | 'WRITE' | 'DESTRUCTIVE';
  requiredScope: string;
  inputSchema: Record<string, unknown>;
}

export const MCP_TOOLS: McpToolDef[] = [
  {
    name: 'search_knowledge',
    description: 'Hybrid search over the organization knowledge base',
    sideEffect: 'READ',
    requiredScope: ApiScope.SearchRead,
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_document',
    description: 'Fetch a document by id',
    sideEffect: 'READ',
    requiredScope: ApiScope.DocumentsRead,
    inputSchema: {
      type: 'object',
      properties: { documentId: { type: 'string' } },
      required: ['documentId'],
    },
  },
  {
    name: 'list_collections',
    description: 'List knowledge collections',
    sideEffect: 'READ',
    requiredScope: ApiScope.DocumentsRead,
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'ask_question',
    description: 'Ask a grounded question against organization knowledge',
    sideEffect: 'READ',
    requiredScope: ApiScope.ChatWrite,
    inputSchema: {
      type: 'object',
      properties: {
        question: { type: 'string' },
        conversationId: { type: 'string' },
      },
      required: ['question'],
    },
  },
];

export function assertToolAuthorized(scopes: string[], tool: McpToolDef): void {
  const ok =
    scopeSatisfies(scopes, ApiScope.ToolsExecute) ||
    scopeSatisfies(scopes, tool.requiredScope);
  if (!ok) {
    throw new InsufficientScopeError(`Missing scope for tool ${tool.name}`);
  }
}
