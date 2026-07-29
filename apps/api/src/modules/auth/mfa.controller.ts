import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import type { AppContainer } from '../../container.js';
import type { AuthContext } from '../../nest/auth.types.js';
import { AuthGuard } from '../../nest/auth.guard.js';
import { CurrentAuth } from '../../nest/decorators.js';
import { APP_CONTAINER } from '../../nest/tokens.js';
import { ZodValidationPipe } from '../../nest/zod-validation.pipe.js';
import type { RequestMeta } from '../auth/auth.types.js';

function requestMeta(req: Request): RequestMeta {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

const activateBodySchema = z.object({ token: z.string().trim().min(6).max(10) });
const disableBodySchema = z.object({
  token: z.string().trim().min(6).max(10).optional(),
  recoveryCode: z.string().trim().min(6).max(20).optional(),
});
const regenerateBodySchema = z.object({ token: z.string().trim().min(6).max(10) });

@Controller('v1/auth/mfa')
@UseGuards(AuthGuard)
export class MfaController {
  constructor(@Inject(APP_CONTAINER) private readonly container: AppContainer) {}

  private get mfa() {
    return this.container.services.mfa;
  }

  @Get('status')
  status(@CurrentAuth() auth: AuthContext) {
    return this.mfa.status(auth.userId);
  }

  @Post('enroll')
  @HttpCode(200)
  enroll(@CurrentAuth() auth: AuthContext, @Req() req: Request) {
    return this.mfa.beginEnrollment(auth.userId, auth.organizationId, requestMeta(req));
  }

  @Post('activate')
  @HttpCode(200)
  activate(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(activateBodySchema)) body: z.infer<typeof activateBodySchema>,
    @Req() req: Request,
  ) {
    return this.mfa.activate(auth.userId, auth.organizationId, body.token, requestMeta(req));
  }

  @Post('recovery-codes')
  @HttpCode(200)
  recoveryCodes(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(regenerateBodySchema))
    body: z.infer<typeof regenerateBodySchema>,
  ) {
    return this.mfa.regenerateRecoveryCodes(auth.userId, body.token);
  }

  @Post('disable')
  @HttpCode(204)
  async disable(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(disableBodySchema)) body: z.infer<typeof disableBodySchema>,
    @Req() req: Request,
  ): Promise<void> {
    await this.mfa.disable(
      auth.userId,
      auth.organizationId,
      { token: body.token, recoveryCode: body.recoveryCode },
      requestMeta(req),
    );
  }
}
