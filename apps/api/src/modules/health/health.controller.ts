import { Controller, Get, Header, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { AppContainer } from '../../container.js';
import { Public } from '../../nest/decorators.js';
import { APP_CONTAINER } from '../../nest/tokens.js';

@Controller()
export class HealthController {
  constructor(@Inject(APP_CONTAINER) private readonly container: AppContainer) {}

  @Get('health/live')
  @Public()
  live() {
    return {
      status: 'ok' as const,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health/ready')
  @Public()
  async ready(@Res({ passthrough: true }) res: Response) {
    const { prisma, redis } = this.container;

    const checkDatabase = async (): Promise<'up' | 'down'> => {
      try {
        await prisma.$queryRaw`SELECT 1`;
        return 'up';
      } catch {
        return 'down';
      }
    };

    const checkRedis = async (): Promise<'up' | 'down'> => {
      try {
        return (await redis.ping()) === 'PONG' ? 'up' : 'down';
      } catch {
        return 'down';
      }
    };

    const [database, cache] = await Promise.all([checkDatabase(), checkRedis()]);
    const healthy = database === 'up' && cache === 'up';
    res.status(healthy ? 200 : 503);
    return {
      status: healthy ? ('ok' as const) : ('degraded' as const),
      checks: { database, redis: cache },
      timestamp: new Date().toISOString(),
    };
  }

  @Get('metrics')
  @Public()
  @Header('content-type', 'text/plain; version=0.0.4; charset=utf-8')
  metrics(@Res() res: Response): void {
    const { metrics } = this.container;
    res.setHeader('content-type', metrics.contentType());
    res.status(200).send(metrics.render());
  }
}
