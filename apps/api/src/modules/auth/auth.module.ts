import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { MfaController } from './mfa.controller.js';

@Module({
  controllers: [AuthController, MfaController],
})
export class AuthModule {}
