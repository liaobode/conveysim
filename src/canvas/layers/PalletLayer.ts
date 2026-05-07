import * as PIXI from 'pixi.js';
import type { PalletRuntimeState, ConveyorData } from '../../types';
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
      const conveyor = conveyors[state.currentComponentId];
      if (!conveyor) continue;

      const pos = this.calcWorldPosition(state, conveyor);
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
      g.lineStyle(2, blocked ? 0xff0040 : 0xffaa00, 1);
      g.beginFill(blocked ? 0x801020 : 0xc89030, 0.9);
      g.drawRect(-w / 2, -h / 2, w, h);
      g.endFill();
      g.beginFill(blocked ? 0xff2040 : 0xe0a840, 0.7);
      g.drawRect(-w / 4, -h / 4, w / 2, h / 2);
      g.endFill();

      g.position.set(pos.x, pos.y);
      g.rotation = pos.rotation;
    }
  }

  private calcWorldPosition(
    state: PalletRuntimeState,
    conveyor: ConveyorData,
  ): { x: number; y: number; rotation: number } | null {
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
      rotation: conveyor.rotation,
    };
  }
}
