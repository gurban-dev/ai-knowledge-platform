/**
 * API-key / MCP authorization scopes.
 *
 * Scopes are the unit of authorization for programmatic and agent (MCP) access,
 * layered on top of the human RBAC roles. A credential may only perform actions
 * covered by its granted scopes. Wildcard `*` grants everything (owner-issued,
 * discouraged for production integrations).
 *
 * Naming convention: `<resource>:<action>` where action is `read` or `write`.
 * Adding a scope here is a public-contract change — keep it append-only.
 */
export const ApiScope = {
  Wildcard: '*',
  DocumentsRead: 'documents:read',
  DocumentsWrite: 'documents:write',
  SearchRead: 'search:read',
  ChatWrite: 'chat:write',
  EvaluationsRead: 'evaluations:read',
  EvaluationsWrite: 'evaluations:write',
  UsageRead: 'usage:read',
  WebhooksWrite: 'webhooks:write',
  ToolsExecute: 'tools:execute',
} as const;

export type ApiScope = (typeof ApiScope)[keyof typeof ApiScope];

export const ALL_API_SCOPES: readonly ApiScope[] = Object.values(ApiScope).filter(
  (s): s is ApiScope => s !== ApiScope.Wildcard,
);

/** True if `granted` covers `required` (wildcard covers everything). */
export function scopeSatisfies(granted: readonly string[], required: string): boolean {
  return granted.includes(ApiScope.Wildcard) || granted.includes(required);
}

/** Validate an arbitrary scope list against the known catalog. */
export function areValidScopes(scopes: readonly string[]): boolean {
  const known = new Set<string>([ApiScope.Wildcard, ...ALL_API_SCOPES]);
  return scopes.every((s) => known.has(s));
}