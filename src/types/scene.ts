import type { ConveyorData } from './conveyor';
import type { TransferMachineData } from './transfer';
import type { ForkliftData } from './forklift';
import type { PalletData } from './pallet';
import type { ConnectionData } from './connection';

export type ComponentData =
  | { kind: 'conveyor'; data: ConveyorData }
  | { kind: 'transferMachine'; data: TransferMachineData }
  | { kind: 'forklift'; data: ForkliftData }
  | { kind: 'pallet'; data: PalletData };

export interface SceneJSON {
  version: number;
  conveyors: ConveyorData[];
  transferMachines: TransferMachineData[];
  forklifts: ForkliftData[];
  pallets: PalletData[];
  connections: ConnectionData[];
}
