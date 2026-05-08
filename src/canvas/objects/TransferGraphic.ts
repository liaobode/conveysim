import * as PIXI from 'pixi.js';
import type { TransferMachineData } from '../../types';

const SIZE = 50;

export class TransferGraphic extends PIXI.Container {
  transferId: string;
  private body: PIXI.Graphics;
  private portLabels: PIXI.Container;
  private nameText: PIXI.Text;

  constructor(data: TransferMachineData) {
    super();
    this.transferId = data.id;

    this.body = new PIXI.Graphics();
    this.portLabels = new PIXI.Container();
    this.nameText = new PIXI.Text('', {
      fontSize: 10,
      fill: 0xe0e0e0,
      fontFamily: 'sans-serif',
    });
    this.nameText.anchor.set(0.5);
    this.nameText.position.set(0, -SIZE / 2 - 14);
    this.addChild(this.body, this.portLabels, this.nameText);
    this.draw(data);
  }

  draw(data: TransferMachineData): void {
    const half = SIZE / 2;
    this.body.clear();
    this.body.lineStyle(2, 0xe9a820, 1);
    this.body.beginFill(0x3a2a0a, 0.8);
    this.body.drawRect(-half, -half, SIZE, SIZE);
    this.body.endFill();

    // 中心文字
    this.body.beginFill(0xe9a820, 0.9);
    this.body.lineStyle(0);
    this.body.drawCircle(0, 0, 12);
    this.body.endFill();

    // 标签：优先显示自定义标签，否则显示 ID 后4位
    this.nameText.text = data.label || data.id.slice(-4);
    this.nameText.style.fill = data.label ? 0xe0e0e0 : 0x888888;

    // 端口标签
    this.portLabels.removeChildren();
    const portDefs = [
      { x: 0, y: -half - 8, label: 'N', color: 0x4ae04a },
      { x: 0, y: half + 8, label: 'S', color: 0x4a8ae0 },
      { x: half + 8, y: 0, label: 'E', color: 0xe9a820 },
      { x: -half - 8, y: 0, label: 'W', color: 0xe94560 },
    ];
    for (const p of portDefs) {
      // 端口点
      this.body.beginFill(p.color, 0.8);
      this.body.drawCircle(p.x > 0 ? half : p.x < 0 ? -half : 0, p.y > 0 ? half : p.y < 0 ? -half : 0, 5);
      this.body.endFill();
      // 标签
      const txt = new PIXI.Text(p.label, {
        fontSize: 10,
        fill: p.color,
        fontFamily: 'sans-serif',
        fontWeight: 'bold',
      });
      txt.anchor.set(0.5);
      txt.position.set(p.x, p.y);
      this.portLabels.addChild(txt);
    }

    this.position.set(data.x, data.y);
  }

  setHighlight(on: boolean): void {
    this.body.clear();
    const half = SIZE / 2;
    this.body.lineStyle(on ? 3 : 2, on ? 0xe94560 : 0xe9a820, 1);
    this.body.beginFill(0x3a2a0a, 0.8);
    this.body.drawRect(-half, -half, SIZE, SIZE);
    this.body.endFill();
  }
}
