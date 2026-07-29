import { Module } from '@nestjs/common';
import { IncidentController } from './incident.controller.js';

@Module({
  controllers: [IncidentController],
})
export class IncidentModule {}
