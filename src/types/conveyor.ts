export type ConveyorType = 'chain' | 'roller';

export type ConveyorDirection = 'forward' | 'bidirectional';

export interface ConveyorData {
  id: string;
  label: string;
  type: ConveyorType;
  x: number;
  y: number;
  rotation: number;
  length: number;
  width: number;
  speed: number;
  direction: ConveyorDirection;
  zoneSpacing: number;
}

export interface ZoneState {
  index: number;
  occupied: boolean;
  occupiedByPalletId: string | null;
}
