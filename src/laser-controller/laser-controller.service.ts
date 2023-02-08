import net from 'net';
import events from 'events';
import { Injectable } from '@nestjs/common';
import { getAllWindows, Hardware } from 'keysender';
import { execFile } from 'child_process';
import { LaserControllerState } from '../interface/systemState.interface';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LaserSoftWareSetting } from 'src/config/configuration.interface';
import { Payload } from '../main-controller/interface/main-controller.interface';

@Injectable()
export class LaserControllerService {
  constructor(private laserControllerServiceEvent: EventEmitter2) {
    this.data = new Proxy(this.data, this.dataChangeHandler());
  }

  private data = { state: LaserControllerState.BOOT_UP };
  private laserSocketServer: net.Server;
  private laserControllerEvent = new events.EventEmitter();
  private laserEngraveData = '';
  private path = { sofware: '', template: '' };
  public InitLaserControllerService = async (
    laserSoftWareSetting: LaserSoftWareSetting,
    fileName,
  ) => {
    this.data.state = LaserControllerState.INIT;
    await this.initTCPserver(
      laserSoftWareSetting.host,
      laserSoftWareSetting.family,
      laserSoftWareSetting.port,
    );
    this.path.sofware = laserSoftWareSetting.softwarePath;
    this.path.template = laserSoftWareSetting.templatePath;
    await this.initLaserSofware(fileName);
  };

  public triggerLaser = async (
    data: string,
    fileName: string,
  ): Promise<boolean> => {
    if (this.data.state != LaserControllerState.READY) {
      console.log('laser service is not ready');
      return false;
    }
    this.data.state = LaserControllerState.WORKING;
    //check if software is opening
    const windowInfor = await this.initLaserSofware(fileName);
    const laserWindow = new Hardware(windowInfor.title);
    if (!laserWindow.workwindow.isOpen()) {
      this.errorHandler('LASER TRIGGER', false, {
        detail: 'laser sofware is not opening',
      });
      return false;
    }
    laserWindow.workwindow.setForeground();

    const bufferRecived = await new Promise((res) => {
      const tcpBufferTimer = setTimeout(() => {
        this.laserControllerEvent.removeListener('tcpBufferComming', () => {
          this.errorHandler('LASER TRIGGER', false, {
            detail: 'tcp buffer timeout',
          });
          res(false);
        });
      }, 1000);

      this.laserControllerEvent.once('tcpBufferComming', () => {
        clearTimeout(tcpBufferTimer);
        console.log('tcp buffer recieved');
        res(true);
      });
      this.laserEngraveData = data;
      laserWindow.keyboard.sendKey('f2');
    });

    if (!bufferRecived) {
      console.log('buffer timeout');
      return false;
    }

    await new Promise<void>((res) => {
      setTimeout(() => {
        res();
      }, 200);
    });
    // this.data.state = LaserControllerState.WORKING;
    return true;
  };

  public finishLaser = () => {
    if (this.data.state == LaserControllerState.WORKING) {
      this.data.state = LaserControllerState.READY;
      return true;
    }
    this.errorHandler('LASER FINISH', false, {
      detail: 'finish laser fail',
    });
    return false;
  };

  public stopLaser = async () => {
    const markWindow = new Hardware('Mark');
    if (!markWindow.workwindow.isOpen()) {
      this.errorHandler('LASER STOP', false, {
        detail: 'Laser Working Window Is Not Opening',
      });
      return false;
    }
    markWindow.workwindow.setForeground();
    await new Promise<void>((res) => {
      setTimeout(() => {
        markWindow.keyboard.sendKey('enter');
        res();
      }, 200);
    });
    this.errorHandler('LASER STOP', false, {
      detail: 'PLC laser stop signal',
    });
  };

  private initTCPserver = (
    host: string,
    family: 'IPv4' | 'IPv6',
    port: number,
  ) => {
    return new Promise<void>((res) => {
      this.laserSocketServer = net.createServer((socket) => {
        socket.setEncoding('ascii');
        socket.on('data', (buffer) => {
          if (buffer.includes('TCP:Give me string')) {
            this.laserControllerEvent.emit('tcpBufferComming');
            socket.write(this.laserEngraveData, 'ascii', (err) => {
              if (err) {
                this.errorHandler('Init LASER TCP', false, {
                  detail: err,
                });
              }
              console.log(
                'EzCad TCP Buffer Write Done :',
                this.laserEngraveData,
              );
            });
          }
        });
        socket.on('close', (err) => {
          console.log(err);
          console.log('close');
        });
      });

      this.laserSocketServer.listen({ host, family, port }, () => {
        console.log('opened server on', this.laserSocketServer.address());
        res();
      });
    });
  };

  private initLaserSofware = async (fileName) => {
    let windowInfo = this.getLaserWindow();
    let laserWindow;

    if (!windowInfo) {
      this.data.state = LaserControllerState.INIT;
      execFile(this.path.sofware, (err) => {
        if (err) {
          return this.errorHandler('Init LASER SOFTWARE FALSE', false, {
            detail: err,
          });
        }
      });

      await new Promise<void>((res) => {
        setTimeout(() => {
          windowInfo = this.getLaserWindow();
          laserWindow = new Hardware(windowInfo.title);
          res();
        }, 2000);
      });

      await new Promise<void>((res) => {
        setTimeout(() => {
          laserWindow.keyboard.sendKey('enter');
          res();
        }, 2000);
      });
    }

    if (fileName == windowInfo.fileName) {
      this.data.state = LaserControllerState.READY;
      return windowInfo;
    }

    await new Promise<void>((res) => {
      setTimeout(() => {
        res();
      }, 2000);
    });

    await new Promise<void>((res) => {
      setTimeout(async () => {
        await laserWindow.keyboard.sendKey(['ctrl', 'o'], 50, 1000);
        await laserWindow.keyboard.printText(
          `${this.path.template}\\${fileName}.ezd`,
          0,
          50,
        );
        await laserWindow.keyboard.sendKey('enter');
        res();
      }, 4000);
    });

    await new Promise<void>((res) => {
      setTimeout(() => {
        res();
      }, 2000);
    });

    windowInfo = this.getLaserWindow();
    if (windowInfo.fileName == fileName) {
      return windowInfo;
    }
    this.errorHandler('INIT LASER SOFTWARE', false, {
      detail: 'Cant fint laser window',
    });
    return undefined;
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
          this.laserControllerEvent.emit('dataChange', data);
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

  private getLaserWindow = () => {
    const allWindow = getAllWindows();
    const found = allWindow.find((window) => window.title.includes('EzCad'));
    if (found) {
      if (found.title == 'EzCad-Lite  - No title') {
        return { ...found, fileName: 'No title' };
      }
      return {
        ...found,
        fileName: found.title.substring(
          found.title.indexOf('- ') + 2,
          found.title.indexOf('.ezd'),
        ),
      };
    }
    return undefined;
  };

  private errorHandler = async (err, isOperational, data?) => {
    this.data.state = LaserControllerState.ERROR;
    console.log(`[ ERROR ] :  ${err} : ${data ? JSON.stringify(data) : ''}`);
    throw new Error(err);
  };
}
