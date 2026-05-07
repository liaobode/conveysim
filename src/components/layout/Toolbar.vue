<script setup lang="ts">
import { useEditorStore } from '../../stores/editorStore';
import type { ToolType } from '../../stores/editorStore';

const editorStore = useEditorStore();

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
    >
      选择 / 移动
    </div>
    <div
      class="tool-item action"
      :class="{ active: editorStore.activeTool === 'wire' }"
      @click="editorStore.setTool('wire')"
    >
      连线
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
  padding: 8px 10px;
  background: #1a1a2e;
  border: 1px solid #0f3460;
  border-radius: 4px;
  font-size: 13px;
  cursor: grab;
  user-select: none;
}

.tool-item.action {
  cursor: pointer;
}

.tool-item:hover {
  background: #0f3460;
}

.tool-item.active {
  border-color: #e94560;
  background: #1e1e3e;
}
</style>
