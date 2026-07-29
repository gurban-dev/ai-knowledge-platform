import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import type { AppContainer } from '../../container.js';
import { AuthGuard } from '../../nest/auth.guard.js';
import { APP_CONTAINER } from '../../nest/tokens.js';

@Controller('v1/operations')
@UseGuards(AuthGuard)
export class IncidentController {
  constructor(@Inject(APP_CONTAINER) private readonly container: AppContainer) {}

  @Get('incident-response')
  async getIncidentResponse() {
    const { config, prisma, redis } = this.container;
    const [database, cache] = await Promise.all([
      prisma
        .$queryRaw`SELECT 1`
        .then(() => 'up' as const)
        .catch(() => 'down' as const),
      redis
        .ping()
        .then((r) => (r === 'PONG' ? ('up' as const) : ('down' as const)))
        .catch(() => 'down' as const),
    ]);
    const healthy = database === 'up' && cache === 'up';
    return {
      status: healthy ? ('ok' as const) : ('degraded' as const),
      incidentChannel: config.operations.incidentChannel,
      runbookUrl: config.operations.runbookUrl,
      backup: {
        provider: config.operations.backupProvider ?? null,
        configured: Boolean(config.operations.backupProvider),
        lastRestoreTestAt: config.operations.lastRestoreTestAt ?? null,
      },
      dependencies: { database, redis: cache },
      timestamp: new Date().toISOString(),
    };
  }
}
