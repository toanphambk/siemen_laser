import { Module } from '@nestjs/common';
import { LaserControllerService } from './laser-controller.service';

@Module({
  providers: [LaserControllerService],
  exports: [LaserControllerService],
})
export class LaserControllerModule {}
