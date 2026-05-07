<script setup lang="ts">
import { computed } from 'vue';
import { useSimulationStore } from '../../stores/simulationStore';
import { useCanvasStore } from '../../stores/canvasStore';
import HeatmapLegend from './HeatmapLegend.vue';
import { downloadJSON } from '../../utils/persistence';

const simStore = useSimulationStore();
const canvasStore = useCanvasStore();

const convLabel = (id: string): string => {
  const c = canvasStore.conveyors[id];
  return c ? `${c.type === 'chain' ? '链条' : '滚筒'} ${id.slice(-4)}` : id;
};

const simTimeFormatted = computed(() => {
  const t = simStore.elapsedSimTime;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
});

const utilizationList = computed(() => {
  const rows: { id: string; label: string; util: number }[] = [];
  for (const [id, util] of Object.entries(simStore.conveyorUtilization)) {
    rows.push({ id, label: convLabel(id), util });
  }
  rows.sort((a, b) => b.util - a.util);
  return rows;
});

const dwellList = computed(() => {
  const rows: { id: string; label: string; avgSec: number; maxSec: number }[] = [];
  for (const [id, stats] of Object.entries(simStore.dwellStats)) {
    rows.push({
      id,
      label: convLabel(id),
      avgSec: stats.count > 0 ? stats.totalSec / stats.count : 0,
      maxSec: stats.maxSec,
    });
  }
  rows.sort((a, b) => b.avgSec - a.avgSec);
  return rows;
});

const bottleneckLabel = computed(() => {
  if (!simStore.bottleneckId) return '';
  return convLabel(simStore.bottleneckId);
});

const hasData = computed(() =>
  simStore.status === 'running' ||
  simStore.status === 'paused' ||
  simStore.elapsedSimTime > 0 ||
  simStore.multiRunResults.length > 0,
);

const multiRunSummary = computed(() => {
  const results = simStore.multiRunResults;
  if (results.length === 0) return null;
  const tps = results.map(r => r.throughput);
  const avg = tps.reduce((a, b) => a + b, 0) / tps.length;
  const min = Math.min(...tps);
  const max = Math.max(...tps);
  return { avg, min, max };
});

function exportReport(): void {
  const report = {
    simTime: simStore.elapsedSimTime,
    throughput: simStore.throughput,
    utilization: simStore.conveyorUtilization,
    dwellStats: simStore.dwellStats,
    congestionEvents: simStore.congestionEvents,
    bottleneckId: simStore.bottleneckId,
  };
  downloadJSON(report as any, `conveysim-report-${Date.now()}.json`);
}
</script>

<template>
  <div class="data-panel">
    <div class="panel-title">仿真数据</div>

    <div v-if="!hasData" class="placeholder">运行仿真以查看数据</div>

    <div v-else class="stats">
      <!-- 瓶颈提示 -->
      <div v-if="simStore.bottleneckId" class="bottleneck-banner">
        ⚠ 瓶颈: {{ bottleneckLabel }}
      </div>

      <!-- 基础指标 -->
      <div class="stat-row">
        <span class="stat-label">仿真时间</span>
        <span class="stat-value">{{ simTimeFormatted }}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">吞吐量</span>
        <span class="stat-value">{{ simStore.throughput.toFixed(1) }} 托/时</span>
      </div>

      <HeatmapLegend />

      <!-- 停留时间 -->
      <div v-if="dwellList.length > 0" class="section">
        <div class="section-title">平均停留时间</div>
        <div v-for="row in dwellList" :key="row.id" class="dwell-row">
          <span class="dwell-label">{{ row.label }}</span>
          <span class="dwell-val">{{ row.avgSec.toFixed(1) }}s</span>
          <span class="dwell-max">最长 {{ row.maxSec.toFixed(1) }}s</span>
        </div>
      </div>

      <!-- 拥堵事件 -->
      <div v-if="simStore.congestionEvents.length > 0" class="section">
        <div class="section-title">拥堵事件 ({{ simStore.congestionEvents.length }})</div>
        <div
          v-for="(evt, i) in simStore.congestionEvents.slice(-5)"
          :key="i"
          class="event-row"
        >
          <span class="event-label">{{ convLabel(evt.conveyorId) }}</span>
          <span class="event-time">{{ evt.startSec.toFixed(0) }}s ~ {{ evt.endSec.toFixed(0) }}s</span>
          <span class="event-dur">{{ (evt.endSec - evt.startSec).toFixed(0) }}s</span>
        </div>
      </div>

      <!-- 批量运行结果 -->
      <div v-if="multiRunSummary" class="section">
        <div class="section-title">批量运行 ({{ simStore.multiRunResults.length }} 次)</div>
        <div class="stat-row">
          <span class="stat-label">平均吞吐量</span>
          <span class="stat-value">{{ multiRunSummary.avg.toFixed(1) }} 托/时</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">最高</span>
          <span class="stat-value green">{{ multiRunSummary.max.toFixed(1) }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">最低</span>
          <span class="stat-value red">{{ multiRunSummary.min.toFixed(1) }}</span>
        </div>
      </div>

      <!-- 利用率 -->
      <div class="section">
        <div class="section-title">设备利用率</div>
        <div v-for="row in utilizationList" :key="row.id" class="util-row">
          <span class="util-label" :class="{ bottleneck: row.id === simStore.bottleneckId }">{{ row.label }}</span>
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

      <!-- 导出 -->
      <button class="btn-export" @click="exportReport">导出报告</button>
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

.placeholder { color: #666; font-size: 13px; }

.stats { display: flex; flex-direction: column; gap: 6px; }

.bottleneck-banner {
  background: #4a1020;
  border: 1px solid #e94560;
  border-radius: 4px;
  padding: 6px 8px;
  color: #e94560;
  font-size: 13px;
  font-weight: 600;
  text-align: center;
}

.stat-row { display: flex; justify-content: space-between; font-size: 13px; }
.stat-label { color: #888; }
.stat-value { color: #e0e0e0; font-weight: 600; }

.section { margin-top: 4px; }
.section-title {
  font-size: 11px;
  color: #888;
  padding-bottom: 4px;
  border-bottom: 1px solid #0f3460;
  margin-bottom: 4px;
}

.dwell-row {
  display: flex;
  font-size: 12px;
  padding: 2px 0;
  gap: 4px;
}
.dwell-label { color: #aaa; flex: 1; }
.dwell-val { color: #e0e0e0; }
.dwell-max { color: #666; font-size: 11px; }

.event-row {
  display: flex;
  font-size: 11px;
  padding: 1px 0;
  gap: 4px;
}
.event-label { color: #e9a820; flex: 1; }
.event-time { color: #888; }
.event-dur { color: #e94560; }

.util-row { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.util-label { color: #aaa; min-width: 70px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.util-label.bottleneck { color: #e94560; font-weight: 600; }
.util-bar-bg { flex: 1; height: 8px; background: #1a1a2e; border-radius: 4px; overflow: hidden; }
.util-bar-fill { height: 100%; border-radius: 4px; transition: width 0.5s; }
.util-bar-fill.green { background: #00c850; }
.util-bar-fill.yellow { background: #e9a820; }
.util-bar-fill.red { background: #e94560; }
.util-pct { color: #888; min-width: 30px; text-align: right; }

.btn-export {
  margin-top: 12px;
  width: 100%;
  padding: 6px;
  background: #1a3a5a;
  border: 1px solid #0f3460;
  border-radius: 4px;
  color: #e0e0e0;
  font-size: 12px;
  cursor: pointer;
}
.stat-value.green { color: #00c850; }
.stat-value.red { color: #e94560; }
.btn-export:hover { background: #2a4a6a; }
</style>
