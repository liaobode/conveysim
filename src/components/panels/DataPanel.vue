<script setup lang="ts">
import { computed } from 'vue';
import { useSimulationStore } from '../../stores/simulationStore';
import { useCanvasStore } from '../../stores/canvasStore';
import HeatmapLegend from './HeatmapLegend.vue';

const simStore = useSimulationStore();
const canvasStore = useCanvasStore();

const utilizationList = computed(() => {
  const rows: { id: string; label: string; util: number }[] = [];
  for (const [id, util] of Object.entries(simStore.conveyorUtilization)) {
    const conv = canvasStore.conveyors[id];
    const label = conv
      ? `${conv.type === 'chain' ? '链条机' : '滚筒机'} ${id.slice(-4)}`
      : id;
    rows.push({ id, label, util });
  }
  rows.sort((a, b) => b.util - a.util);
  return rows;
});

const simTimeFormatted = computed(() => {
  const t = simStore.elapsedSimTime;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
});
</script>

<template>
  <div class="data-panel">
    <div class="panel-title">仿真数据</div>

    <div v-if="simStore.status === 'idle'" class="placeholder">运行仿真以查看数据</div>

    <div v-else class="stats">
      <div class="stat-row">
        <span class="stat-label">仿真时间</span>
        <span class="stat-value">{{ simTimeFormatted }}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">吞吐量</span>
        <span class="stat-value">{{ simStore.throughput.toFixed(1) }} 托/时</span>
      </div>

      <HeatmapLegend />

      <div class="section-title">设备利用率</div>
      <div
        v-for="row in utilizationList"
        :key="row.id"
        class="util-row"
      >
        <span class="util-label">{{ row.label }}</span>
        <div class="util-bar-bg">
          <div
            class="util-bar-fill"
            :style="{ width: (row.util * 100) + '%' }"
            :class="{
              green: row.util < 0.5,
              yellow: row.util >= 0.5 && row.util < 0.85,
              red: row.util >= 0.85,
            }"
          ></div>
        </div>
        <span class="util-pct">{{ (row.util * 100).toFixed(0) }}%</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.data-panel {
  padding: 8px 0;
}

.panel-title {
  font-weight: 600;
  font-size: 12px;
  color: #e94560;
  text-transform: uppercase;
  letter-spacing: 1px;
  padding-bottom: 8px;
}

.placeholder {
  color: #666;
  font-size: 13px;
}

.stats {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}

.stat-label {
  color: #888;
}

.stat-value {
  color: #e0e0e0;
  font-weight: 600;
}

.section-title {
  font-size: 11px;
  color: #888;
  margin-top: 12px;
  padding-bottom: 4px;
  border-bottom: 1px solid #0f3460;
}

.util-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.util-label {
  color: #aaa;
  min-width: 70px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.util-bar-bg {
  flex: 1;
  height: 8px;
  background: #1a1a2e;
  border-radius: 4px;
  overflow: hidden;
}

.util-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.5s;
}

.util-bar-fill.green { background: #00c850; }
.util-bar-fill.yellow { background: #e9a820; }
.util-bar-fill.red { background: #e94560; }

.util-pct {
  color: #888;
  min-width: 30px;
  text-align: right;
}
</style>
