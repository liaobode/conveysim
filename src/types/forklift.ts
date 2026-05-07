export type ForkliftRole = 'generator' | 'consumer';

export interface ForkliftData {
  id: string;
  x: number;
  y: number;
  role: ForkliftRole;
  interval: number;
  destinationTag: string;
  palletSize: { width: number; height: number };
}
