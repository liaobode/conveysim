import * as PIXI from 'pixi.js';
import type { ConveyorData } from '../../types';
import { metersToPixels, PIXELS_PER_METER } from '../../utils/geometry';

/** 链条机 → 灰色底色 + 链条纹理（虚线），滚筒机 → 灰色底色 + 密集短横线 */
export class ConveyorGraphic extends PIXI.Container {
  conveyorId: string;
  private body: PIXI.Graphics;
  private texture: PIXI.Graphics;
  private arrow: PIXI.Graphics;
  private label: PIXI.Text;
  private data: ConveyorData;

  constructor(data: ConveyorData) {
    super();
    this.conveyorId = data.id;
    this.data = data;

    this.body = new PIXI.Graphics();
    this.texture = new PIXI.Graphics();
    this.arrow = new PIXI.Graphics();
    this.label = new PIXI.Text('', {
      fontSize: 10,
      fill: 0x888888,
      fontFamily: 'monospace',
    });
    this.label.anchor.set(0.5, 0);
    this.addChild(this.body, this.texture, this.arrow, this.label);

    this.draw(data);
  }

  draw(data: ConveyorData): void {
    this.data = data;
    const lenPx = metersToPixels(data.length);
    const w = metersToPixels(data.width);

    // 主体
    this.body.clear();
    this.body.lineStyle(2, data.type === 'chain' ? 0x4a4a6a : 0x3a5a8a, 1);
    this.body.beginFill(data.type === 'chain' ? 0x2a2a4a : 0x1a3a5a, 0.8);
    this.body.drawRect(-lenPx / 2, -w / 2, lenPx, w);
    this.body.endFill();

    // 纹理
    this.texture.clear();
    if (data.type === 'chain') {
      // 链条纹理：中间虚线
      this.texture.lineStyle(2, 0x6a6a8a, 0.6);
      const dashLen = 8;
      let x = -lenPx / 2;
      while (x < lenPx / 2) {
        this.texture.moveTo(x, 0);
        this.texture.lineTo(Math.min(x + dashLen, lenPx / 2), 0);
        x += dashLen * 2;
      }
    } else {
      // 滚筒纹理：密集短横线
      this.texture.lineStyle(1, 0x5a7a9a, 0.5);
      const spacing = PIXELS_PER_METER * 0.12;
      for (let x = -lenPx / 2 + spacing; x < lenPx / 2; x += spacing) {
        this.texture.moveTo(x, -w / 2 + 4);
        this.texture.lineTo(x, w / 2 - 4);
      }
    }

    // 方向箭头
    this.arrow.clear();
    if (data.direction === 'forward') {
      const arrowX = lenPx / 2 + 6;
      this.arrow.lineStyle(0);
      this.arrow.beginFill(0xe94560, 0.9);
      this.arrow.moveTo(arrowX, 0);
      this.arrow.lineTo(arrowX - 10, -6);
      this.arrow.lineTo(arrowX - 10, 6);
      this.arrow.closePath();
      this.arrow.endFill();
    } else {
      // 双向 → 两个箭头
      this.arrow.beginFill(0xe94560, 0.6);
      const a1 = lenPx / 2 + 6;
      this.arrow.moveTo(a1, 0);
      this.arrow.lineTo(a1 - 10, -6);
      this.arrow.lineTo(a1 - 10, 6);
      this.arrow.closePath();
      const a2 = -lenPx / 2 - 6;
      this.arrow.moveTo(a2, 0);
      this.arrow.lineTo(a2 + 10, -6);
      this.arrow.lineTo(a2 + 10, 6);
      this.arrow.closePath();
      this.arrow.endFill();
    }

    // 标签：优先显示自定义标签，否则显示 ID 后4位
    const displayLabel = data.label || data.id.slice(-4);
    this.label.text = displayLabel;
    this.label.style.fill = data.label ? 0xe0e0e0 : (data.type === 'chain' ? 0x8a8aaa : 0x6a8a9a);
    this.label.style.fontWeight = data.label ? 'bold' : 'normal';
    this.label.position.set(0, -w / 2 - 12);

    this.position.set(data.x, data.y);
    this.rotation = data.rotation;
  }

  /** 选中高亮 */
  setHighlight(on: boolean): void {
    this.body.clear();
    const borderColor = on ? 0xe94560 : (this.data.type === 'chain' ? 0x4a4a6a : 0x3a5a8a);
    const lenPx = metersToPixels(this.data.length);
    const w = metersToPixels(this.data.width);
    // 选中时绘制外发光层
    if (on) {
      this.body.lineStyle(0);
      this.body.beginFill(0xe94560, 0.08);
      this.body.drawRect(-lenPx / 2 - 4, -w / 2 - 4, lenPx + 8, w + 8);
      this.body.endFill();
    }
    this.body.lineStyle(on ? 3 : 2, borderColor, 1);
    this.body.beginFill(this.data.type === 'chain' ? 0x2a2a4a : 0x1a3a5a, 0.8);
    this.body.drawRect(-lenPx / 2, -w / 2, lenPx, w);
    this.body.endFill();
  }
}
