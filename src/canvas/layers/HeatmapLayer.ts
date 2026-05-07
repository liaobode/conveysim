import * as PIXI from 'pixi.js';
import type { ConveyorData } from '../../types';
import { metersToPixels } from '../../utils/geometry';
import { useSimulationStore } from '../../stores/simulationStore';

function utilizationToColor(util: number): { hex: number; alpha: number } {
  if (util < 0.5) {
    return { hex: 0x00c850, alpha: 0.3 };
  } else if (util < 0.85) {
    const t = (util - 0.5) / 0.35;
    const r = Math.round(255 * t);
    const g = Math.round(200 * (1 - t) + 50 * t);
    const b = Math.round(80 * (1 - t));
    return { hex: (r << 16) | (g << 8) | b, alpha: 0.4 };
  }
  return { hex: 0xff3200, alpha: 0.5 };
}

export class HeatmapLayer {
  private container: PIXI.Container;
  private overlays = new Map<string, PIXI.Graphics>();
  private simStore = useSimulationStore();
  private pulseTime = 0;

  constructor(parent: PIXI.Container) {
    this.container = new PIXI.Container();
    parent.addChild(this.container);
  }

  update(
    utilization: Record<string, number>,
    conveyors: ConveyorData[],
  ): void {
    this.pulseTime += 0.05;
    const conveyorMap = new Map(conveyors.map((c) => [c.id, c]));
    const activeIds = new Set(Object.keys(utilization));

    // 删除不活跃的覆盖层
    for (const [id, g] of this.overlays) {
      if (!activeIds.has(id)) {
        this.container.removeChild(g);
        g.destroy();
        this.overlays.delete(id);
      }
    }

    // 更新
    for (const [id, util] of Object.entries(utilization)) {
      const conveyor = conveyorMap.get(id);
      if (!conveyor) continue;

      let { hex, alpha } = utilizationToColor(util);
      // 瓶颈段脉冲闪烁
      if (id === this.simStore.bottleneckId && util >= 0.5) {
        alpha = 0.4 + 0.3 * Math.sin(this.pulseTime * 3);
      }
      let graphic = this.overlays.get(id);
      if (!graphic) {
        graphic = new PIXI.Graphics();
        this.container.addChild(graphic);
        this.overlays.set(id, graphic);
      }

      const lenPx = metersToPixels(conveyor.length);
      const w = metersToPixels(conveyor.width);

      graphic.clear();
      graphic.beginFill(hex, alpha);
      graphic.drawRect(-lenPx / 2, -w / 2, lenPx, w);
      graphic.endFill();
      graphic.position.set(conveyor.x, conveyor.y);
      graphic.rotation = conveyor.rotation;
    }
  }
}
