import type { ForkliftData } from '../types';

export type ForkliftAction = 'generate' | 'consume';

export class ForkliftModel {
  id: string;
  role: 'generator' | 'consumer';
  interval: number;
  remainingCooldown: number;
  destinationTag: string;
  palletSize: { width: number; height: number };

  constructor(data: ForkliftData) {
    this.id = data.id;
    this.role = data.role;
    this.interval = data.interval;
    this.remainingCooldown = 0; // 立即触发首次操作
    this.destinationTag = data.destinationTag;
    this.palletSize = { ...data.palletSize };
  }

  tick(deltaTimeSec: number): ForkliftAction | null {
    this.remainingCooldown -= deltaTimeSec;
    if (this.remainingCooldown <= 0) {
      this.remainingCooldown = this.interval;
      return this.role === 'generator' ? 'generate' : 'consume';
    }
    return null;
  }
}
