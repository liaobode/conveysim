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
  app: PIXI.Application;
  gridLayer: GridLayer;
  conveyorLayer: ConveyorLayer;
  componentLayer: ComponentLayer;
  palletLayer: PalletLayer;
  heatmapLayer: HeatmapLayer;
  selection: SelectionManager;
  snap: SnapManager;
  private rubberBand: PIXI.Graphics;
  private lockOverlay: PIXI.Graphics;

  private canvasStore = useCanvasStore();
  private editorStore = useEditorStore();
  private simStore = useSimulationStore();
  private worldContainer: PIXI.Container;

  constructor(host: HTMLElement) {
    this.app = new PIXI.Application({
      width: host.clientWidth,
      height: host.clientHeight,
      backgroundColor: 0x0a0a1a,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });
    host.appendChild(this.app.view as unknown as HTMLElement);

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
    this.lockOverlay = new PIXI.Graphics();
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
    const { x, y, scale } = this.editorStore.viewport;
    this.worldContainer.x = x;
    this.worldContainer.y = y;
    this.worldContainer.scale.set(scale);
  }

  /** 刷新输送机层（编辑后调用） */
  refreshConveyors(): void {
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
    const running = this.simStore.status === 'running' || this.simStore.status === 'paused';
    const locked = this.simStore.status !== 'idle' || this.simStore.multiRunTotal > 0;

    // 仿真锁定遮罩
    this.lockOverlay.visible = locked;
    if (locked) {
      this.lockOverlay.clear();
      this.lockOverlay.beginFill(0x000000, 0.03);
      this.lockOverlay.drawRect(-10000, -10000, 20000, 20000);
      this.lockOverlay.endFill();
    }

    if (running || this.simStore.tickCount > 0) {
      this.palletLayer.sync(this.simStore.palletStates, this.canvasStore.conveyors, this.canvasStore.transferMachines, this.canvasStore.forklifts);
      this.heatmapLayer.update(this.simStore.conveyorUtilization, this.canvasStore.conveyorList);
      this.componentLayer.updateForkliftCooldowns(this.simStore.forkliftCooldowns, this.canvasStore.forkliftList);
    } else {
      // 停止后清除残留
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
    this.app.renderer.resize(width, height);
  }

  destroy(): void {
    window.removeEventListener('resize', this.onResize);
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
