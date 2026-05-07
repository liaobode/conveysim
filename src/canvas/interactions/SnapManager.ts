import * as PIXI from 'pixi.js';
import type { PortGeometry, PortId } from '../../types';
import { getConveyorPort, distance } from '../../utils/geometry';
import { useCanvasStore } from '../../stores/canvasStore';

const SNAP_THRESHOLD = 20;
const TRANSFER_SIZE = 50;

export class SnapManager {
  private canvasStore = useCanvasStore();

  // 连线模式
  private wireActive = false;
  private wireStartPort: PortId | null = null;
  private wireStartPos: { x: number; y: number } | null = null;
  private wireCurrentPos: { x: number; y: number } = { x: 0, y: 0 };
  private wirePreview: PIXI.Graphics | null = null;
  private wireContainer: PIXI.Container | null = null;

  setContainer(container: PIXI.Container): void {
    this.wireContainer = container;
  }

  /** 获取某组件的所有端口几何信息 */
  getPorts(componentId: string): { id: PortId; geometry: PortGeometry }[] {
    const ports: { id: PortId; geometry: PortGeometry }[] = [];

    const conveyor = this.canvasStore.conveyors[componentId];
    if (conveyor) {
      const input = getConveyorPort(conveyor.x, conveyor.y, conveyor.rotation, conveyor.length, 'input');
      const output = getConveyorPort(conveyor.x, conveyor.y, conveyor.rotation, conveyor.length, 'output');
      ports.push({
        id: { componentId: conveyor.id, portName: 'input' },
        geometry: { worldX: input.x, worldY: input.y, normalAngle: conveyor.rotation + Math.PI },
      });
      ports.push({
        id: { componentId: conveyor.id, portName: 'output' },
        geometry: { worldX: output.x, worldY: output.y, normalAngle: conveyor.rotation },
      });
      return ports;
    }

    const transfer = this.canvasStore.transferMachines[componentId];
    if (transfer) {
      const dirs: { name: string; dx: number; dy: number; angle: number }[] = [
        { name: 'north', dx: 0, dy: -TRANSFER_SIZE / 2, angle: -Math.PI / 2 },
        { name: 'south', dx: 0, dy: TRANSFER_SIZE / 2, angle: Math.PI / 2 },
        { name: 'east', dx: TRANSFER_SIZE / 2, dy: 0, angle: 0 },
        { name: 'west', dx: -TRANSFER_SIZE / 2, dy: 0, angle: Math.PI },
      ];
      for (const d of dirs) {
        ports.push({
          id: { componentId: transfer.id, portName: d.name },
          geometry: {
            worldX: transfer.x + d.dx,
            worldY: transfer.y + d.dy,
            normalAngle: d.angle,
          },
        });
      }
      return ports;
    }

    const forklift = this.canvasStore.forklifts[componentId];
    if (forklift) {
      const portName = forklift.role === 'consumer' ? 'input' : 'output';
      ports.push({
        id: { componentId: forklift.id, portName },
        geometry: { worldX: forklift.x + 26, worldY: forklift.y, normalAngle: 0 },
      });
      return ports;
    }

    return ports;
  }

  /** 检查某个端口与画布上所有其他端口的最近匹配 */
  findSnapTarget(
    componentId: string,
    portName: string,
    worldX: number,
    worldY: number,
  ): PortId | null {
    let best: PortId | null = null;
    let bestDist = SNAP_THRESHOLD;

    for (const otherComp of this.allComponents) {
      if (otherComp.id === componentId) continue;

      for (const { id, geometry } of this.getPorts(otherComp.id)) {
        const d = distance({ x: worldX, y: worldY }, { x: geometry.worldX, y: geometry.worldY });
        if (d < bestDist) {
          // 检查连接是否合法
          if (this.canConnect(componentId, portName, id.componentId, id.portName)) {
            bestDist = d;
            best = id;
          }
        }
      }
    }

    return best;
  }

  /** 自动连接：当组件被放置后，检测其端口附近是否有可连接的端口 */
  autoConnect(componentId: string): string[] {
    const created: string[] = [];
    const ports = this.getPorts(componentId);

    for (const { id, geometry } of ports) {
      const target = this.findSnapTarget(componentId, id.portName, geometry.worldX, geometry.worldY);
      if (target) {
        // 确保没有重复连接
        if (!this.hasConnection(id, target)) {
          this.canvasStore.pushUndoSnapshot();
          // input 端口作为连接目标（如消费者接收托盘），方向反转
          const [fromComp, fromPort, toComp, toPort] = id.portName === 'input'
            ? [target.componentId, target.portName, id.componentId, id.portName]
            : [id.componentId, id.portName, target.componentId, target.portName];
          const connId = this.canvasStore.addConnection(fromComp, fromPort, toComp, toPort);
          created.push(connId);
        }
      }
    }

    return created;
  }

  /** 检查两个端口是否可以连接 */
  canConnect(fromComp: string, _fromPort: string, toComp: string, _toPort: string): boolean {
    const fromConv = this.canvasStore.conveyors[fromComp];
    const toConv = this.canvasStore.conveyors[toComp];
    const fromTrans = this.canvasStore.transferMachines[fromComp];
    const toTrans = this.canvasStore.transferMachines[toComp];

    // 输送机 → 输送机：同类型
    if (fromConv && toConv) {
      return fromConv.type === toConv.type;
    }

    // 输送机 → 移载机 或 移载机 → 输送机
    if (fromConv && toTrans) return true;
    if (fromTrans && toConv) return true;

    // 叉车 → 输送机（generator 输出到输送机）
    if (this.canvasStore.forklifts[fromComp] && toConv) return true;
    // 输送机 → 叉车（输送机输出到 consumer 输入）
    if (fromConv && this.canvasStore.forklifts[toComp]) return true;

    return false;
  }

  /** 检查是否已有连接 */
  hasConnection(from: PortId, to: PortId): boolean {
    for (const conn of Object.values(this.canvasStore.connections)) {
      if (
        conn.from.componentId === from.componentId && conn.from.portName === from.portName &&
        conn.to.componentId === to.componentId && conn.to.portName === to.portName
      ) return true;
      if (
        conn.from.componentId === to.componentId && conn.from.portName === to.portName &&
        conn.to.componentId === from.componentId && conn.to.portName === from.portName
      ) return true;
    }
    return false;
  }

  private get allComponents(): { id: string }[] {
    return [
      ...Object.values(this.canvasStore.conveyors),
      ...Object.values(this.canvasStore.transferMachines),
      ...Object.values(this.canvasStore.forklifts),
    ];
  }

  // ======= 连线工具 =======

  /** 查找离给定坐标最近的端口 */
  findNearestPort(wx: number, wy: number, excludeCompId?: string): { portId: PortId; geometry: PortGeometry } | null {
    let best: { portId: PortId; geometry: PortGeometry } | null = null;
    let bestDist = SNAP_THRESHOLD * 2; // 连线模式下放宽阈值

    for (const comp of this.allComponents) {
      if (excludeCompId && comp.id === excludeCompId) continue;
      for (const { id, geometry } of this.getPorts(comp.id)) {
        const d = distance({ x: wx, y: wy }, { x: geometry.worldX, y: geometry.worldY });
        if (d < bestDist) {
          bestDist = d;
          best = { portId: id, geometry };
        }
      }
    }
    return best;
  }

  /** 开始连线：点击第一个端口 */
  startWire(wx: number, wy: number): void {
    const nearest = this.findNearestPort(wx, wy);
    if (nearest) {
      this.wireActive = true;
      this.wireStartPort = nearest.portId;
      this.wireStartPos = { x: nearest.geometry.worldX, y: nearest.geometry.worldY };
      this.wireCurrentPos = { x: wx, y: wy };
      this.drawPreview();
    }
  }

  /** 更新连线预览 */
  updateWire(wx: number, wy: number): void {
    if (!this.wireActive) return;
    this.wireCurrentPos = { x: wx, y: wy };
    this.drawPreview();
  }

  /** 完成连线：释放到第二个端口 */
  finishWire(): string | null {
    if (!this.wireActive || !this.wireStartPort) {
      this.cancelWire();
      return null;
    }

    const nearest = this.findNearestPort(this.wireCurrentPos.x, this.wireCurrentPos.y, this.wireStartPort.componentId);
    if (nearest && this.canConnect(
      this.wireStartPort.componentId, this.wireStartPort.portName,
      nearest.portId.componentId, nearest.portId.portName,
    )) {
      if (!this.hasConnection(this.wireStartPort, nearest.portId)) {
        this.canvasStore.pushUndoSnapshot();
        // input 端口作为连接目标，方向反转
        const startPort = this.wireStartPort!;
        const endPort = nearest.portId;
        const [fromComp, fromPort, toComp, toPort] = startPort.portName === 'input'
          ? [endPort.componentId, endPort.portName, startPort.componentId, startPort.portName]
          : [startPort.componentId, startPort.portName, endPort.componentId, endPort.portName];
        const connId = this.canvasStore.addConnection(fromComp, fromPort, toComp, toPort);
        this.cancelWire();
        return connId;
      }
    }

    this.cancelWire();
    return null;
  }

  /** 取消连线 */
  cancelWire(): void {
    this.wireActive = false;
    this.wireStartPort = null;
    this.wireStartPos = null;
    this.clearPreview();
  }

  private drawPreview(): void {
    if (!this.wireContainer) return;
    if (!this.wirePreview) {
      this.wirePreview = new PIXI.Graphics();
      this.wireContainer.addChild(this.wirePreview);
    }
    this.wirePreview.clear();
    if (!this.wireStartPos) return;

    // 起始端口圆圈
    this.wirePreview.lineStyle(0);
    this.wirePreview.beginFill(0x4ae04a, 0.8);
    this.wirePreview.drawCircle(this.wireStartPos.x, this.wireStartPos.y, 6);
    this.wirePreview.endFill();

    // 预览线
    this.wirePreview.lineStyle(2, 0x4ae04a, 0.6);
    this.wirePreview.moveTo(this.wireStartPos.x, this.wireStartPos.y);
    this.wirePreview.lineTo(this.wireCurrentPos.x, this.wireCurrentPos.y);

    // 当前位置圆圈
    this.wirePreview.beginFill(0x4ae04a, 0.4);
    this.wirePreview.drawCircle(this.wireCurrentPos.x, this.wireCurrentPos.y, 6);
    this.wirePreview.endFill();
  }

  private clearPreview(): void {
    if (this.wirePreview) {
      this.wirePreview.clear();
      this.wireContainer?.removeChild(this.wirePreview);
      this.wirePreview.destroy();
      this.wirePreview = null;
    }
  }

  get isWireActive(): boolean {
    return this.wireActive;
  }

  /** 检测点击是否命中连线端点（返回连接 ID） */
  hitTestConnection(wx: number, wy: number): string | null {
    const threshold = 8;
    for (const conn of Object.values(this.canvasStore.connections)) {
      const fromPort = this.getPortPos(conn.from.componentId, conn.from.portName);
      const toPort = this.getPortPos(conn.to.componentId, conn.to.portName);
      if (fromPort && distance({ x: wx, y: wy }, fromPort) < threshold) return conn.id;
      if (toPort && distance({ x: wx, y: wy }, toPort) < threshold) return conn.id;
      // 也检测线段本身
      if (fromPort && toPort) {
        const d = this.pointToSegmentDist(wx, wy, fromPort.x, fromPort.y, toPort.x, toPort.y);
        if (d < threshold) return conn.id;
      }
    }
    return null;
  }

  private getPortPos(compId: string, portName: string): { x: number; y: number } | null {
    const conv = this.canvasStore.conveyors[compId];
    if (conv) return getConveyorPort(conv.x, conv.y, conv.rotation, conv.length, portName === 'input' ? 'input' : 'output');
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
    if (fork) return { x: fork.x + 26, y: fork.y };
    return null;
  }

  private pointToSegmentDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return distance({ x: px, y: py }, { x: x1, y: y1 });
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return distance({ x: px, y: py }, { x: x1 + t * dx, y: y1 + t * dy });
  }
}
