import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@akp/core';
import type { Request } from 'express';
import { z } from 'zod';
import type { AppContainer } from '../../container.js';
import type { AuthContext } from '../../nest/auth.types.js';
import type { RequestMeta } from '../auth/auth.types.js';
import { paginationQuerySchema } from '../../lib/http.js';
import { AuthGuard } from '../../nest/auth.guard.js';
import { CurrentAuth, Roles } from '../../nest/decorators.js';
import { APP_CONTAINER } from '../../nest/tokens.js';
import { ZodValidationPipe } from '../../nest/zod-validation.pipe.js';

const evaluationSampleSchema = z.object({
  question: z.string().min(1),
  expected: z.string().optional().nullable(),
  answer: z.string(),
  scores: z.record(z.string(), z.number()),
  hallucinated: z.boolean().optional(),
});

const qualityBodySchema = z.object({ samples: z.array(evaluationSampleSchema) });

const createRunBodySchema = z.object({
  name: z.string().min(1).max(120),
  samples: z.array(evaluationSampleSchema).min(1).max(1000),
});

const idParamsSchema = z.object({ id: z.string() });

function requestMeta(req: Request): RequestMeta {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

@Controller('v1/evaluations')
@UseGuards(AuthGuard)
export class EvaluationController {
  constructor(@Inject(APP_CONTAINER) private readonly container: AppContainer) {}

  private get evaluations() {
    return this.container.services.evaluations;
  }

  @Post('quality')
  computeQuality(
    @Body(new ZodValidationPipe(qualityBodySchema))
    body: z.infer<typeof qualityBodySchema>,
  ) {
    return this.evaluations.buildSummary(body.samples);
  }

  @Post()
  @HttpCode(201)
  @Roles(Role.MEMBER)
  async createRun(
    @CurrentAuth() auth: AuthContext,
    @Req() req: Request,
    @Body(new ZodValidationPipe(createRunBodySchema))
    body: z.infer<typeof createRunBodySchema>,
  ) {
    return this.evaluations.createRun({
      organizationId: auth.organizationId,
      name: body.name,
      samples: body.samples,
      actorUserId: auth.userId,
      meta: requestMeta(req),
    });
  }

  @Get()
  async list(
    @CurrentAuth() auth: AuthContext,
    @Query(new ZodValidationPipe(paginationQuerySchema))
    query: z.infer<typeof paginationQuerySchema>,
  ) {
    return this.evaluations.list(auth.organizationId, {
      limit: query.limit,
      cursor: query.cursor,
    });
  }

  @Get(':id')
  async get(
    @CurrentAuth() auth: AuthContext,
    @Param(new ZodValidationPipe(idParamsSchema)) params: z.infer<typeof idParamsSchema>,
  ) {
    return this.evaluations.get(params.id, auth.organizationId);
  }
}
