<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { CanvasManager } from '../../canvas/CanvasManager';
import { useCanvasStore } from '../../stores/canvasStore';
import { useEditorStore } from '../../stores/editorStore';
import { useSimulationStore } from '../../stores/simulationStore';
import { handleCanvasDrop } from '../../canvas/interactions/DragFromToolbar';
import { screenToWorld, computeComponentsBounds } from '../../utils/geometry';
import { saveDraft, loadDraft } from '../../utils/persistence';

const canvasHost = ref<HTMLDivElement>();
let canvasManager: CanvasManager | null = null;
const canvasStore = useCanvasStore();
const editorStore = useEditorStore();
const simStore = useSimulationStore();

/** 仿真运行时锁定编辑 */
const editingLocked = () => simStore.status !== 'idle' || simStore.multiRunTotal > 0;

// 视口拖拽
let isPanning = false;
let panStart = { x: 0, y: 0 };
let panViewStart = { x: 0, y: 0 };

function getWorldPos(e: MouseEvent): { x: number; y: number } {
  if (!canvasHost.value) return { x: 0, y: 0 };
  const rect = canvasHost.value.getBoundingClientRect();
  return screenToWorld(e.clientX, e.clientY, editorStore.viewport, rect);
}

// 框选状态
let isRubberBand = false;
let rubberStart = { x: 0, y: 0 };

function onMouseDown(e: MouseEvent): void {
  if (editingLocked() && e.button !== 1) return;
  if (e.button === 1) {
    e.preventDefault();
    startPan(e);
    return;
  }

  if (e.button === 0 && canvasManager) {
    const pos = getWorldPos(e);
    if (editorStore.activeTool === 'wire') {
      canvasManager.snap.startWire(pos.x, pos.y);
      return;
    }
    const connId = canvasManager.snap.hitTestConnection(pos.x, pos.y);
    if (connId) {
      editorStore.selectConnection(connId);
      return;
    }
    const hitId = canvasManager.selection.handleMouseDown(pos.x, pos.y);

    if (!hitId) {
      if (editorStore.shiftHeld) {
        // Shift + 空白 = 框选
        isRubberBand = true;
        rubberStart = pos;
      } else {
        startPan(e);
      }
    }
  }
}

function startPan(e: MouseEvent): void {
  isPanning = true;
  panStart = { x: e.clientX, y: e.clientY };
  panViewStart = { ...editorStore.viewport };
}

function onMouseMove(e: MouseEvent): void {
  if (isPanning) {
    const dx = e.clientX - panStart.x;
    const dy = e.clientY - panStart.y;
    editorStore.setViewport(panViewStart.x + dx, panViewStart.y + dy, editorStore.viewport.scale);
    canvasManager?.syncViewport();
    return;
  }

  const pos = getWorldPos(e);
  editorStore.setMouseWorldPos(pos.x, pos.y);

  if (isRubberBand && canvasManager) {
    canvasManager.showRubberBand(rubberStart.x, rubberStart.y, pos.x, pos.y);
    return;
  }

  if (canvasManager) {
    if (editorStore.activeTool === 'wire') {
      canvasManager.snap.updateWire(pos.x, pos.y);
    } else {
      canvasManager.selection.handleMouseMove(pos.x, pos.y);
    }
  }
}

function onMouseUp(_e: MouseEvent): void {
  if (isRubberBand && canvasManager) {
    isRubberBand = false;
    const pos = getWorldPos(_e);
    canvasManager.selection.selectInRect(rubberStart.x, rubberStart.y, pos.x, pos.y);
    canvasManager.hideRubberBand();
    return;
  }

  isPanning = false;

  if (canvasManager) {
    if (editorStore.activeTool === 'wire') {
      canvasStore.pushUndoSnapshot();
      const connId = canvasManager.snap.finishWire();
      if (connId) {
        canvasManager.refreshConveyors();
      }
    } else {
      canvasManager.selection.handleMouseUp();
    }
  }
}

function onWheel(e: WheelEvent): void {
  e.preventDefault();
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  const newScale = Math.max(0.1, Math.min(5, editorStore.viewport.scale * delta));
  editorStore.setViewport(editorStore.viewport.x, editorStore.viewport.y, newScale);
  canvasManager?.syncViewport();
}

function onDragOver(e: DragEvent): void {
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
}

function onDrop(e: DragEvent): void {
  e.preventDefault();
  if (editingLocked() || !canvasHost.value || !canvasManager) return;
  const rect = canvasHost.value.getBoundingClientRect();
  canvasStore.pushUndoSnapshot();
  const newId = handleCanvasDrop(e, rect, editorStore.viewport);
  if (newId) {
    canvasManager.snap.autoConnect(newId);
  }
  canvasManager.refreshConveyors();
  canvasManager.refreshComponents();
}

function zoomToFit(): void {
  const host = canvasHost.value;
  if (!host || !canvasManager) return;

  const bounds = computeComponentsBounds(
    canvasStore.conveyorList,
    canvasStore.transferList,
    canvasStore.forkliftList,
  );

  if (bounds.minX === Infinity) {
    editorStore.setViewport(0, 0, 1);
    canvasManager.syncViewport();
    return;
  }

  const PADDING = 60;
  const contentW = bounds.maxX - bounds.minX + PADDING * 2;
  const contentH = bounds.maxY - bounds.minY + PADDING * 2;
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const canvasW = host.clientWidth;
  const canvasH = host.clientHeight;

  const scaleX = canvasW / contentW;
  const scaleY = canvasH / contentH;
  const newScale = Math.max(0.1, Math.min(5, Math.min(scaleX, scaleY)));
  const newX = canvasW / 2 - centerX * newScale;
  const newY = canvasH / 2 - centerY * newScale;

  editorStore.setViewport(newX, newY, newScale);
  canvasManager.syncViewport();
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Shift') {
    editorStore.shiftHeld = true;
    return;
  }

  if (editingLocked()) {
    if (e.key === 'Escape') return;
    return;
  }

  // Ctrl+C / Cmd+C：复制选中组件
  if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
    if (editorStore.selectedComponentIds.length === 0) return;
    e.preventDefault();
    const entries: Array<{ type: 'conveyor' | 'transfer' | 'forklift'; data: Record<string, unknown> }> = [];
    for (const id of editorStore.selectedComponentIds) {
      const conv = canvasStore.getConveyorById(id);
      if (conv) {
        const { id: _id, ...rest } = conv;
        entries.push({ type: 'conveyor', data: rest as unknown as Record<string, unknown> });
        continue;
      }
      const trans = canvasStore.getTransferById(id);
      if (trans) {
        const { id: _id, ...rest } = trans;
        entries.push({ type: 'transfer', data: rest as unknown as Record<string, unknown> });
        continue;
      }
      const fork = canvasStore.getForkliftById(id);
      if (fork) {
        const { id: _id, ...rest } = fork;
        entries.push({ type: 'forklift', data: rest as unknown as Record<string, unknown> });
      }
    }
    if (entries.length > 0) {
      editorStore.copyToClipboard(entries);
    }
    return;
  }

  // Ctrl+V / Cmd+V：粘贴
  if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
    if (editorStore.clipboard.length === 0) return;
    e.preventDefault();
    canvasStore.pushUndoSnapshot();
    const newIds: string[] = [];
    const offsetX = 30;
    const offsetY = 30;
    for (const entry of editorStore.clipboard) {
      const data = JSON.parse(JSON.stringify(entry.data)) as Record<string, unknown>;
      data.x = (data.x as number) + offsetX;
      data.y = (data.y as number) + offsetY;
      let newId = '';
      switch (entry.type) {
        case 'conveyor': {
          newId = canvasStore.addConveyor(
            data.type as 'chain' | 'roller',
            data.x as number,
            data.y as number,
            data.rotation as number,
          );
          canvasStore.updateConveyor(newId, {
            length: data.length as number,
            width: data.width as number,
            speed: data.speed as number,
            direction: data.direction as 'forward' | 'bidirectional',
            zoneSpacing: data.zoneSpacing as number,
          });
          break;
        }
        case 'transfer': {
          newId = canvasStore.addTransferMachine(data.x as number, data.y as number);
          canvasStore.updateTransfer(newId, {
            actionTime: data.actionTime as number,
            routingTable: data.routingTable as Record<string, string>,
            defaultRoute: data.defaultRoute as string,
            rotatePallet: data.rotatePallet as boolean,
          });
          break;
        }
        case 'forklift': {
          newId = canvasStore.addForklift(data.x as number, data.y as number, data.role as 'generator' | 'consumer');
          canvasStore.updateForklift(newId, {
            interval: data.interval as number,
            fluctuation: data.fluctuation as number,
            destinationTag: data.destinationTag as string,
            palletSize: data.palletSize as { width: number; height: number },
          });
          break;
        }
      }
      if (newId) newIds.push(newId);
    }
    if (newIds.length > 0) {
      editorStore.selectMultiple(newIds);
      canvasManager?.refreshConveyors();
      canvasManager?.refreshComponents();
      canvasManager?.selection.highlightSelected();
    }
    return;
  }

  if (e.key === 'Delete' || e.key === 'Backspace') {
    canvasStore.pushUndoSnapshot();
    if (editorStore.selectedConnectionId) {
      canvasStore.removeConnection(editorStore.selectedConnectionId);
      editorStore.selectConnection(null);
      canvasManager?.refreshConveyors();
      return;
    }
    canvasManager?.selection.deleteSelected();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault();
    if (canvasStore.undo()) {
      editorStore.deselectAll();
      canvasManager?.refreshConveyors();
      canvasManager?.refreshComponents();
    }
    return;
  }
  if (e.key === 'r' || e.key === 'R') {
    e.preventDefault();
    canvasManager?.selection.rotate90();
    return;
  }
  if (e.key === 'Escape') {
    editorStore.setTool('select');
    editorStore.deselectAll();
    canvasManager?.refreshConveyors();
  }
}

function onKeyUp(e: KeyboardEvent): void {
  if (e.key === 'Shift') {
    editorStore.shiftHeld = false;
  }
}

onMounted(() => {
  if (!canvasHost.value) return;
  canvasManager = new CanvasManager(canvasHost.value);
  canvasManager.syncViewport();

  // 初始刷新
  canvasManager.refreshConveyors();
  canvasManager.refreshComponents();

  // 监听 Store 变更 → 刷新画布 + 自动保存草稿
  let draftTimer: ReturnType<typeof setTimeout>;
  watch(() => canvasStore.version, () => {
    canvasManager?.refreshConveyors();
    canvasManager?.refreshComponents();
    // 防抖 2s 保存草稿
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      saveDraft(canvasStore.toJSON());
    }, 2000);
  });

  // 检查未保存的草稿
  const draft = loadDraft();
  if (draft && draft.conveyors && draft.conveyors.length > 0) {
    canvasStore.loadFromJSON(draft);
    console.log('[Draft] 已恢复上次的草稿');
  }

  const host = canvasHost.value;
  host.addEventListener('mousedown', onMouseDown);
  host.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
});

onUnmounted(() => {
  canvasManager?.destroy();
  canvasManager = null;
  if (canvasHost.value) {
    canvasHost.value.removeEventListener('mousedown', onMouseDown);
    canvasHost.value.removeEventListener('wheel', onWheel);
  }
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseup', onMouseUp);
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('keyup', onKeyUp);
});
</script>

<template>
  <div ref="canvasHost" class="canvas-host" @dragover="onDragOver" @drop="onDrop">
    <button class="zoom-fit-btn" title="缩放至全部组件" @click.stop="zoomToFit">&#9744;</button>
  </div>
</template>

<style scoped>
.canvas-host {
  flex: 1;
  background: #0a0a1a;
  overflow: hidden;
  position: relative;
}

.zoom-fit-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 10;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid #0f3460;
  background: #1a1a2e;
  color: #e0e0e0;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
  line-height: 26px;
}

.zoom-fit-btn:hover {
  background: #0f3460;
}
</style>
