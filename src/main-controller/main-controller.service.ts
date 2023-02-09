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

      await this.plcCommunicationService.initConnection({
        ip: '192.168.1.50',
        port: 102,
        rack: 0,
        slot: 1,
      });
      await this.plcCommunicationService.addDataBlock(this.blockSetting);
      this.barcodeControllerService.initBarcodeScanner(this.barcodeSetting);
      this.plcHeartbeat();
      this.laserControllerService.InitLaserControllerService(
        this.laserSoftWareSetting,
        this.systemData.plc.laserModel,
      );
    } catch (error) {}
  };

  private plcHeartbeat = () => {
    setTimeout(() => {
      this.plcHeartbeat();
    }, 2000);
    if (this.systemData.plc.state == ServiceState.READY) {
      this.plcCommunicationService.writeBlock(
        [this.blockSetting.plcHeartbeat],
        [(this.heartBeat = !this.heartBeat)],
        false,
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

    if (key == 'state') {
      this.plcCommunicationService.writeBlock(
        [
          this.blockSetting.barcodeState,
          this.blockSetting.plcState,
          this.blockSetting.laserState,
        ],
        [
          this.systemData.barcode.state,
          this.systemData.plc.state,
          this.systemData.laser.state,
        ],
      );
      return;
    }

    if (service == 'barcode') {
      if (key == 'barcodeData') {
        if (this.systemData.plc.barcodeFlag == 1) {
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
      if (key == 'laserModel') {
        this.laserControllerService.initLaserSofware(
          this.systemData.plc.laserModel,
        );
      }
      if (key == 'laserMarkingCommand' && val == true) {
        this.laserControllerService.triggerLaser(
          this.systemData.barcode.barcodeData,
          this.systemData.plc.laserModel,
        );
      }
      if (key == 'laserStopCommand' && val == true) {
        this.laserControllerService.stopLaser();
      }
    }
  }
}
