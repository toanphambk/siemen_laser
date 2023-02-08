import { BlockName } from 'src/config/configuration.interface';

export interface S7CommunicationSetting {
  ip: string;
  port: number;
  rack: number;
  slot: number;
}

export interface BlockInfo {
  address: string;
  type: BlockType;
}
export interface PlcAddresslist {
  read: { name: string; address: string }[];
  write: { name: string; address: string }[];
}
export type PlcData = {
  [key in BlockName | 'state']: any;
};

export type BlockType = 'READ_ONLY' | 'READ_WRITE' | 'WRITE_ONLY';
