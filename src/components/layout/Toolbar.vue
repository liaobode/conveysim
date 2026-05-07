<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useEditorStore } from '../../stores/editorStore';
import { useCanvasStore } from '../../stores/canvasStore';
import type { ToolType } from '../../stores/editorStore';
import { listScenes, loadScene, deleteScene } from '../../utils/persistence';

const editorStore = useEditorStore();
const canvasStore = useCanvasStore();
const scenes = ref<{ name: string; savedAt: number }[]>([]);

const compTools: { type: ToolType; label: string }[] = [
  { type: 'chain-conveyor', label: '链条输送机' },
  { type: 'roller-conveyor', label: '滚筒输送机' },
  { type: 'transfer-machine', label: '移载机' },
  { type: 'forklift-generator', label: '叉车(上料)' },
  { type: 'forklift-consumer', label: '叉车(下料)' },
];

function onDragStart(e: DragEvent, toolType: ToolType): void {
  e.dataTransfer?.setData('application/conveysim-component', toolType);
  e.dataTransfer!.effectAllowed = 'copy';
  editorStore.setTool(toolType);
}

function refreshScenes(): void {
  scenes.value = listScenes().map(s => ({ name: s.name, savedAt: s.savedAt }));
}

function handleLoad(name: string): void {
  const data = loadScene(name);
  if (data) {
    canvasStore.pushUndoSnapshot();
    canvasStore.loadFromJSON(data);
  }
}

function handleDelete(name: string): void {
  deleteScene(name);
  refreshScenes();
}

onMounted(refreshScenes);

defineExpose({ refreshScenes });
</script>

<template>
  <aside class="toolbar">
    <div class="toolbar-title">组件</div>
    <div
      v-for="tool in compTools"
      :key="tool.type"
      class="tool-item"
      :class="{ active: editorStore.activeTool === tool.type }"
      draggable="true"
      @dragstart="onDragStart($event, tool.type)"
      @click="editorStore.setTool(tool.type)"
    >
      {{ tool.label }}
    </div>

    <div class="toolbar-divider"></div>

    <div class="toolbar-title">工具</div>
    <div
      class="tool-item action"
      :class="{ active: editorStore.activeTool === 'select' }"
      @click="editorStore.setTool('select')"
    >选择 / 移动</div>
    <div
      class="tool-item action"
      :class="{ active: editorStore.activeTool === 'wire' }"
      @click="editorStore.setTool('wire')"
    >连线</div>

    <div class="toolbar-divider"></div>

    <div class="toolbar-title">场景库</div>
    <div v-if="scenes.length === 0" class="no-scenes">暂无保存的场景</div>
    <div v-for="s in scenes" :key="s.name" class="scene-item">
      <span class="scene-name" @click="handleLoad(s.name)" :title="'加载 ' + s.name">{{ s.name }}</span>
      <button class="scene-del" @click="handleDelete(s.name)" title="删除">x</button>
    </div>
  </aside>
</template>

<style scoped>
.toolbar {
  width: 140px;
  background: #16213e;
  border-right: 1px solid #0f3460;
  flex-shrink: 0;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
}

.toolbar-title {
  font-weight: 600;
  font-size: 12px;
  color: #e94560;
  text-transform: uppercase;
  letter-spacing: 1px;
  padding: 4px 0 8px;
}

.toolbar-divider {
  height: 1px;
  background: #0f3460;
  margin: 4px 0;
}

.tool-item {
  padding: 6px 8px;
  background: #1a1a2e;
  border: 1px solid #0f3460;
  border-radius: 4px;
  font-size: 12px;
  cursor: grab;
  user-select: none;
}
.tool-item.action { cursor: pointer; }
.tool-item:hover { background: #0f3460; }
.tool-item.active { border-color: #e94560; background: #1e1e3e; }

.no-scenes { font-size: 11px; color: #444; padding: 4px 0; }

.scene-item {
  display: flex;
  align-items: center;
  padding: 4px 6px;
  background: #1a1a2e;
  border: 1px solid transparent;
  border-radius: 4px;
  font-size: 12px;
}
.scene-item:hover { border-color: #0f3460; }
.scene-name { flex: 1; color: #aaa; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.scene-name:hover { color: #e0e0e0; }
.scene-del { background: none; border: none; color: #666; font-size: 14px; cursor: pointer; padding: 0 2px; }
.scene-del:hover { color: #e94560; }
</style>
