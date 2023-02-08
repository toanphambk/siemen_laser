import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import {
  BlockSetting,
  ComportSetting,
  LaserSoftWareSetting,
} from 'src/config/configuration.interface';
import { PlcCommunicationService } from '../plc-communication/plc-communication.service';
import { Payload, SystemData } from './interface/main-controller.interface';
import {
  LaserControllerState,
  ServiceState,
} from '../interface/systemState.interface';
import { PlcData } from 'src/plc-communication/interface/plc-communication.interface';
import { LaserControllerService } from 'src/laser-controller/laser-controller.service';
import { BarcodeControllerService } from 'src/barcode-controller/barcode-controller.service';

@Injectable()
export class MainControllerService {
  constructor(
    private plcCommunicationService: PlcCommunicationService,
    private laserControllerService: LaserControllerService,
    private configService: ConfigService,
    private barcodeControllerService: BarcodeControllerService,
  ) {
    this.init();
  }
  private systemData: SystemData = {
    plc: <PlcData>{},
    barcode: { state: ServiceState.BOOT_UP, barcodeData: '' },
    laser: { state: LaserControllerState.BOOT_UP },
  };
  private heartBeat = false;
  private blockSetting: BlockSetting;
  private laserSoftWareSetting: LaserSoftWareSetting;
  private barcodeSetting: ComportSetting;
  private init = async () => {
    try {
      await new Promise((res) => {
        setTimeout(() => {
          res(0);
        }, 500);
      });
      this.blockSetting = this.configService.get<BlockSetting>('blockSetting');
      this.laserSoftWareSetting =
        this.configService.get<LaserSoftWareSetting>('laserSoftware');
      this.barcodeSetting =
        this.configService.get<ComportSetting>('comportSetting');
      this.barcodeControllerService.initBarcodeScanner(this.barcodeSetting);
      await this.plcCommunicationService.initConnection({
        ip: '192.168.1.50',
        port: 102,
        rack: 0,
        slot: 1,
      });
      await this.plcCommunicationService.addDataBlock(this.blockSetting);
      await this.laserControllerService.InitLaserControllerService(
        this.laserSoftWareSetting,
        this.systemData.plc.laserModel.replaceAll('\x00', ''),
      );
    } catch (error) {}
  };

  private hexToAscii(hexx) {
    const hex = hexx.toString();
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
      const _char = String.fromCharCode(parseInt(hex.substr(i, 2), 16));
      if (_char != '\0') {
        str += _char;
      }
    }
    return str;
  }

  private plcHeartbeat = () => {
    setTimeout(() => {
      this.plcHeartbeat();
    }, 1000);
    if (this.systemData.plc.state == ServiceState.READY) {
      this.plcCommunicationService.writeBlock(
        [this.blockSetting.plcHeartbeat],
        [(this.heartBeat = !this.heartBeat)],
      );
    }
  };

  @OnEvent('dataChange')
  handleOrderCreatedEvent({ service, data, key, oldVal, val }: Payload) {
    if (oldVal == undefined) {
      return;
    }

    this.systemData[service] = data;

    console.log(
      `[ STATE CHANGE ] [${service.toUpperCase()} SERVICE] ${String(
        key,
      )} ${oldVal} -> ${val}`,
      JSON.stringify(this.systemData, null, 2),
    );
    if (this.systemData.plc.state != ServiceState.READY) return;

    if (service == 'barcode') {
      if (key == 'state') {
        this.plcCommunicationService.writeBlock(
          [this.blockSetting.barcodeState],
          [val],
        );
        return;
      }
      if (key == 'barcodeData') {
        if (this.systemData.plc.barcodeFlag == 0) {
          console.log('PLC is not ready');
          return;
        }
        this.plcCommunicationService.writeBlock(
          [this.blockSetting.barcodeData, this.blockSetting.barcodeFlag],
          [val, true],
        );
      }
    }

    if (service == 'plc') {
      if (key == 'state') {
        this.plcCommunicationService.writeBlock(
          [this.blockSetting.plcState],
          [val],
        );
        return;
      }
    }

    if (service == 'laser') {
      if (key == 'state') {
        this.plcCommunicationService.writeBlock(
          [this.blockSetting.laserState],
          [val],
        );
        return;
      }
    }
    if (key == 'laserMarkingCommand') {
      this.laserControllerService.triggerLaser(
        this.systemData.barcode.barcodeData,
        this.systemData.plc.laserModel,
      );
    }
    if (key == 'laserStopCommand') {
      this.laserControllerService.stopLaser();
    }
  }
}
