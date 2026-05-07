import * as PIXI from 'pixi.js';
import type { ForkliftData } from '../../types';

export class ForkliftGraphic extends PIXI.Container {
  forkliftId: string;
  private body: PIXI.Graphics;

  constructor(data: ForkliftData) {
    super();
    this.forkliftId = data.id;
    this.body = new PIXI.Graphics();
    this.addChild(this.body);
    this.draw(data);
  }

  draw(data: ForkliftData): void {
    const w = 40;
    const h = 30;
    const color = data.role === 'generator' ? 0x4ae04a : 0x4a8ae0;

    this.body.clear();
    this.body.lineStyle(2, color, 1);
    this.body.beginFill(data.role === 'generator' ? 0x0a2a0a : 0x0a1a3a, 0.8);
    this.body.drawRect(-w / 2, -h / 2, w, h);
    this.body.endFill();

    // 叉臂
    this.body.lineStyle(2, color, 0.8);
    this.body.moveTo(w / 2, -h / 2);
    this.body.lineTo(w / 2 + 12, -h / 2 + 4);
    this.body.lineTo(w / 2 + 12, h / 2 - 4);
    this.body.lineTo(w / 2, h / 2);

    // 标签
    const label = data.role === 'generator' ? '上料' : '下料';
    const text = new PIXI.Text(label, {
      fontSize: 11,
      fill: color,
      fontFamily: 'sans-serif',
    });
    text.anchor.set(0.5);
    this.addChild(text);

    this.position.set(data.x, data.y);
  }
}
