import { Module } from '@nestjs/common';
import { ApiKeyController } from './api-key.controller.js';

@Module({
  controllers: [ApiKeyController],
})
export class ApiKeyModule {}
