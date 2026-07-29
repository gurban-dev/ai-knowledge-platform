import { Global, Module, type DynamicModule } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import type { AppContainer } from './container.js';
import { AuthGuard } from './nest/auth.guard.js';
import { IdempotencyInterceptor } from './nest/idempotency.interceptor.js';
import { MetricsInterceptor } from './nest/metrics.interceptor.js';
import { RateLimitInterceptor } from './nest/rate-limit.interceptor.js';
import { APP_CONTAINER } from './nest/tokens.js';
import { ApiKeyModule } from './modules/api-keys/api-key.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { BillingModule } from './modules/billing/billing.module.js';
import { ChatModule } from './modules/chat/chat.module.js';
import { DocumentsModule } from './modules/documents/document.module.js';
import { EvaluationModule } from './modules/evaluations/evaluation.module.js';
import { FeedbackModule } from './modules/feedback/feedback.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { SloModule } from './modules/health/slo.module.js';
import { IncidentModule } from './modules/incident-response/incident.module.js';
import { InviteModule } from './modules/invites/invite.module.js';
import { OrganizationsModule } from './modules/organizations/organization.module.js';
import { SearchModule } from './modules/search/search.module.js';
import { SsoModule } from './modules/sso/sso.module.js';
import { TeamModule } from './modules/teams/team.module.js';
import { UsageModule } from './modules/usage/usage.module.js';
import { WebhookModule } from './modules/webhooks/webhook.module.js';

@Global()
@Module({})
export class AppModule {
  static forRoot(container: AppContainer): DynamicModule {
    return {
      module: AppModule,
      global: true,
      imports: [
        HealthModule,
        SloModule,
        AuthModule,
        OrganizationsModule,
        DocumentsModule,
        SearchModule,
        ChatModule,
        UsageModule,
        ApiKeyModule,
        BillingModule,
        WebhookModule,
        TeamModule,
        InviteModule,
        AuditModule,
        EvaluationModule,
        FeedbackModule,
        SsoModule,
        IncidentModule,
      ],
      providers: [
        { provide: APP_CONTAINER, useValue: container },
        AuthGuard,
        { provide: APP_GUARD, useExisting: AuthGuard },
        { provide: APP_INTERCEPTOR, useClass: RateLimitInterceptor },
        { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
        { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
      ],
      exports: [APP_CONTAINER, AuthGuard],
    };
  }
}
