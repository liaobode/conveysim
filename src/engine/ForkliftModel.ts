import type { ForkliftData } from '../types';

export type ForkliftAction = 'generate' | 'consume';

/** Box-Muller 正态分布随机数 */
function normalRandom(mean: number, stdDev: number): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + stdDev * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export class ForkliftModel {
  id: string;
  role: 'generator' | 'consumer';
  interval: number;
  fluctuation: number;
  remainingCooldown: number;
  destinationTag: string;
  palletSize: { width: number; height: number };

  constructor(data: ForkliftData) {
    this.id = data.id;
    this.role = data.role;
    this.interval = data.interval;
    this.fluctuation = data.fluctuation ?? 0;
    this.remainingCooldown = 0; // 立即触发首次操作
    this.destinationTag = data.destinationTag;
    this.palletSize = { ...data.palletSize };
  }

  tick(deltaTimeSec: number): ForkliftAction | null {
    this.remainingCooldown -= deltaTimeSec;
    if (this.remainingCooldown <= 0) {
      // 计算下一次间隔（含随机波动）
      let nextInterval = this.interval;
      if (this.fluctuation > 0) {
        const stdDev = this.interval * (this.fluctuation / 3); // 3-sigma 规则
        nextInterval = this.interval + normalRandom(0, stdDev);
        // 钳制：不低于 20% 基础间隔
        if (nextInterval < this.interval * 0.2) nextInterval = this.interval * 0.2;
      }
      this.remainingCooldown = nextInterval;
      return this.role === 'generator' ? 'generate' : 'consume';
    }
    return null;
  }
}
