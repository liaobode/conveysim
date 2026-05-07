import * as PIXI from 'pixi.js';
import { PIXELS_PER_METER } from '../../utils/geometry';

const GRID_COLOR = 0x1a1a3e;
const GRID_SPACING = PIXELS_PER_METER; // 1 格 = 1 米

export class GridLayer {
  private graphics: PIXI.Graphics;

  constructor(parent: PIXI.Container) {
    this.graphics = new PIXI.Graphics();
    parent.addChild(this.graphics);
  }

  draw(): void {
    const g = this.graphics;
    g.clear();
    g.lineStyle(1, GRID_COLOR, 0.3);

    // 绘制一个大网格覆盖可视区域
    const size = 10000; // 足够大
    const step = GRID_SPACING;

    for (let x = -size; x <= size; x += step) {
      g.moveTo(x, -size);
      g.lineTo(x, size);
    }
    for (let y = -size; y <= size; y += step) {
      g.moveTo(-size, y);
      g.lineTo(size, y);
    }

    // 原点十字
    g.lineStyle(2, 0x0f3460, 0.6);
    g.moveTo(-size, 0);
    g.lineTo(size, 0);
    g.moveTo(0, -size);
    g.lineTo(0, size);
  }
}
