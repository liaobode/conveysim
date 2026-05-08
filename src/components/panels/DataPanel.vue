<script setup lang="ts">
import { computed, ref } from 'vue';
import { ChevronDown, ChevronUp } from 'lucide-vue-next';
import { useSimulationStore } from '../../stores/simulationStore';
import { useCanvasStore } from '../../stores/canvasStore';
import HeatmapLegend from './HeatmapLegend.vue';
import { downloadJSON, downloadCSV } from '../../utils/persistence';
import { convLabel as getLabel } from '../../utils/labels';

const simStore = useSimulationStore();
const canvasStore = useCanvasStore();

const convLabel = (id: string): string =>
  getLabel(id, canvasStore.conveyors, canvasStore.transferMachines, canvasStore.forklifts);

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

const panelCollapsed = ref(false);

// 分时段统计
const segmentChart = computed(() => {
  const segs = simStore.timeSegments;
  if (segs.length < 2) return null;
  const maxConsumed = Math.max(...segs.map((s) => s.consumedCount), 1);
  return segs.map((s) => ({
    label: `${Math.floor(s.startSec / 60)}:${String(s.startSec % 60).padStart(2, '0')}`,
    consumed: s.consumedCount,
    utilPct: Math.round(s.avgUtilization * 100),
    consumedH: Math.round((s.consumedCount / maxConsumed) * 100),
    utilH: Math.round(s.avgUtilization * 100),
  }));
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

function exportJSON(): void {
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

function exportCSV(): void {
  const lines: string[] = [];
  lines.push('类型,名称,数值');

  // 概览
  lines.push(`概览,仿真时间,${simStore.elapsedSimTime.toFixed(1)}s`);
  lines.push(`概览,吞吐量,${simStore.throughput.toFixed(1)} 托/时`);

  // 利用率
  for (const [id, util] of Object.entries(simStore.conveyorUtilization)) {
    lines.push(`利用率,${convLabel(id)},${(util * 100).toFixed(0)}%`);
  }

  // 停留时间
  for (const [id, stats] of Object.entries(simStore.dwellStats)) {
    lines.push(`平均停留,${convLabel(id)},${(stats.totalSec / stats.count).toFixed(1)}s`);
    lines.push(`最长停留,${convLabel(id)},${stats.maxSec.toFixed(1)}s`);
  }

  // 拥堵事件
  for (const evt of simStore.congestionEvents) {
    lines.push(`拥堵事件,${convLabel(evt.conveyorId)},${evt.startSec.toFixed(0)}s~${evt.endSec.toFixed(0)}s`);
  }

  downloadCSV(lines.join('\n'), `conveysim-report-${Date.now()}.csv`);
}
</script>

<template>
  <div class="data-panel">
    <div class="panel-title" @click="panelCollapsed = !panelCollapsed">
      仿真数据
      <ChevronUp v-if="!panelCollapsed" :size="14" />
      <ChevronDown v-else :size="14" />
    </div>

    <div v-show="!panelCollapsed">
    <div v-if="!hasData" class="placeholder">运行仿真后将在此处查看<br>吞吐量、利用率、停留时间等分析数据</div>

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

      <!-- 分时段统计 -->
      <div v-if="segmentChart && segmentChart.length >= 2" class="section">
        <div class="section-title">分时段统计</div>
        <!-- 吞吐量柱状图 -->
        <div class="seg-subtitle">吞吐量 (托/分钟)</div>
        <div class="seg-chart">
          <div v-for="(seg, i) in segmentChart" :key="'t'+i" class="seg-bar-wrap">
            <div class="seg-bar-label">{{ seg.consumed }}</div>
            <div
              class="seg-bar seg-bar-throughput"
              :style="{ height: seg.consumedH + '%' }"
            ></div>
            <div class="seg-time-label">{{ seg.label }}</div>
          </div>
        </div>
        <!-- 利用率柱状图 -->
        <div class="seg-subtitle">平均利用率 (%)</div>
        <div class="seg-chart">
          <div v-for="(seg, i) in segmentChart" :key="'u'+i" class="seg-bar-wrap">
            <div class="seg-bar-label">{{ seg.utilPct }}%</div>
            <div
              class="seg-bar seg-bar-util"
              :style="{ height: seg.utilH + '%' }"
              :class="{
                green: seg.utilPct < 50,
                yellow: seg.utilPct >= 50 && seg.utilPct < 85,
                red: seg.utilPct >= 85,
              }"
            ></div>
            <div class="seg-time-label">{{ seg.label }}</div>
          </div>
        </div>
      </div>
      <div v-else-if="simStore.elapsedSimTime >= 60 && simStore.timeSegments.length < 2" class="seg-waiting">
        仿真运行不足 2 分钟，待数据积累后显示趋势
      </div>

      <!-- 导出 -->
      <div class="export-btns">
        <button class="btn-export" @click="exportJSON">导出 JSON</button>
        <button class="btn-export" @click="exportCSV">导出 CSV</button>
      </div>
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
  color: var(--color-primary);
  text-transform: uppercase;
  letter-spacing: 1px;
  padding-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  user-select: none;
}

.panel-title:hover {
  opacity: 0.8;
}

.placeholder { color: var(--color-fg-dim); font-size: 13px; }

.stats { display: flex; flex-direction: column; gap: 6px; }

.bottleneck-banner {
  background: var(--color-bottleneck-bg);
  border: 1px solid var(--color-primary);
  border-radius: 4px;
  padding: 6px 8px;
  color: var(--color-primary);
  font-size: 13px;
  font-weight: 600;
  text-align: center;
}

.stat-row { display: flex; justify-content: space-between; font-size: 13px; }
.stat-label { color: var(--color-fg-muted); }
.stat-value { color: var(--color-fg-primary); font-weight: 600; }

.section { margin-top: 4px; }
.section-title {
  font-size: 11px;
  color: var(--color-fg-muted);
  padding-bottom: 4px;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 4px;
}

.dwell-row {
  display: flex;
  font-size: 12px;
  padding: 2px 0;
  gap: 4px;
}
.dwell-label { color: var(--color-fg-secondary); flex: 1; }
.dwell-val { color: var(--color-fg-primary); }
.dwell-max { color: var(--color-fg-dim); font-size: 11px; }

.event-row {
  display: flex;
  font-size: 11px;
  padding: 1px 0;
  gap: 4px;
}
.event-label { color: var(--color-warning); flex: 1; }
.event-time { color: var(--color-fg-muted); }
.event-dur { color: var(--color-primary); }

.util-row { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.util-label { color: var(--color-fg-secondary); min-width: 70px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.util-label.bottleneck { color: var(--color-primary); font-weight: 600; }
.util-bar-bg { flex: 1; height: 8px; background: var(--color-bg-base); border-radius: 4px; overflow: hidden; }
.util-bar-fill { height: 100%; border-radius: 4px; transition: width 0.5s; }
.util-bar-fill.green { background: var(--color-green); }
.util-bar-fill.yellow { background: var(--color-warning); }
.util-bar-fill.red { background: var(--color-primary); }
.util-pct { color: var(--color-fg-muted); min-width: 30px; text-align: right; }

.export-btns {
  display: flex;
  gap: 6px;
  margin-top: 12px;
}

.btn-export {
  flex: 1;
  padding: 6px;
  background: var(--color-btn-confirm-bg);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-fg-primary);
  font-size: 12px;
  cursor: pointer;
}
.stat-value.green { color: var(--color-green); }
.stat-value.red { color: var(--color-primary); }
.btn-export:hover { background: var(--color-btn-confirm-hover); }

/* 分时段统计柱状图 */
.seg-subtitle {
  font-size: 10px;
  color: var(--color-fg-muted);
  margin: 8px 0 4px;
}

.seg-chart {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 80px;
  padding: 4px 0;
  border-bottom: 1px solid var(--color-border);
}

.seg-bar-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  justify-content: flex-end;
  min-width: 0;
}

.seg-bar-label {
  font-size: 9px;
  color: var(--color-fg-dim);
  font-family: var(--font-mono);
  line-height: 1;
  margin-bottom: 2px;
}

.seg-bar {
  width: 100%;
  max-width: 24px;
  min-height: 2px;
  border-radius: 2px 2px 0 0;
  transition: height 0.3s ease;
}

.seg-bar-throughput {
  background: var(--color-success);
}

.seg-bar-util {
  background: var(--color-warning);
}

.seg-bar-util.green { background: var(--color-success); }
.seg-bar-util.yellow { background: var(--color-warning); }
.seg-bar-util.red { background: var(--color-primary); }

.seg-time-label {
  font-size: 8px;
  color: var(--color-fg-dim);
  font-family: var(--font-mono);
  margin-top: 3px;
  white-space: nowrap;
}

.seg-waiting {
  font-size: 12px;
  color: var(--color-fg-dim);
  padding: 12px 0;
}
</style>
