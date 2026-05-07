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
import StatusBar from './components/layout/StatusBar.vue';

const uiStore = useUIStore();
const toolbarRef = ref<InstanceType<typeof Toolbar>>();

function onSaveClose(): void {
  uiStore.closeSaveDialog();
  toolbarRef.value?.refreshScenes();
}
</script>

<template>
  <div class="app-layout">
    <AppHeader />
    <div class="app-body">
      <Toolbar ref="toolbarRef" />
      <CanvasContainer />
      <aside class="right-panel">
        <PropertyPanel />
        <DataPanel />
      </aside>
    </div>
    <StatusBar />
    <SaveDialog v-if="uiStore.saveDialogVisible" @close="onSaveClose" />
    <LoadDialog v-if="uiStore.loadDialogVisible" @close="uiStore.closeLoadDialog()" />
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
  background: #16213e;
  border-left: 1px solid #0f3460;
  flex-shrink: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
</style>
