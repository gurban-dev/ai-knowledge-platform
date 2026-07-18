import { IdPrefix, newId } from '@akp/core';
import type { Prisma } from '@akp/db';
import type { Logger } from '@akp/observability';
import type { AuditRepository } from './audit.repository.js';

/**
 * Canonical audit action names. Using a closed set keeps the audit trail
 * queryable and consistent (e.g. filter by `auth.login`), and prevents typos
 * from fragmenting the log.
 */
export const AuditAction = {
  OrganizationCreated: 'organization.created',
  UserRegistered: 'user.registered',
  AuthLoginSucceeded: 'auth.login.succeeded',
  AuthLoginFailed: 'auth.login.failed',
  AuthTokenRefreshed: 'auth.token.refreshed',
  AuthTokenReuseDetected: 'auth.token.reuse_detected',
  AuthLoggedOut: 'auth.logout',
} as const;

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export interface RecordAuditInput {
  organizationId: string;
  action: AuditAction;
  actorUserId?: string | undefined;
  resourceType?: string | undefined;
  resourceId?: string | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  metadata?: Prisma.InputJsonValue | undefined;
}

export class AuditService {
  constructor(
    private readonly repository: AuditRepository,
    private readonly logger: Logger,
  ) {}

  /**
   * Persist an audit event. Audit logging is best-effort from the caller's
   * perspective: a failure is logged loudly but never propagated, so it cannot
   * turn a successful business operation into a failed request.
   */
  async record(input: RecordAuditInput): Promise<void> {
    try {
      await this.repository.create({
        id: newId(IdPrefix.auditLog),
        organizationId: input.organizationId,
        action: input.action,
        actorUserId: input.actorUserId,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        metadata: input.metadata,
      });
    } catch (error) {
      this.logger.error({ err: error, action: input.action }, 'Failed to record audit event');
    }
  }
}
