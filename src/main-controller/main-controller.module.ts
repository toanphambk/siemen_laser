import { Module } from '@nestjs/common';
import { MainControllerService } from './main-controller.service';
import { PlcCommunicationModule } from '../plc-communication/plc-communication.module';
import { LaserControllerModule } from '../laser-controller/laser-controller.module';
import { BarcodeControllerModule } from '../barcode-controller/barcode-controller.module';

@Module({
  providers: [MainControllerService],
  imports: [
    PlcCommunicationModule,
    LaserControllerModule,
    BarcodeControllerModule,
  ],
})
export class MainControllerModule {}
