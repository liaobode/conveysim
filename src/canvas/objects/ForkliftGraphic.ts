import * as PIXI from 'pixi.js';
import type { ForkliftData } from '../../types';

export class ForkliftGraphic extends PIXI.Container {
  forkliftId: string;
  private body: PIXI.Graphics;
  private cooldownBar: PIXI.Graphics;
  private data: ForkliftData;
  private prevCooldown = 0;

  constructor(data: ForkliftData) {
    super();
    this.forkliftId = data.id;
    this.data = data;
    this.body = new PIXI.Graphics();
    this.addChild(this.body);
    this.cooldownBar = new PIXI.Graphics();
    this.addChild(this.cooldownBar);
    this.draw(data);
  }

  draw(data: ForkliftData): void {
    this.data = data;
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

    // 标签：优先显示自定义标签，否则显示角色名称
    const label = data.label || (data.role === 'generator' ? '上料' : '下料');
    const oldText = this.getChildAt(this.children.length - 1);
    if (oldText instanceof PIXI.Text) {
      oldText.destroy();
    }
    const text = new PIXI.Text(label, {
      fontSize: 10,
      fill: color,
      fontFamily: 'sans-serif',
      fontWeight: data.label ? 'bold' : 'normal',
    });
    text.anchor.set(0.5);
    text.y = -18;
    this.addChild(text);

    this.position.set(data.x, data.y);
  }

  setHighlight(on: boolean): void {
    const w = 40;
    const h = 30;
    const role = this.data.role;
    const color = role === 'generator' ? 0x4ae04a : 0x4a8ae0;
    this.body.clear();
    if (on) {
      this.body.lineStyle(0);
      this.body.beginFill(0xe94560, 0.08);
      this.body.drawRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8);
      this.body.endFill();
    }
    this.body.lineStyle(on ? 3 : 2, on ? 0xe94560 : color, 1);
    this.body.beginFill(role === 'generator' ? 0x0a2a0a : 0x0a1a3a, 0.8);
    this.body.drawRect(-w / 2, -h / 2, w, h);
    this.body.endFill();
  }

  updateCooldown(cooldown: number, interval: number): void {
    this.cooldownBar.clear();
    // cooldown < 0 表示消费者空闲无等待托盘，隐藏进度条和脉冲
    if (cooldown < 0 || interval <= 0) {
      this.body.alpha = 1;
      return;
    }

    const w = 40;
    const progress = 1 - cooldown / interval;
    const clamped = Math.max(0, Math.min(1, progress));
    const barWidth = clamped * w;
    const barY = 18; // 车身底部下方

    // 进度条颜色：冷却中(红) → 就绪(绿)
    const r = Math.floor(0xe9 * (1 - clamped) + 0x4a * clamped);
    const g = Math.floor(0x45 * (1 - clamped) + 0xe0 * clamped);
    const b = Math.floor(0x60 * (1 - clamped) + 0x4a * clamped);
    const barColor = (r << 16) | (g << 8) | b;

    // 背景
    this.cooldownBar.lineStyle(1, 0x333355, 0.6);
    this.cooldownBar.beginFill(0x111133, 0.5);
    this.cooldownBar.drawRect(-w / 2, barY, w, 4);
    this.cooldownBar.endFill();

    // 填充
    if (barWidth > 0) {
      this.cooldownBar.beginFill(barColor, 0.9);
      this.cooldownBar.drawRect(-w / 2, barY, barWidth, 4);
      this.cooldownBar.endFill();
    }

    // 脉冲效果：冷却刚重置时闪烁
    if (cooldown > this.prevCooldown && cooldown > interval * 0.8) {
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 80);
      this.body.alpha = 0.6 + 0.4 * pulse;
    } else {
      this.body.alpha = 1;
    }
    this.prevCooldown = cooldown;
  }
}
