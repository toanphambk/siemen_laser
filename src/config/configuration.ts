import yargs from 'yargs';
import { Configuration } from './configuration.interface';

const argv = yargs(process.argv.slice(2))
  .options({
    com: { type: 'string', default: 'COM1' },
  })
  .parseSync();

const configuration: Configuration = {
  blockSetting: {
    barcodeState: {
      address: 'DB40,I0.1',
      type: 'WRITE_ONLY',
    },
    barcodeData: {
      address: 'DB40,C2.20',
      type: 'WRITE_ONLY',
    },
    barcodeFlag: {
      address: 'DB40,X22.0',
      type: 'READ_WRITE',
    },
    laserState: {
      address: 'DB40,I24.1',
      type: 'WRITE_ONLY',
    },
    laserMarkingCommand: {
      address: 'DB40,X26.0',
      type: 'READ_ONLY',
    },
    laserStopCommand: {
      address: 'DB40,X26.1',
      type: 'READ_ONLY',
    },
    laserFinished: {
      address: 'DB40,X26.2',
      type: 'READ_ONLY',
    },
    laserModel: {
      address: 'DB40,C28.10',
      type: 'READ_ONLY',
    },
    plcState: {
      address: 'DB40,I38.1',
      type: 'WRITE_ONLY',
    },
    plcHeartbeat: {
      address: 'DB40,X40.0',
      type: 'WRITE_ONLY',
    },
  },
  plcSetting: {
    ip: '192.168.0.1',
    port: 102,
    rack: 0,
    slot: 1,
  },
  comportSetting: {
    portNo: argv.com,
    baudrate: 9600,
    dataBit: 8,
    stopBit: 1,
  },
  laserSoftware: {
    host: '127.0.0.1',
    family: 'IPv4',
    port: 1000,
    softwarePath:
      'D:\\Software-Explanation\\EZCAD_LITE_2.14.16(20210519)\\EzCad2.exe',
    templatePath:
      'D:\\Software-Explanation\\EZCAD_LITE_2.14.16(20210519)\\Template',
  },
} as const;

export default configuration;
