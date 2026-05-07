<script setup lang="ts">
import { computed } from 'vue';
import { useSimulationStore } from '../../stores/simulationStore';
import { useEditorStore } from '../../stores/editorStore';
import { pixelsToMeters } from '../../utils/geometry';

const simStore = useSimulationStore();
const editorStore = useEditorStore();

const statusText = computed(() => {
  if (simStore.multiRunTotal > 0) {
    return `批量运行: ${simStore.multiRunCurrent}/${simStore.multiRunTotal}`;
  }
  switch (simStore.status) {
    case 'idle': return '就绪';
    case 'running': return `运行中 — Tick: ${simStore.tickCount} — 托盘: ${Object.keys(simStore.palletStates).length}`;
    case 'paused': return '已暂停';
  }
});

const statusClass = computed(() => {
  switch (simStore.status) {
    case 'idle': return '';
    case 'running': return 'running';
    case 'paused': return 'paused';
  }
});

const mousePos = computed(() => {
  const p = editorStore.mouseWorldPos;
  return `X: ${pixelsToMeters(p.x).toFixed(1)}m  Y: ${pixelsToMeters(p.y).toFixed(1)}m`;
});
</script>

<template>
  <footer class="status-bar" :class="statusClass">
    <span class="status-text">{{ statusText }}</span>
    <span class="mouse-pos">{{ mousePos }}</span>
  </footer>
</template>

<style scoped>
.status-bar {
  height: 24px;
  background: #16213e;
  border-top: 1px solid #0f3460;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  font-size: 12px;
  color: #666;
  flex-shrink: 0;
}

.status-bar.running {
  background: #1a2a1a;
  border-top-color: #2a4a2a;
  color: #4ae04a;
}

.status-bar.paused {
  background: #2a2a1a;
  border-top-color: #4a4a2a;
  color: #e9a820;
}

.mouse-pos {
  color: #555;
  font-family: monospace;
  font-size: 11px;
}
</style>
