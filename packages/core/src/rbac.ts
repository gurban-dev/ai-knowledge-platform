/**
 * Role-based access control primitives shared across the API and workers.
 *
 * Roles are hierarchical: a higher role implicitly satisfies any requirement
 * met by a lower one. The numeric rank makes "at least this role" checks trivial
 * and keeps authorization decisions in one auditable place.
 */
export const Role = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
  VIEWER: 'VIEWER',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

const ROLE_RANK: Record<Role, number> = {
  VIEWER: 0,
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

export const ALL_ROLES: readonly Role[] = Object.keys(ROLE_RANK) as Role[];

/** True if `role` meets or exceeds `required` in the hierarchy. */
export function roleSatisfies(role: Role, required: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[required];
}

/** Highest-privilege role from a set (used when a user has multiple grants). */
export function highestRole(roles: readonly Role[]): Role | undefined {
  return [...roles].sort((a, b) => ROLE_RANK[b] - ROLE_RANK[a])[0];
}
