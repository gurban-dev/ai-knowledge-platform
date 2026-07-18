import type { PrismaClient } from '@akp/db';
import type { Logger } from '@akp/observability';
import type Redis from 'ioredis';
import type { AppConfig } from './config.js';
import { JwtService } from './lib/jwt.js';
import { UserRepository } from './modules/users/user.repository.js';
import { OrganizationRepository } from './modules/organizations/organization.repository.js';
import { MembershipRepository } from './modules/memberships/membership.repository.js';
import { SessionRepository } from './modules/sessions/session.repository.js';
import { AuditRepository } from './modules/audit/audit.repository.js';
import { AuditService } from './modules/audit/audit.service.js';
import { AuthService } from './modules/auth/auth.service.js';
import { OrganizationService } from './modules/organizations/organization.service.js';

/**
 * Composition root. All object graph wiring happens here — nowhere else
 * constructs repositories or services. This keeps dependencies explicit and
 * makes the entire graph trivially replaceable in tests.
 */
export interface AppContainer {
  config: AppConfig;
  logger: Logger;
  prisma: PrismaClient;
  redis: Redis;
  jwt: JwtService;
  repositories: {
    users: UserRepository;
    organizations: OrganizationRepository;
    memberships: MembershipRepository;
    sessions: SessionRepository;
    audit: AuditRepository;
  };
  services: {
    audit: AuditService;
    auth: AuthService;
    organizations: OrganizationService;
  };
}

export interface ContainerDeps {
  config: AppConfig;
  logger: Logger;
  prisma: PrismaClient;
  redis: Redis;
}

export function buildContainer(deps: ContainerDeps): AppContainer {
  const { config, logger, prisma, redis } = deps;

  const repositories = {
    users: new UserRepository(prisma),
    organizations: new OrganizationRepository(prisma),
    memberships: new MembershipRepository(prisma),
    sessions: new SessionRepository(prisma),
    audit: new AuditRepository(prisma),
  };

  const auditService = new AuditService(repositories.audit, logger);

  const jwtService = new JwtService({
    secret: config.auth.accessSecret,
    issuer: config.auth.issuer,
    audience: config.auth.audience,
    accessTtlSeconds: config.auth.accessTtl,
  });

  const organizationService = new OrganizationService(
    repositories.organizations,
    repositories.memberships,
  );

  const authService = new AuthService({
    prisma,
    users: repositories.users,
    organizations: repositories.organizations,
    memberships: repositories.memberships,
    sessions: repositories.sessions,
    audit: auditService,
    jwt: jwtService,
    logger,
    config: {
      accessTtl: config.auth.accessTtl,
      refreshTtl: config.auth.refreshTtl,
      passwordHashMemoryCost: config.auth.passwordHashMemoryCost,
    },
  });

  return {
    config,
    logger,
    prisma,
    redis,
    jwt: jwtService,
    repositories,
    services: { audit: auditService, auth: authService, organizations: organizationService },
  };
}
