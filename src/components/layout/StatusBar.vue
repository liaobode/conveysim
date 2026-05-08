<script setup lang="ts">
import { computed } from 'vue';
import { useSimulationStore } from '../../stores/simulationStore';
import { useEditorStore } from '../../stores/editorStore';
import { useCanvasStore } from '../../stores/canvasStore';
import { pixelsToMeters } from '../../utils/geometry';

const simStore = useSimulationStore();
const editorStore = useEditorStore();
const canvasStore = useCanvasStore();

const statusText = computed(() => {
  if (simStore.multiRunTotal > 0) {
    return `批量运行: ${simStore.multiRunCurrent}/${simStore.multiRunTotal}`;
  }
  switch (simStore.status) {
    case 'idle': return `就绪 — ${compCount.value} 个组件`;
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

const simTimeFormatted = computed(() => {
  const t = simStore.elapsedSimTime;
  if (t <= 0) return '';
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  if (h > 0) return `仿真: ${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `仿真: ${m}:${s.toString().padStart(2, '0')}`;
});

const batchProgress = computed(() => {
  if (simStore.multiRunTotal <= 0) return 0;
  return (simStore.multiRunCurrent / simStore.multiRunTotal) * 100;
});

const isBatching = computed(() => simStore.multiRunTotal > 0);

const compCount = computed(() => {
  return canvasStore.conveyorList.length + canvasStore.transferList.length + canvasStore.forkliftList.length;
});

const mousePos = computed(() => {
  const p = editorStore.mouseWorldPos;
  return `X: ${pixelsToMeters(p.x).toFixed(1)}m  Y: ${pixelsToMeters(p.y).toFixed(1)}m`;
});
</script>

<template>
  <footer class="status-bar" :class="statusClass" role="contentinfo" aria-label="状态栏">
    <span class="status-text">{{ statusText }}</span>
    <div v-if="isBatching" class="batch-bar-wrap">
      <div class="batch-bar-fill" :style="{ width: batchProgress + '%' }"></div>
    </div>
    <span v-if="simTimeFormatted" class="sim-time">{{ simTimeFormatted }}</span>
    <span class="mouse-pos">{{ mousePos }}</span>
  </footer>
</template>

<style scoped>
.status-bar {
  height: 24px;
  background: var(--color-bg-surface);
  border-top: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  font-size: 12px;
  color: var(--color-fg-dim);
  flex-shrink: 0;
}

.status-bar.running {
  background: var(--color-status-running-bg);
  border-top-color: var(--color-status-running-border);
  color: var(--color-success);
}

.status-bar.paused {
  background: var(--color-status-paused-bg);
  border-top-color: var(--color-status-paused-border);
  color: var(--color-warning);
}

.sim-time {
  font-family: var(--font-mono);
  font-size: 11px;
  opacity: 0.8;
}

.batch-bar-wrap {
  flex: 1;
  max-width: 120px;
  height: 6px;
  background: var(--color-bg-base);
  border-radius: 3px;
  overflow: hidden;
  margin: 0 8px;
}

.batch-bar-fill {
  height: 100%;
  background: var(--color-warning);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.mouse-pos {
  color: var(--color-fg-dark);
  font-family: var(--font-mono);
  font-size: 11px;
}
</style>
