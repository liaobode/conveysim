<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useUIStore } from './stores/uiStore';
import AppHeader from './components/layout/AppHeader.vue';
import Toolbar from './components/layout/Toolbar.vue';
import CanvasContainer from './components/canvas/CanvasContainer.vue';
import PropertyPanel from './components/panels/PropertyPanel.vue';
import DataPanel from './components/panels/DataPanel.vue';
import SaveDialog from './components/dialogs/SaveDialog.vue';
import LoadDialog from './components/dialogs/LoadDialog.vue';
import BatchDialog from './components/dialogs/BatchDialog.vue';
import ShortcutPanel from './components/dialogs/ShortcutPanel.vue';
import StatusBar from './components/layout/StatusBar.vue';
import SimToast from './components/layout/SimToast.vue';

import { useCanvasStore } from './stores/canvasStore';
import { useSimulationStore } from './stores/simulationStore';

const uiStore = useUIStore();
const canvasStore = useCanvasStore();
const simStore = useSimulationStore();
const toolbarRef = ref<InstanceType<typeof Toolbar>>();

function onSaveClose(): void {
  uiStore.closeSaveDialog();
  toolbarRef.value?.refreshScenes();
}

function onBatchStart(rounds: number, timePerRound: number): void {
  const scene = canvasStore.toJSON();
  simStore.runBatch(scene, rounds, timePerRound);
}

const hasComponents = computed(() =>
  canvasStore.conveyorList.length > 0 ||
  canvasStore.transferList.length > 0 ||
  canvasStore.forkliftList.length > 0,
);

function onBeforeUnload(e: BeforeUnloadEvent): void {
  if (hasComponents.value) {
    e.preventDefault();
    e.returnValue = '';
  }
}

onMounted(() => {
  window.addEventListener('beforeunload', onBeforeUnload);
});

onUnmounted(() => {
  window.removeEventListener('beforeunload', onBeforeUnload);
});

// 可拖拽面板宽度
const toolbarWidth = ref(140);
const rightPanelWidth = ref(240);
let dragTarget: 'toolbar' | 'right' | null = null;

function onDividerDown(target: 'toolbar' | 'right', e: MouseEvent): void {
  dragTarget = target;
  e.preventDefault();
}

function onMouseMove(e: MouseEvent): void {
  if (!dragTarget) return;
  if (dragTarget === 'toolbar') {
    toolbarWidth.value = Math.max(100, Math.min(300, e.clientX));
  } else {
    rightPanelWidth.value = Math.max(180, Math.min(480, window.innerWidth - e.clientX));
  }
}

function onMouseUp(): void {
  dragTarget = null;
}

onMounted(() => {
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
});

onUnmounted(() => {
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseup', onMouseUp);
});
</script>

<template>
  <div class="app-layout">
    <AppHeader />
    <div class="app-body">
      <Toolbar ref="toolbarRef" :style="{ width: toolbarWidth + 'px' }" />
      <div class="divider" @mousedown="onDividerDown('toolbar', $event)"></div>
      <CanvasContainer />
      <div class="divider" @mousedown="onDividerDown('right', $event)"></div>
      <aside class="right-panel" role="complementary" aria-label="属性和数据面板" :style="{ width: rightPanelWidth + 'px' }">
        <PropertyPanel />
        <DataPanel />
      </aside>
    </div>
    <StatusBar />
    <Transition name="dialog">
      <SaveDialog v-if="uiStore.saveDialogVisible" @close="onSaveClose" />
    </Transition>
    <Transition name="dialog">
      <LoadDialog v-if="uiStore.loadDialogVisible" @close="uiStore.closeLoadDialog()" />
    </Transition>
    <Transition name="dialog">
      <BatchDialog v-if="uiStore.batchDialogVisible" @close="uiStore.closeBatchDialog()" @start="onBatchStart" />
    </Transition>
    <Transition name="dialog">
      <ShortcutPanel v-if="uiStore.shortcutPanelVisible" @close="uiStore.shortcutPanelVisible = false" />
    </Transition>
    <SimToast />
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.app-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.divider {
  width: 4px;
  flex-shrink: 0;
  cursor: col-resize;
  background: transparent;
  transition: background 0.15s;
}

.divider:hover {
  background: var(--color-border);
}

.right-panel {
  background: var(--color-bg-surface);
  border-left: 1px solid var(--color-border);
  flex-shrink: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
</style>
