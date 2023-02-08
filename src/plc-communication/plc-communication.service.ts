import { Injectable } from '@nestjs/common';
import * as _ from 'lodash';
import nodes7 from 'nodes7';
import { EventEmitter2 } from '@nestjs/event-emitter';
import EventEmitter from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  PlcAddresslist,
  PlcData,
  BlockInfo,
} from './interface/plc-communication.interface';
import { S7CommunicationSetting } from './interface/plc-communication.interface';
import { ServiceState } from '../interface/systemState.interface';
import { BlockSetting } from '../config/configuration.interface';
import { Payload } from 'src/main-controller/interface/main-controller.interface';

@Injectable()
export class PlcCommunicationService {
  constructor(private PlcCommunicationServiceEvent: EventEmitter2) {
    this.data = new Proxy(this.data, this.dataChangeHandler());
  }

  private s7Connection = new nodes7();
  private plcEvent = new EventEmitter();
  private data = <PlcData>{ state: ServiceState.BOOT_UP };
  private plcWriteQueue = [];
  private addressList: PlcAddresslist;

  public initConnection = (setting: S7CommunicationSetting) => {
    return new Promise<boolean>((res, rej) => {
      console.log(`[ INIT CONNECTION ] : ${JSON.stringify(setting, null, 1)} `);
      this.data.state = ServiceState.INIT;
      this.s7Connection.initiateConnection(
        {
          port: setting.port,
          host: setting.ip,
          rack: setting.rack,
          slot: setting.slot,
          debug: true,
        },
        (err) => {
          this.triggerCycleScan();
          if (err) {
            rej(this.errorHandler(`INTI CONNECTION ERROR`, false, err));
            return;
          }
          res(true);
        },
      );
    });
  };

  public addDataBlock = async (dataBlockSetting: BlockSetting) => {
    if (this.data.state == ServiceState.ERROR) {
      throw new Error('Plc Communication Service Is Not Ready');
    }

    if (this.data.state == ServiceState.READY) {
      this.data.state = ServiceState.INIT;
      this.s7Connection.removeItems();
    }

    this.addressList = { read: [], write: [] };

    _.forOwn(dataBlockSetting, (setting, key) => {
      if (['READ_ONLY', 'READ_WRITE'].indexOf(setting.type) > -1) {
        this.addressList.read.push({ name: key, address: setting.address });
      }
      if (['WRITE_ONLY', 'READ_WRITE'].indexOf(setting.type) > -1) {
        this.addressList.write.push({ name: key, address: setting.address });
      }
    });
    console.log(this.addressList);

    const readingAdressList = _.map(this.addressList.read, (block) => {
      return block.address;
    });

    this.s7Connection.addItems(readingAdressList);

    await new Promise<void>((res) => {
      setTimeout(() => {
        res();
      }, 200);
    });
    await this.dataUpdate();
    return true;
  };

  private triggerCycleScan = async () => {
    try {
      if (this.data.state != ServiceState.READY) {
        console.log('[ PLC Service ]: PLC Service Is Not Ready');
        this.plcWriteQueue = [];
        await new Promise<void>((res) => {
          setTimeout(() => {
            res();
          }, 1000);
        });
        return;
      }

      if (this.plcWriteQueue.length > 10) {
        this.errorHandler('QUEUE OVERFLOW', false, this.plcWriteQueue);
        return;
      }

      if (this.plcWriteQueue.length > 0) {
        await new Promise<void>((res, rej) => {
          const command = this.plcWriteQueue[0];
          this.s7Connection.writeItems(
            command.blockName,
            command.data,
            async (err) => {
              if (err) {
                rej(this.errorHandler(`WRITE TO PLC ERROR : `, false, command));
                return;
              }
              this.plcWriteQueue.shift();
              this.plcEvent.emit(command.uuid, undefined);
              res();
            },
          );
        });
      }
      await this.dataUpdate();
    } catch (error) {
      this.errorHandler('CYCLE SCAN ERROR', false);
    } finally {
      await this.triggerCycleScan();
    }
  };

  private dataUpdate = async () => {
    try {
      const dataFromPLC = await this.readFromPlc();
      Object.keys(dataFromPLC).map((address) => {
        const found = _.find(
          this.addressList.read,
          (block) => block.address == address,
        );
        if (found) {
          this.data[found.name] = dataFromPLC[address];
          return;
        }
        throw new Error('Address not found in read array');
      });
      this.data.state = ServiceState.READY;
    } catch (error) {
      this.errorHandler('READ FROM PLC ERROR', true, error);
    }
  };

  public writeBlock = (blockInfo: BlockInfo[], data: any[], log = true) => {
    return new Promise<boolean>((res, rej) => {
      const { _isValid, _blockName } = this.blockInfoIsValid(blockInfo);
      if (!_isValid) {
        rej('DATA BLOCK IS NOT VALID');
        return;
      }
      const _uuid = uuidv4();
      this.plcWriteQueue.push({
        blockName: blockInfo.map((blockInfo) => blockInfo.address),
        data: data,
        uuid: _uuid,
      });
      this.plcEvent.once(_uuid, (err) => {
        if (err) {
          rej(err);
          return;
        }
        if (log)
          console.log(`[ WRITE TO PLC DONE] : [ ${_blockName} ] =[ ${data} ]`);
        res(true);
        return;
      });
    });
  };

  private readFromPlc = () => {
    return new Promise<any>((res, rej) => {
      this.s7Connection.readAllItems((err, data) => {
        if (err) {
          rej({ error: err, plcData: data });
          return;
        }
        res(data);
      });
    });
  };

  private dataChangeHandler = () => {
    return {
      set: (target, key, val) => {
        const oldVal = target[key];
        if (oldVal != val) {
          target[key] = val;
          const data: Payload = {
            service: 'plc',
            data: this.data,
            key,
            oldVal,
            val,
          };
          this.PlcCommunicationServiceEvent.emit('dataChange', data);
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

  private errorHandler = async (
    err: string,
    isOperational: boolean,
    data?: any,
  ) => {
    console.log(`[ ERROR ] :  ${err} : ${data ? JSON.stringify(data) : ''}`);
    if (!isOperational) {
      this.data.state = ServiceState.ERROR;
      //do some other logging, event trigger for this
      return;
    }

    switch (err) {
      case 'READ FROM PLC ERROR':
        this.data.state = ServiceState.ERROR;
        const isBadReading = Object.values(data.plcData).find(
          (val: unknown) => typeof val == 'string' && val.includes('BAD'),
        );
        if (isBadReading) {
          await new Promise<void>((res) => {
            setTimeout(() => {
              this.dataUpdate();
              res();
            }, 500);
          });
        }
        break;
    }
    return;
  };

  private blockInfoIsValid = (
    blockInfo: BlockInfo[],
  ): { _isValid: boolean; _blockName: string[] } => {
    let _isValid = true;
    const _blockName = [];
    _.forEach(blockInfo, (info) => {
      if (info.type === 'READ_ONLY') {
        console.log(`[ ERROR ]: Read Only Block Found ${JSON.stringify(info)}`);
        _isValid = false;
        return;
      }
      const addressFound = _.find(this.addressList.write, (block) => {
        return block.address == info.address;
      });
      if (!addressFound) {
        console.log(`[ ERROR ]: Can not find address ${JSON.stringify(info)}`);
        _isValid = false;
        return;
      }
      _blockName.push(addressFound.name);
    });
    return { _isValid, _blockName };
  };
}
