<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { CanvasManager } from '../../canvas/CanvasManager';
import { useCanvasStore } from '../../stores/canvasStore';
import { useEditorStore } from '../../stores/editorStore';
import { useSimulationStore } from '../../stores/simulationStore';
import { handleCanvasDrop } from '../../canvas/interactions/DragFromToolbar';
import { screenToWorld } from '../../utils/geometry';
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

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Shift') {
    editorStore.shiftHeld = true;
    return;
  }

  if (editingLocked()) {
    if (e.key === 'Escape') return;
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
  <div ref="canvasHost" class="canvas-host" @dragover="onDragOver" @drop="onDrop"></div>
</template>

<style scoped>
.canvas-host {
  flex: 1;
  background: #0a0a1a;
  overflow: hidden;
  position: relative;
}
</style>
