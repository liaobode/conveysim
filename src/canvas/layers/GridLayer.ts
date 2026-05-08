import * as PIXI from 'pixi.js';
import { PIXELS_PER_METER } from '../../utils/geometry';

const GRID_COLOR = 0x1a1a3e;
const GRID_SPACING = PIXELS_PER_METER; // 1 格 = 1 米

export class GridLayer {
  private graphics: PIXI.Graphics;
  private dots: PIXI.Graphics;

  constructor(parent: PIXI.Container) {
    this.graphics = new PIXI.Graphics();
    this.dots = new PIXI.Graphics();
    parent.addChild(this.graphics);
    parent.addChild(this.dots);
  }

  draw(): void {
    const g = this.graphics;
    g.clear();

    const size = 6000;
    const step = GRID_SPACING;

    // 细网格线（1m 间距）
    g.lineStyle(1, GRID_COLOR, 0.15);
    for (let x = -size; x <= size; x += step) {
      g.moveTo(x, -size);
      g.lineTo(x, size);
    }
    for (let y = -size; y <= size; y += step) {
      g.moveTo(-size, y);
      g.lineTo(size, y);
    }

    // 粗网格线（5m 间距）
    g.lineStyle(1, GRID_COLOR, 0.3);
    const coarseStep = step * 5;
    for (let x = -size; x <= size; x += coarseStep) {
      g.moveTo(x, -size);
      g.lineTo(x, size);
    }
    for (let y = -size; y <= size; y += coarseStep) {
      g.moveTo(-size, y);
      g.lineTo(size, y);
    }

    // 每 5m 交叉点画小圆点
    const d = this.dots;
    d.clear();
    for (let x = -size; x <= size; x += coarseStep) {
      for (let y = -size; y <= size; y += coarseStep) {
        d.beginFill(GRID_COLOR, 0.4);
        d.drawCircle(x, y, 2);
        d.endFill();
      }
    }

    // 原点十字
    g.lineStyle(2, 0x0f3460, 0.6);
    g.moveTo(-size, 0);
    g.lineTo(size, 0);
    g.moveTo(0, -size);
    g.lineTo(0, size);

    // 原点大圆点
    d.beginFill(0x0f3460, 0.8);
    d.drawCircle(0, 0, 5);
    d.endFill();
  }
}
