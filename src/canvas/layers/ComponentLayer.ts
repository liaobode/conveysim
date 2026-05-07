import * as PIXI from 'pixi.js';
import type { TransferMachineData, ForkliftData } from '../../types';
import { TransferGraphic } from '../objects/TransferGraphic';
import { ForkliftGraphic } from '../objects/ForkliftGraphic';

export class ComponentLayer {
  private container: PIXI.Container;
  private transfers = new Map<string, TransferGraphic>();
  private forklifts = new Map<string, ForkliftGraphic>();

  constructor(parent: PIXI.Container) {
    this.container = new PIXI.Container();
    parent.addChild(this.container);
  }

  sync(transfers: TransferMachineData[], forklifts: ForkliftData[]): void {
    const activeTransferIds = new Set(transfers.map((t) => t.id));
    const activeForkliftIds = new Set(forklifts.map((f) => f.id));

    // 删除不存在的移载机
    for (const [id, g] of this.transfers) {
      if (!activeTransferIds.has(id)) {
        this.container.removeChild(g);
        g.destroy();
        this.transfers.delete(id);
      }
    }
    // 删除不存在的叉车
    for (const [id, g] of this.forklifts) {
      if (!activeForkliftIds.has(id)) {
        this.container.removeChild(g);
        g.destroy();
        this.forklifts.delete(id);
      }
    }

    // 创建或更新移载机
    for (const data of transfers) {
      const existing = this.transfers.get(data.id);
      if (existing) {
        existing.draw(data);
      } else {
        const g = new TransferGraphic(data);
        this.container.addChild(g);
        this.transfers.set(data.id, g);
      }
    }

    // 创建或更新叉车
    for (const data of forklifts) {
      const existing = this.forklifts.get(data.id);
      if (existing) {
        existing.draw(data);
      } else {
        const g = new ForkliftGraphic(data);
        this.container.addChild(g);
        this.forklifts.set(data.id, g);
      }
    }
  }

  getTransfer(id: string): TransferGraphic | undefined {
    return this.transfers.get(id);
  }

  getForklift(id: string): ForkliftGraphic | undefined {
    return this.forklifts.get(id);
  }

  updateForkliftCooldowns(cooldowns: Record<string, number>, forklifts: ForkliftData[]): void {
    const intervalMap = new Map<string, number>();
    for (const f of forklifts) intervalMap.set(f.id, f.interval);

    for (const [id, g] of this.forklifts) {
      const cooldown = cooldowns[id];
      const interval = intervalMap.get(id);
      if (cooldown !== undefined && interval !== undefined) {
        g.updateCooldown(cooldown, interval);
      }
    }
  }
}
