import { Module } from '@nestjs/common';
import { TeamController } from './team.controller.js';

@Module({
  controllers: [TeamController],
})
export class TeamModule {}
