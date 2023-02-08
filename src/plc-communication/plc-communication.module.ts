import { Module } from '@nestjs/common';
import { PlcCommunicationService } from './plc-communication.service';

@Module({
  imports: [],
  providers: [PlcCommunicationService],
  exports: [PlcCommunicationService],
})
export class PlcCommunicationModule {}
