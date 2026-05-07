import * as PIXI from 'pixi.js';
import type { PalletRuntimeState, ConveyorData, TransferMachineData, ForkliftData } from '../../types';
import { metersToPixels } from '../../utils/geometry';

export class PalletLayer {
  private container: PIXI.Container;
  private graphics = new Map<string, PIXI.Graphics>();

  constructor(parent: PIXI.Container) {
    this.container = new PIXI.Container();
    parent.addChild(this.container);
  }

  sync(
    palletStates: Record<string, PalletRuntimeState>,
    conveyors: Record<string, ConveyorData>,
    transfers: Record<string, TransferMachineData>,
    forklifts: Record<string, ForkliftData>,
  ): void {
    const activeIds = new Set(Object.keys(palletStates));

    for (const [id, g] of this.graphics) {
      if (!activeIds.has(id)) {
        this.container.removeChild(g);
        g.destroy();
        this.graphics.delete(id);
      }
    }

    for (const [id, state] of Object.entries(palletStates)) {
      const pos = this.calcWorldPosition(state, conveyors, transfers, forklifts);
      if (!pos) continue;

      let g = this.graphics.get(id);
      if (!g) {
        g = new PIXI.Graphics();
        this.container.addChild(g);
        this.graphics.set(id, g);
      }

      const w = metersToPixels(state.size.width);
      const h = metersToPixels(state.size.height);
      g.clear();
      const blocked = state.isBlocked;
      const reverse = state.reverseFlow;

      // 边框和填充颜色
      const borderColor = blocked ? 0xff0040 : reverse ? 0x00ccff : 0xffaa00;
      const fillColor = blocked ? 0x801020 : reverse ? 0x00334a : 0xc89030;
      const innerColor = blocked ? 0xff2040 : reverse ? 0x00eeff : 0xe0a840;

      g.lineStyle(2, borderColor, 1);
      g.beginFill(fillColor, 0.9);
      g.drawRect(-w / 2, -h / 2, w, h);
      g.endFill();
      g.beginFill(innerColor, 0.7);
      g.drawRect(-w / 4, -h / 4, w / 2, h / 2);
      g.endFill();

      // 逆流方向箭头
      if (reverse) {
        g.beginFill(0xffffff, 0.8);
        g.moveTo(w / 4, 0);
        g.lineTo(-w / 4, -h / 4);
        g.lineTo(-w / 4, h / 4);
        g.closePath();
        g.endFill();
      }

      g.position.set(pos.x, pos.y);
      g.rotation = state.worldRotation;
    }
  }

  private calcWorldPosition(
    state: PalletRuntimeState,
    conveyors: Record<string, ConveyorData>,
    transfers: Record<string, TransferMachineData>,
    forklifts: Record<string, ForkliftData>,
  ): { x: number; y: number } | null {
    const conveyor = conveyors[state.currentComponentId];
    if (conveyor) {
      const zoneSpacingPx = metersToPixels(conveyor.zoneSpacing);
      const zoneCount = Math.max(1, Math.floor(conveyor.length / conveyor.zoneSpacing));
      const totalZoneLen = zoneCount * zoneSpacingPx;
      const startOffset = -totalZoneLen / 2 + zoneSpacingPx / 2;

      const localX = startOffset + state.currentZoneIndex * zoneSpacingPx + state.progressInZone * zoneSpacingPx;

      const cos = Math.cos(conveyor.rotation);
      const sin = Math.sin(conveyor.rotation);

      return {
        x: conveyor.x + localX * cos,
        y: conveyor.y + localX * sin,
      };
    }

    const transfer = transfers[state.currentComponentId];
    if (transfer) {
      return { x: transfer.x, y: transfer.y };
    }

    const forklift = forklifts[state.currentComponentId];
    if (forklift) {
      return { x: forklift.x, y: forklift.y };
    }

    return null;
  }
}
