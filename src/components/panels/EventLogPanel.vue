<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-vue-next';
import { useSimulationStore } from '../../stores/simulationStore';
import { useCanvasStore } from '../../stores/canvasStore';
import { convLabel } from '../../utils/labels';
import type { SimulationEventType } from '../../types';

const simStore = useSimulationStore();
const canvasStore = useCanvasStore();

const panelCollapsed = ref(false);
const scrollContainer = ref<HTMLDivElement>();
const enabledTypes = ref<Set<SimulationEventType>>(
  new Set(['PALLET_GENERATED', 'PALLET_CONSUMED', 'PALLET_BLOCKED', 'TRANSFER_COMPLETE', 'CAPACITY_REJECTED', 'ERROR']),
);

const ALL_EVENT_TYPES: { type: SimulationEventType; label: string; cssVar: string }[] = [
  { type: 'PALLET_GENERATED', label: '生成', cssVar: '--color-success' },
  { type: 'PALLET_CONSUMED', label: '消耗', cssVar: '--color-primary' },
  { type: 'PALLET_BLOCKED', label: '阻塞', cssVar: '--color-warning' },
  { type: 'TRANSFER_COMPLETE', label: '移载完成', cssVar: '--color-info' },
  { type: 'CAPACITY_REJECTED', label: '拒收', cssVar: '--color-warning' },
  { type: 'ERROR', label: '错误', cssVar: '--color-destructive' },
];

function toggleType(type: SimulationEventType): void {
  if (enabledTypes.value.has(type)) {
    enabledTypes.value.delete(type);
  } else {
    enabledTypes.value.add(type);
  }
  enabledTypes.value = new Set(enabledTypes.value);
}

const filteredEvents = computed(() =>
  simStore.eventLog.filter((e) => enabledTypes.value.has(e.eventType)),
);

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function badgeAbbr(type: SimulationEventType): string {
  const map: Record<string, string> = {
    PALLET_GENERATED: 'GEN',
    PALLET_CONSUMED: 'CON',
    PALLET_BLOCKED: 'BLK',
    TRANSFER_START: 'TRS',
    TRANSFER_COMPLETE: 'TRF',
    CAPACITY_REJECTED: 'REJ',
    ERROR: 'ERR',
  };
  return map[type] || type;
}

function label(id: string): string {
  return convLabel(id, canvasStore.conveyors, canvasStore.transferMachines, canvasStore.forklifts);
}

// 新事件到达时自动滚动到底部（仅在用户未手动上翻时）
watch(
  () => filteredEvents.value.length,
  () => {
    nextTick(() => {
      const el = scrollContainer.value;
      if (!el) return;
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      if (nearBottom) {
        el.scrollTop = el.scrollHeight;
      }
    });
  },
);
</script>

<template>
  <div class="event-log-panel">
    <div class="panel-title" @click="panelCollapsed = !panelCollapsed">
      事件日志 ({{ simStore.eventLog.length }})
      <ChevronUp v-if="!panelCollapsed" :size="14" />
      <ChevronDown v-else :size="14" />
    </div>

    <div v-show="!panelCollapsed">
      <div v-if="simStore.eventLog.length === 0" class="placeholder">
        运行仿真后将在此查看事件日志
      </div>

      <template v-else>
        <div class="filter-bar">
          <button
            v-for="item in ALL_EVENT_TYPES"
            :key="item.type"
            class="filter-pill"
            :class="{ active: enabledTypes.has(item.type) }"
            :style="enabledTypes.has(item.type) ? { '--pill-color': `var(${item.cssVar})` } : {}"
            @click="toggleType(item.type)"
          >
            {{ item.label }}
          </button>
        </div>

        <div ref="scrollContainer" class="event-list">
          <div v-if="filteredEvents.length === 0" class="no-match">
            无匹配事件
          </div>
          <div
            v-for="(evt, i) in filteredEvents"
            :key="i"
            class="event-row"
          >
            <span class="event-time">{{ formatTime(evt.simTime) }}</span>
            <span
              class="event-badge"
              :data-type="evt.eventType"
            >{{ badgeAbbr(evt.eventType) }}</span>
            <span class="event-comp">{{ label(evt.componentId) }}</span>
            <span v-if="evt.detail" class="event-detail">{{ evt.detail }}</span>
          </div>
        </div>

        <div class="bottom-bar">
          <span class="event-count">{{ filteredEvents.length }} 条</span>
          <button class="btn-clear" @click="simStore.clearEventLog()">
            <Trash2 :size="12" />
            清空
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.event-log-panel {
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

.placeholder {
  color: var(--color-fg-dim);
  font-size: 13px;
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
}

.filter-pill {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-fg-muted);
  cursor: pointer;
  transition: all 150ms ease;
}

.filter-pill:hover {
  border-color: var(--color-fg-muted);
}

.filter-pill.active {
  color: var(--pill-color, var(--color-fg-primary));
  border-color: var(--pill-color, var(--color-border));
  background: color-mix(in srgb, var(--pill-color, var(--color-bg-surface)) 20%, transparent);
}

.event-list {
  max-height: 300px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.no-match {
  color: var(--color-fg-dim);
  font-size: 12px;
  text-align: center;
  padding: 12px 0;
}

.event-row {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  font-size: 11px;
  font-family: var(--font-mono);
  padding: 2px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--color-border) 40%, transparent);
}

.event-time {
  color: var(--color-fg-muted);
  flex-shrink: 0;
  min-width: 32px;
}

.event-badge {
  flex-shrink: 0;
  font-size: 9px;
  font-weight: 700;
  padding: 0 3px;
  border-radius: 3px;
  color: var(--color-bg-base);
  min-width: 24px;
  text-align: center;
  line-height: 14px;
}

.event-badge[data-type="PALLET_GENERATED"]  { background: var(--color-success); }
.event-badge[data-type="PALLET_CONSUMED"]   { background: var(--color-primary); }
.event-badge[data-type="PALLET_BLOCKED"]    { background: var(--color-warning); }
.event-badge[data-type="TRANSFER_START"]    { background: var(--color-info); }
.event-badge[data-type="TRANSFER_COMPLETE"] { background: var(--color-info); }
.event-badge[data-type="CAPACITY_REJECTED"] { background: var(--color-warning); }
.event-badge[data-type="ERROR"]             { background: var(--color-destructive); }

.event-comp {
  color: var(--color-fg-secondary);
  flex-shrink: 0;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.event-detail {
  color: var(--color-fg-dim);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bottom-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--color-border);
}

.event-count {
  font-size: 11px;
  color: var(--color-fg-muted);
  font-family: var(--font-mono);
}

.btn-clear {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 3px 8px;
  background: var(--color-btn-confirm-bg);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-fg-muted);
  font-size: 11px;
  cursor: pointer;
}

.btn-clear:hover {
  background: var(--color-btn-confirm-hover);
  color: var(--color-fg-primary);
}
</style>
