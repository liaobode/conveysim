import * as PIXI from 'pixi.js';
import type { PalletData } from '../../types';
import { metersToPixels } from '../../utils/geometry';

export class PalletGraphic extends PIXI.Container {
  palletId: string;
  private body: PIXI.Graphics;

  constructor(data: PalletData) {
    super();
    this.palletId = data.id;
    this.body = new PIXI.Graphics();
    this.addChild(this.body);
    this.draw(data);
  }

  draw(data: PalletData): void {
    const w = metersToPixels(data.size.width);
    const h = metersToPixels(data.size.height);

    this.body.clear();
    this.body.lineStyle(1, 0xc8a060, 1);
    this.body.beginFill(0x4a3820, 0.8);
    this.body.drawRect(-w / 2, -h / 2, w, h);
    this.body.endFill();

    // 货物标记
    this.body.beginFill(0x806830, 0.6);
    this.body.drawRect(-w / 4, -h / 4, w / 2, h / 2);
    this.body.endFill();
  }
}
