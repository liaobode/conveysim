import * as PIXI from 'pixi.js';
import { GridLayer } from './layers/GridLayer';
import { ConveyorLayer } from './layers/ConveyorLayer';
import { ComponentLayer } from './layers/ComponentLayer';
import { PalletLayer } from './layers/PalletLayer';
import { HeatmapLayer } from './layers/HeatmapLayer';
import { useSimulationStore } from '../stores/simulationStore';
import { SelectionManager } from './interactions/SelectionManager';
import { SnapManager } from './interactions/SnapManager';
import { useCanvasStore } from '../stores/canvasStore';
import { useEditorStore } from '../stores/editorStore';

export class CanvasManager {
  app!: PIXI.Application;
  hasRenderer = true;
  gridLayer: GridLayer;
  conveyorLayer: ConveyorLayer;
  componentLayer: ComponentLayer;
  palletLayer: PalletLayer;
  heatmapLayer: HeatmapLayer;
  selection: SelectionManager;
  snap: SnapManager;
  private rubberBand: PIXI.Graphics;
  private lockOverlay: PIXI.Container;
  private lockBg: PIXI.Graphics;
  private lockText: PIXI.Text;

  private canvasStore = useCanvasStore();
  private editorStore = useEditorStore();
  private simStore = useSimulationStore();
  private worldContainer: PIXI.Container;
  /** 避免 idle 无数据时每帧重复清除 GPU 绘制 */
  private _idleCleared = false;

  constructor(host: HTMLElement) {
    try {
      this.app = new PIXI.Application({
        width: host.clientWidth,
        height: host.clientHeight,
        backgroundColor: 0x0a0a1a,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });
      host.appendChild(this.app.view as unknown as HTMLElement);
    } catch {
      // WebGL 不可用时的降级提示
      this.hasRenderer = false;
      const msg = document.createElement('div');
      msg.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%;color:#e94560;font-size:18px;text-align:center;padding:40px;';
      msg.innerHTML = '浏览器不支持 WebGL<br><small style="color:#888">请使用最新版 Chrome / Firefox / Edge</small>';
      host.appendChild(msg);
      return;
    }

    // 世界容器：所有游戏对象均挂在此下，通过改变其 transform 实现视口
    this.worldContainer = new PIXI.Container();
    this.app.stage.addChild(this.worldContainer);

    // 创建各层
    this.gridLayer = new GridLayer(this.worldContainer);
    this.conveyorLayer = new ConveyorLayer(this.worldContainer);
    this.componentLayer = new ComponentLayer(this.worldContainer);
    // 连接线和端口高亮在移载机层之上
    this.worldContainer.addChild(this.conveyorLayer.connectionLines);
    this.worldContainer.addChild(this.conveyorLayer.portHighlight);
    this.palletLayer = new PalletLayer(this.worldContainer);
    this.heatmapLayer = new HeatmapLayer(this.worldContainer);

    // 交互
    this.selection = new SelectionManager(this);
    this.snap = new SnapManager();
    this.snap.setContainer(this.worldContainer);

    // 框选矩形（顶层）
    this.rubberBand = new PIXI.Graphics();
    this.worldContainer.addChild(this.rubberBand);

    // 仿真锁定遮罩（最顶层，默认隐藏）
    this.lockOverlay = new PIXI.Container();
    this.lockBg = new PIXI.Graphics();
    this.lockText = new PIXI.Text('仿真运行中 — 编辑已锁定', {
      fontSize: 14,
      fill: 0xe94560,
      fontFamily: 'sans-serif',
      fontWeight: 'bold',
    });
    this.lockText.anchor.set(0.5);
    this.lockOverlay.addChild(this.lockBg, this.lockText);
    this.lockOverlay.visible = false;
    this.worldContainer.addChild(this.lockOverlay);

    // 初始绘制
    this.gridLayer.draw();

    // Ticker：仿真时更新托盘和热力图
    this.app.ticker.add(this.onTick);

    // 监听 window resize
    window.addEventListener('resize', this.onResize);
  }

  /** 同步视口变换 */
  syncViewport(): void {
    if (!this.hasRenderer) return;
    const { x, y, scale } = this.editorStore.viewport;
    this.worldContainer.x = x;
    this.worldContainer.y = y;
    this.worldContainer.scale.set(scale);
  }

  /** 刷新输送机层（编辑后调用） */
  refreshConveyors(): void {
    if (!this.hasRenderer) return;
    this.conveyorLayer.sync(this.canvasStore.conveyorList);
  }

  /** 刷新组件层 */
  refreshComponents(): void {
    this.componentLayer.sync(
      this.canvasStore.transferList,
      this.canvasStore.forkliftList,
    );
  }

  private onTick = (): void => {
    if (!this.hasRenderer) return;
    const running = this.simStore.status === 'running' || this.simStore.status === 'paused';
    const locked = this.simStore.status !== 'idle' || this.simStore.multiRunTotal > 0;

    // 仿真锁定遮罩
    this.lockOverlay.visible = locked;
    if (locked) {
      this.lockBg.clear();
      this.lockBg.beginFill(0x000000, 0.05);
      this.lockBg.drawRect(-10000, -10000, 20000, 20000);
      this.lockBg.endFill();

      // 文字位于视口左上角
      const { x, y, scale } = this.editorStore.viewport;
      const app = this.app;
      const lx = (24 - x) / scale;
      const ly = (8 - y) / scale;
      this.lockText.position.set(lx, ly);
      this.lockText.anchor.set(0, 0);
    }

    if (running || this.simStore.tickCount > 0) {
      this._idleCleared = false;
      this.palletLayer.sync(this.simStore.palletStates, this.canvasStore.conveyors, this.canvasStore.transferMachines, this.canvasStore.forklifts);
      this.heatmapLayer.update(this.simStore.conveyorUtilization, this.canvasStore.conveyorList);
      this.componentLayer.updateForkliftCooldowns(this.simStore.forkliftCooldowns, this.canvasStore.forkliftList);
    } else if (!this._idleCleared) {
      this._idleCleared = true;
      this.palletLayer.sync({}, {}, {}, {});
      this.heatmapLayer.update({}, []);
      this.componentLayer.updateForkliftCooldowns({}, this.canvasStore.forkliftList);
    }
  };

  /** 更新热力图 */
  updateHeatmap(): void {
    this.heatmapLayer.update(this.simStore.conveyorUtilization, this.canvasStore.conveyorList);
  }

  /** 显示框选矩形 */
  showRubberBand(x1: number, y1: number, x2: number, y2: number): void {
    this.rubberBand.clear();
    this.rubberBand.lineStyle(1, 0x4ae04a, 0.8);
    this.rubberBand.beginFill(0x4ae04a, 0.1);
    this.rubberBand.drawRect(
      Math.min(x1, x2), Math.min(y1, y2),
      Math.abs(x2 - x1), Math.abs(y2 - y1),
    );
    this.rubberBand.endFill();
  }

  /** 隐藏框选矩形 */
  hideRubberBand(): void {
    this.rubberBand.clear();
  }

  resize(width: number, height: number): void {
    if (!this.hasRenderer) return;
    this.app.renderer.resize(width, height);
  }

  destroy(): void {
    window.removeEventListener('resize', this.onResize);
    if (!this.hasRenderer) return;
    this.app.destroy(false, { children: true });
  }

  private onResize = (): void => {
    const el = this.app.view as unknown as HTMLElement;
    const parent = el.parentElement;
    if (parent) {
      this.resize(parent.clientWidth, parent.clientHeight);
    }
  };
}
