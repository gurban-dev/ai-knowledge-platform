export * from './client.js';
export * from './vector.js';

// Re-export generated types and enums so consumers depend on @akp/db rather
// than reaching into @prisma/client directly.
export type {
  Organization,
  User,
  Membership,
  Session,
  ApiKey,
  Invite,
  DataSource,
  Document,
  DocumentChunk,
  Conversation,
  Message,
  Citation,
  IngestionJob,
  Evaluation,
  EvaluationResult,
  UsageEvent,
  AuditLog,
} from '@prisma/client';

export {
  Role,
  OrganizationStatus,
  UserStatus,
  MembershipStatus,
  ApiKeyStatus,
  DataSourceType,
  DataSourceStatus,
  DocumentStatus,
  JobType,
  JobStatus,
  MessageRole,
  EvaluationStatus,
  UsageKind,
} from '@prisma/client';
