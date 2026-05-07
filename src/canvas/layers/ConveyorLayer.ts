import * as PIXI from 'pixi.js';
import type { ConveyorData } from '../../types';
import { ConveyorGraphic } from '../objects/ConveyorGraphic';
import { useCanvasStore } from '../../stores/canvasStore';
import { useEditorStore } from '../../stores/editorStore';
import { getConveyorPort } from '../../utils/geometry';

export class ConveyorLayer {
  private container: PIXI.Container;
  private graphics = new Map<string, ConveyorGraphic>();
  connectionLines: PIXI.Graphics;
  portHighlight: PIXI.Graphics;
  private canvasStore = useCanvasStore();
  private editorStore = useEditorStore();

  constructor(parent: PIXI.Container) {
    this.container = new PIXI.Container();
    this.connectionLines = new PIXI.Graphics();
    this.portHighlight = new PIXI.Graphics();
    parent.addChild(this.container);
    // connectionLines / portHighlight 由 CanvasManager 在 ComponentLayer 之后添加
  }

  sync(conveyors: ConveyorData[]): void {
    const activeIds = new Set(conveyors.map((c) => c.id));

    for (const [id, g] of this.graphics) {
      if (!activeIds.has(id)) {
        this.container.removeChild(g);
        g.destroy();
        this.graphics.delete(id);
      }
    }

    for (const data of conveyors) {
      const existing = this.graphics.get(data.id);
      if (existing) {
        existing.draw(data);
      } else {
        const g = new ConveyorGraphic(data);
        this.container.addChild(g);
        this.graphics.set(data.id, g);
      }
    }

    this.drawConnections();
  }

  private drawConnections(): void {
    this.connectionLines.clear();
    const conns = this.canvasStore.connectionList;
    if (conns.length === 0) return;

    for (const conn of conns) {
      const fromPos = this.getPortPos(conn.from.componentId, conn.from.portName);
      const toPos = this.getPortPos(conn.to.componentId, conn.to.portName);
      if (!fromPos || !toPos) continue;

      const isSelected = conn.id === this.editorStore.selectedConnectionId;
      const color = isSelected ? 0xe94560 : 0x4ae04a;
      const alpha = isSelected ? 1.0 : 0.7;
      const radius = isSelected ? 7 : 5;

      // 画线
      this.connectionLines.lineStyle(isSelected ? 4 : 3, color, alpha);
      this.connectionLines.moveTo(fromPos.x, fromPos.y);
      this.connectionLines.lineTo(toPos.x, toPos.y);

      // 画端点圆
      this.connectionLines.lineStyle(0);
      this.connectionLines.beginFill(color, alpha);
      this.connectionLines.drawCircle(fromPos.x, fromPos.y, radius);
      this.connectionLines.drawCircle(toPos.x, toPos.y, radius);
      this.connectionLines.endFill();
    }
  }

  private getPortPos(compId: string, portName: string): { x: number; y: number } | null {
    const conv = this.canvasStore.conveyors[compId];
    if (conv) {
      const p = getConveyorPort(conv.x, conv.y, conv.rotation, conv.length, portName === 'input' ? 'input' : 'output');
      return p;
    }
    const trans = this.canvasStore.transferMachines[compId];
    if (trans) {
      const half = 25;
      switch (portName) {
        case 'north': return { x: trans.x, y: trans.y - half };
        case 'south': return { x: trans.x, y: trans.y + half };
        case 'east': return { x: trans.x + half, y: trans.y };
        case 'west': return { x: trans.x - half, y: trans.y };
      }
    }
    const fork = this.canvasStore.forklifts[compId];
    if (fork) {
      return { x: fork.x + 26, y: fork.y };
    }
    return null;
  }

  getGraphic(id: string): ConveyorGraphic | undefined {
    return this.graphics.get(id);
  }

  showPortHighlight(x: number, y: number): void {
    this.portHighlight.clear();
    this.portHighlight.lineStyle(2, 0x4ae04a, 0.9);
    this.portHighlight.beginFill(0x4ae04a, 0.2);
    this.portHighlight.drawCircle(x, y, 10);
    this.portHighlight.endFill();
  }

  clearPortHighlight(): void {
    this.portHighlight.clear();
  }

  /** 获取所有连接中可用的端口位置列表 */
  getPortPositions(): { x: number; y: number; compId: string; portName: string }[] {
    const ports: { x: number; y: number; compId: string; portName: string }[] = [];

    for (const conv of this.canvasStore.conveyorList) {
      ports.push({ ...getConveyorPort(conv.x, conv.y, conv.rotation, conv.length, 'input'), compId: conv.id, portName: 'input' });
      ports.push({ ...getConveyorPort(conv.x, conv.y, conv.rotation, conv.length, 'output'), compId: conv.id, portName: 'output' });
    }
    for (const trans of this.canvasStore.transferList) {
      const half = 25;
      ports.push({ x: trans.x, y: trans.y - half, compId: trans.id, portName: 'north' });
      ports.push({ x: trans.x, y: trans.y + half, compId: trans.id, portName: 'south' });
      ports.push({ x: trans.x + half, y: trans.y, compId: trans.id, portName: 'east' });
      ports.push({ x: trans.x - half, y: trans.y, compId: trans.id, portName: 'west' });
    }
    for (const fork of this.canvasStore.forkliftList) {
      ports.push({ x: fork.x + 26, y: fork.y, compId: fork.id, portName: 'output' });
    }

    return ports;
  }
}
