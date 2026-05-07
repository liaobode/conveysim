import { useEditorStore } from '../../stores/editorStore';
import { useCanvasStore } from '../../stores/canvasStore';
import { metersToPixels } from '../../utils/geometry';
import type { CanvasManager } from '../CanvasManager';

interface CompPos {
  id: string;
  x: number;
  y: number;
  rotation: number;
}

export class SelectionManager {
  private canvasManager: CanvasManager;
  private editorStore = useEditorStore();
  private canvasStore = useCanvasStore();

  private isDragging = false;
  private dragStart = { x: 0, y: 0 };
  private dragTargets: CompPos[] = [];

  constructor(canvasManager: CanvasManager) {
    this.canvasManager = canvasManager;
  }

  /** 点击命中检测（不修改选中状态） */
  hitTest(worldX: number, worldY: number): string | null {
    const { id } = this.findHitStrict(worldX, worldY);
    return id || null;
  }

  /** mousedown：选中 + 开始拖拽 */
  handleMouseDown(worldX: number, worldY: number): string | null {
    const { id } = this.findHitStrict(worldX, worldY);

    if (id) {
      // 保存快照用于撤销
      this.canvasStore.pushUndoSnapshot();

      // 多选模式下点击已选中组件 → 保持多选，开始整体拖拽
      if (this.editorStore.isMultiSelect && this.editorStore.selectedComponentIds.includes(id)) {
        this.startMultiDrag(worldX, worldY);
      } else {
        this.editorStore.selectComponent(id);
        this.startSingleDrag(id, worldX, worldY);
      }
      this.highlightSelected();
      return id;
    }

    // 点击空白 → 取消选中
    this.editorStore.deselectAll();
    this.clearHighlights();
    return null;
  }

  /** mousemove：拖拽移动/旋转 */
  handleMouseMove(worldX: number, worldY: number): void {
    if (!this.isDragging || this.dragTargets.length === 0) return;

    const dx = worldX - this.dragStart.x;
    const dy = worldY - this.dragStart.y;

    for (const target of this.dragTargets) {
      this.updateComponent(target.id, {
        x: target.x + dx,
        y: target.y + dy,
      });
    }

    this.canvasManager.refreshConveyors();
    this.canvasManager.refreshComponents();
  }

  /** mouseup：结束拖拽 */
  handleMouseUp(): boolean {
    const wasDragging = this.isDragging;
    if (this.isDragging) {
      this.isDragging = false;
      // 拖拽后尝试自动连接
      for (const target of this.dragTargets) {
        const created = this.canvasManager.snap.autoConnect(target.id);
        if (created.length > 0) {
          this.canvasManager.refreshConveyors();
        }
      }
      this.dragTargets = [];
    }
    return wasDragging;
  }

  /** 删除所有选中组件 */
  deleteSelected(): void {
    const ids = this.editorStore.isMultiSelect
      ? [...this.editorStore.selectedComponentIds]
      : this.editorStore.selectedComponentId
        ? [this.editorStore.selectedComponentId]
        : [];

    for (const id of ids) {
      this.canvasStore.removeComponent(id);
    }
    this.editorStore.deselectAll();
    this.clearHighlights();
    this.canvasManager.refreshConveyors();
    this.canvasManager.refreshComponents();
  }

  /** 顺时针旋转选中组件 90° */
  rotate90(): void {
    const ids = this.editorStore.isMultiSelect
      ? [...this.editorStore.selectedComponentIds]
      : this.editorStore.selectedComponentId
        ? [this.editorStore.selectedComponentId]
        : [];
    if (ids.length === 0) return;

    this.canvasStore.pushUndoSnapshot();

    for (const id of ids) {
      const c = this.canvasStore.conveyors[id];
      if (c) {
        const current = c.rotation;
        // 量化到最近 90° 倍数再 +90°
        const snapped = Math.round(current / (Math.PI / 2)) * (Math.PI / 2);
        this.updateComponent(id, { rotation: snapped + Math.PI / 2 });
      }
    }
    this.canvasManager.refreshConveyors();
  }

  /** 框选：选择矩形内的所有组件 */
  selectInRect(x1: number, y1: number, x2: number, y2: number): string[] {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);

    const hits: string[] = [];
    for (const c of this.canvasStore.conveyorList) {
      if (c.x >= minX && c.x <= maxX && c.y >= minY && c.y <= maxY) hits.push(c.id);
    }
    for (const t of this.canvasStore.transferList) {
      if (t.x >= minX && t.x <= maxX && t.y >= minY && t.y <= maxY) hits.push(t.id);
    }
    for (const f of this.canvasStore.forkliftList) {
      if (f.x >= minX && f.x <= maxX && f.y >= minY && f.y <= maxY) hits.push(f.id);
    }

    if (hits.length > 0) {
      this.editorStore.selectMultiple(hits);
    } else {
      this.editorStore.deselectAll();
    }
    this.highlightSelected();
    return hits;
  }

  private startSingleDrag(id: string, wx: number, wy: number): void {
    this.isDragging = true;
    this.dragStart = { x: wx, y: wy };
    const c = this.getComponentData(id);
    this.dragTargets = c ? [{ id, ...c }] : [];
  }

  private startMultiDrag(wx: number, wy: number): void {
    this.isDragging = true;
    this.dragStart = { x: wx, y: wy };
    this.dragTargets = [];
    for (const id of this.editorStore.selectedComponentIds) {
      const c = this.getComponentData(id);
      if (c) this.dragTargets.push({ id, ...c });
    }
  }

  private findHitStrict(wx: number, wy: number): { id: string; kind: string } {
    for (const t of [...this.canvasStore.transferList].reverse()) {
      if (this.hitTestRect(wx, wy, t.x, t.y, 50, 50, 0)) return { id: t.id, kind: 'transfer' };
    }
    for (const f of [...this.canvasStore.forkliftList].reverse()) {
      if (this.hitTestRect(wx, wy, f.x, f.y, 40, 30, 0)) return { id: f.id, kind: 'forklift' };
    }
    for (const c of [...this.canvasStore.conveyorList].reverse()) {
      if (this.hitTestRect(wx, wy, c.x, c.y, metersToPixels(c.length), metersToPixels(c.width), c.rotation)) return { id: c.id, kind: 'conveyor' };
    }
    return { id: '', kind: '' };
  }

  private hitTestRect(wx: number, wy: number, cx: number, cy: number, w: number, h: number, rotation: number): boolean {
    const dx = wx - cx;
    const dy = wy - cy;
    const c = Math.cos(-rotation);
    const s = Math.sin(-rotation);
    const lx = dx * c - dy * s;
    const ly = dx * s + dy * c;
    return Math.abs(lx) <= w / 2 && Math.abs(ly) <= h / 2;
  }

  private getComponentData(id: string): { x: number; y: number; rotation: number } | null {
    const c = this.canvasStore.conveyors[id];
    if (c) return { x: c.x, y: c.y, rotation: c.rotation };
    const t = this.canvasStore.transferMachines[id];
    if (t) return { x: t.x, y: t.y, rotation: 0 };
    const f = this.canvasStore.forklifts[id];
    if (f) return { x: f.x, y: f.y, rotation: 0 };
    return null;
  }

  private updateComponent(id: string, patch: { x?: number; y?: number; rotation?: number }): void {
    if (this.canvasStore.conveyors[id]) {
      this.canvasStore.updateConveyor(id, patch);
    } else if (this.canvasStore.transferMachines[id]) {
      this.canvasStore.updateTransfer(id, patch as any);
    } else if (this.canvasStore.forklifts[id]) {
      this.canvasStore.updateForklift(id, patch as any);
    }
  }

  private highlightSelected(): void {
    const ids = new Set(this.editorStore.selectedComponentIds);
    for (const c of this.canvasStore.conveyorList) {
      const g = this.canvasManager.conveyorLayer.getGraphic(c.id);
      if (g) g.setHighlight(ids.has(c.id));
    }
  }

  private clearHighlights(): void {
    for (const c of this.canvasStore.conveyorList) {
      const g = this.canvasManager.conveyorLayer.getGraphic(c.id);
      if (g) g.setHighlight(false);
    }
  }
}
