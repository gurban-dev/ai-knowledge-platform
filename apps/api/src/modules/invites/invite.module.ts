import { Module } from '@nestjs/common';
import { InviteController } from './invite.controller.js';

@Module({
  controllers: [InviteController],
})
export class InviteModule {}
