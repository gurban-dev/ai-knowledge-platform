import type { Role } from '@akp/core';

export interface AuthContext {
  userId: string;
  organizationId: string;
  role: Role;
  sessionId: string;
}

export interface ApiKeyContext {
  id: string;
  organizationId: string;
  name: string;
  scopes: string[];
  rateLimitPerMinute: number | null;
}
