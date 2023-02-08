import { BarCodeData } from 'src/barcode-controller/interface/barcode-controller.interface';
import { LaserControllerData } from 'src/laser-controller/interface/laserController.interface';
import { PlcData } from 'src/plc-communication/interface/plc-communication.interface';

export interface SystemData {
  plc: PlcData;
  barcode: BarCodeData;
  laser: LaserControllerData;
}

export type Service = keyof SystemData;

export interface Payload {
  service: Service;
  data: any;
  key: keyof BarCodeData | keyof PlcData | keyof LaserControllerData;
  oldVal: any;
  val: any;
}
