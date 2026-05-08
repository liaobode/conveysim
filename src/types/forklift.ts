export type ForkliftRole = 'generator' | 'consumer';

export interface ForkliftData {
  id: string;
  label: string;
  x: number;
  y: number;
  role: ForkliftRole;
  interval: number;
  /** 随机波动，0 = 死节拍，0.2 = ±20% */
  fluctuation: number;
  destinationTag: string;
  palletSize: { width: number; height: number };
}
