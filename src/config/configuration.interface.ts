import { BlockInfo } from '../plc-communication/interface/plc-communication.interface';

export interface Configuration {
  blockSetting: BlockSetting;
  plcSetting: PlcSetting;
  comportSetting: ComportSetting;
  laserSoftware: LaserSoftWareSetting;
}

export interface PlcSetting {
  ip: string;
  port: number;
  rack: number;
  slot: number;
}

export interface ComportSetting {
  portNo: string;
  baudrate: number;
  dataBit: number;
  stopBit: number;
}

export interface LaserSoftWareSetting {
  host: string;
  family: 'IPv4' | 'IPv6';
  port: number;
  softwarePath: string;
  templatePath: string;
}

export type BlockSetting = {
  [key in BlockName]: BlockInfo;
};

export type BlockName =
  | 'barcodeState'
  | 'barcodeData'
  | 'barcodeFlag'
  | 'laserState'
  | 'laserMarkingCommand'
  | 'laserStopCommand'
  | 'laserFinished'
  | 'laserModel'
  | 'plcState'
  | 'plcHeartbeat' 

