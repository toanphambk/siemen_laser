import { Injectable } from '@nestjs/common';
import { SerialPort } from 'serialport';
import { ServiceState } from '../interface/systemState.interface';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BarCodeData } from './interface/barcode-controller.interface';
import { Payload } from 'src/main-controller/interface/main-controller.interface';

@Injectable()
export class BarcodeControllerService {
  constructor(private barcodeControllerServiceEvent: EventEmitter2) {
    this.data = new Proxy(
      { state: ServiceState.BOOT_UP, barcodeData: '' },
      this.dataChangeHandler(),
    );
  }
  private data: BarCodeData;
  private barcodeScanner;

  public getState = () => {
    return this.data.state;
  };

  public initBarcodeScanner = async ({
    portNo,
    baudrate,
    dataBit,
    stopBit,
  }) => {
    return new Promise<void>((res) => {
      this.data.state = ServiceState.INIT;
      this.barcodeScanner = new SerialPort(
        {
          path: `${portNo}`,
          baudRate: baudrate,
          dataBits: dataBit,
          stopBits: stopBit,
        },
        (err) => {
          if (err) {
            console.log(err);
            this.data.state = ServiceState.ERROR;
            setTimeout(async () => {
              await this.initBarcodeScanner({
                portNo,
                baudrate,
                dataBit,
                stopBit,
              });
            }, 1000);
            return;
          }
          this.data.state = ServiceState.READY;
          res();
        },
      );

      this.barcodeScanner.on('open', () => {
        this.barcodeScanner.on('data', (data) => {
          this.data.barcodeData = Buffer.from(data).toString();
          this.barcodeControllerServiceEvent.emit(
            'barcodeDataAvailable',
            this.data.barcodeData,
          );
        });
      });
    });
  };

  private dataChangeHandler = () => {
    return {
      set: (target, key, val) => {
        const oldVal = target[key];
        if (target[key] != val) {
          target[key] = val;
          const data: Payload = {
            service: 'barcode',
            data: this.data,
            key,
            oldVal,
            val,
          };
          this.barcodeControllerServiceEvent.emit('dataChange', data);
          return true;
        }
        return true;
      },
      get: (target, key) => {
        if (typeof target[key] === 'object' && target[key] !== null) {
          return new Proxy(target[key], this.dataChangeHandler());
        }
        return target[key];
      },
    };
  };
}
