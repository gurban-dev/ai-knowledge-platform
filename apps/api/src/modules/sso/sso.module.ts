import { Module } from '@nestjs/common';
import { SsoController } from './sso.controller.js';

@Module({
  controllers: [SsoController],
})
export class SsoModule {}
