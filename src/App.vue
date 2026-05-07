<script setup lang="ts">
import { ref } from 'vue';
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
</script>

<template>
  <div class="app-layout">
    <AppHeader />
    <div class="app-body">
      <Toolbar ref="toolbarRef" />
      <CanvasContainer />
      <aside class="right-panel" role="complementary" aria-label="属性和数据面板">
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

.right-panel {
  width: 240px;
  background: var(--color-bg-surface);
  border-left: 1px solid var(--color-border);
  flex-shrink: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
</style>
