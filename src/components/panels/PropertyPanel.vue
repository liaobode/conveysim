<script setup lang="ts">
import { computed, ref } from 'vue';
import { ChevronDown, ChevronUp } from 'lucide-vue-next';
import { useEditorStore } from '../../stores/editorStore';
import { useCanvasStore } from '../../stores/canvasStore';
import { useSimulationStore } from '../../stores/simulationStore';
import type { ConveyorData, TransferMachineData, ForkliftData } from '../../types';
import RoutingTable from './RoutingTable.vue';

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

const flashFields = ref<Record<string, boolean>>({});
const panelCollapsed = ref(false);

function clampWithFlash(field: string, v: number, min: number, max: number): number {
  const clamped = clamp(v, min, max);
  if (clamped !== v) {
    flashFields.value[field] = true;
    setTimeout(() => { delete flashFields.value[field]; }, 600);
  }
  return clamped;
}

const editorStore = useEditorStore();
const canvasStore = useCanvasStore();
const simStore = useSimulationStore();
const isLocked = computed(() => simStore.status !== 'idle' || simStore.multiRunTotal > 0);

type ComponentKind = 'conveyor' | 'transfer' | 'forklift' | null;

interface SelectionInfo {
  kind: ComponentKind;
  id: string;
}

const selection = computed<SelectionInfo>(() => {
  const id = editorStore.selectedComponentId;
  if (!id) return { kind: null, id: '' };
  if (canvasStore.conveyors[id]) return { kind: 'conveyor', id };
  if (canvasStore.transferMachines[id]) return { kind: 'transfer', id };
  if (canvasStore.forklifts[id]) return { kind: 'forklift', id };
  return { kind: null, id };
});

const conveyorData = computed<ConveyorData | null>(() =>
  selection.value.kind === 'conveyor' ? canvasStore.conveyors[selection.value.id] : null,
);

const transferData = computed<TransferMachineData | null>(() =>
  selection.value.kind === 'transfer' ? canvasStore.transferMachines[selection.value.id] : null,
);

const forkliftData = computed<ForkliftData | null>(() =>
  selection.value.kind === 'forklift' ? canvasStore.forklifts[selection.value.id] : null,
);

function updateConveyor(patch: Partial<ConveyorData>): void {
  if (isLocked.value || selection.value.kind !== 'conveyor') return;
  canvasStore.updateConveyor(selection.value.id, patch);
}

function updateTransfer(patch: Partial<TransferMachineData>): void {
  if (isLocked.value || selection.value.kind !== 'transfer') return;
  canvasStore.updateTransfer(selection.value.id, patch);
}

function updateForklift(patch: Partial<ForkliftData>): void {
  if (isLocked.value || selection.value.kind !== 'forklift') return;
  canvasStore.updateForklift(selection.value.id, patch);
}

function deleteComponent(): void {
  if (isLocked.value || !selection.value.id) return;
  canvasStore.removeComponent(selection.value.id);
  editorStore.selectComponent(null);
}
</script>

<template>
  <aside class="property-panel" @keydown.enter="($event.target as HTMLElement)?.blur()">
    <div class="panel-title" @click="panelCollapsed = !panelCollapsed">
      属性
      <ChevronUp v-if="!panelCollapsed" :size="14" />
      <ChevronDown v-else :size="14" />
    </div>

    <div v-show="!panelCollapsed">
    <!-- 锁定 -->
    <p v-if="isLocked" class="locked">仿真运行中 — 只读模式</p>

    <!-- 未选中 -->
    <p v-else-if="selection.kind === null" class="placeholder">
      {{ Object.keys(canvasStore.conveyors).length + Object.keys(canvasStore.transferMachines).length + Object.keys(canvasStore.forklifts).length === 0
        ? '从左侧工具栏拖入组件到画布'
        : '点击画布中的组件查看属性' }}
    </p>

    <!-- 输送机属性 -->
    <div v-if="selection.kind === 'conveyor' && conveyorData" class="form">
      <label>标签</label>
      <input
          :disabled="isLocked"
        type="text"
        :value="conveyorData.label"
        placeholder="输入标签名称"
        @change="updateConveyor({ label: ($event.target as HTMLInputElement).value })"
      />

      <label>类型</label>
      <p class="readonly">{{ conveyorData.type === 'chain' ? '链条输送机' : '滚筒输送机' }}</p>

      <label>长度 (米)</label>
      <input
          :disabled="isLocked"
        type="number"
        :value="conveyorData.length"
        :class="{ 'input-flash': flashFields['conv-length'] }"
        min="0.5" max="100" step="0.5"
        @change="updateConveyor({ length: clampWithFlash('conv-length', +($event.target as HTMLInputElement).value, 0.5, 100) })"
      />

      <label>宽度 (米)</label>
      <input
          :disabled="isLocked"
        type="number"
        :value="conveyorData.width"
        :class="{ 'input-flash': flashFields['conv-width'] }"
        min="0.2" max="5" step="0.1"
        @change="updateConveyor({ width: clampWithFlash('conv-width', +($event.target as HTMLInputElement).value, 0.2, 5) })"
      />

      <label>速度 (米/秒)</label>
      <input
          :disabled="isLocked"
        type="number"
        :value="conveyorData.speed"
        :class="{ 'input-flash': flashFields['conv-speed'] }"
        min="0.1" max="10" step="0.1"
        @change="updateConveyor({ speed: clampWithFlash('conv-speed', +($event.target as HTMLInputElement).value, 0.1, 10) })"
      />

      <label>方向</label>
      <select
          :disabled="isLocked"
        :value="conveyorData.direction"
        @change="updateConveyor({ direction: ($event.target as HTMLSelectElement).value as ConveyorData['direction'] })"
      >
        <option value="forward">单向</option>
        <option value="bidirectional">双向</option>
      </select>

      <label>ZPA 间距 (米)</label>
      <input
          :disabled="isLocked"
        type="number"
        :value="conveyorData.zoneSpacing"
        :class="{ 'input-flash': flashFields['conv-zonespace'] }"
        min="0.5" :max="conveyorData.length" step="0.1"
        @change="updateConveyor({ zoneSpacing: clampWithFlash('conv-zonespace', +($event.target as HTMLInputElement).value, 0.5, conveyorData.length) })"
      />
    </div>

    <!-- 移载机属性 -->
    <div v-if="selection.kind === 'transfer' && transferData" class="form">
      <label>标签</label>
      <input
          :disabled="isLocked"
        type="text"
        :value="transferData.label"
        placeholder="输入标签名称"
        @change="updateTransfer({ label: ($event.target as HTMLInputElement).value })"
      />

      <label>动作时间 (秒)</label>
      <input
          :disabled="isLocked"
        type="number"
        :value="transferData.actionTime"
        :class="{ 'input-flash': flashFields['trans-time'] }"
        min="0.5" max="60" step="0.5"
        @change="updateTransfer({ actionTime: clampWithFlash('trans-time', +($event.target as HTMLInputElement).value, 0.5, 60) })"
      />

      <label>默认路由</label>
      <select
          :disabled="isLocked"
        :value="transferData.defaultRoute"
        @change="updateTransfer({ defaultRoute: ($event.target as HTMLSelectElement).value })"
      >
        <option value="north">北 (↑)</option>
        <option value="south">南 (↓)</option>
        <option value="east">东 (→)</option>
        <option value="west">西 (←)</option>
      </select>

      <label>旋转货物方向</label>
      <select
          :disabled="isLocked"
        :value="transferData.rotatePallet ? 'yes' : 'no'"
        @change="updateTransfer({ rotatePallet: ($event.target as HTMLSelectElement).value === 'yes' })"
      >
        <option value="no">不旋转</option>
        <option value="yes">旋转</option>
      </select>

      <RoutingTable
        :routing-table="transferData.routingTable"
        :disabled="isLocked"
        @update="updateTransfer({ routingTable: $event })"
      />
    </div>

    <!-- 叉车属性 -->
    <div v-if="selection.kind === 'forklift' && forkliftData" class="form">
      <label>标签</label>
      <input
          :disabled="isLocked"
        type="text"
        :value="forkliftData.label"
        placeholder="输入标签名称"
        @change="updateForklift({ label: ($event.target as HTMLInputElement).value })"
      />

      <label>角色</label>
      <p class="readonly">{{ forkliftData.role === 'generator' ? '上料口 (Generator)' : '下料口 (Consumer)' }}</p>

      <label>操作间隔 (秒)</label>
      <input
          :disabled="isLocked"
        type="number"
        :value="forkliftData.interval"
        :class="{ 'input-flash': flashFields['fork-interval'] }"
        min="1" max="3600" step="1"
        @change="updateForklift({ interval: clampWithFlash('fork-interval', +($event.target as HTMLInputElement).value, 1, 3600) })"
      />

      <label>波动范围</label>
      <select
          :disabled="isLocked"
        :value="forkliftData.fluctuation"
        @change="updateForklift({ fluctuation: +($event.target as HTMLSelectElement).value })"
      >
        <option :value="0">±0% (死节拍)</option>
        <option :value="0.1">±10%</option>
        <option :value="0.2">±20%</option>
        <option :value="0.3">±30%</option>
        <option :value="0.5">±50%</option>
      </select>

      <label v-if="forkliftData.role === 'generator'">托盘目的地标签</label>
      <input
          :disabled="isLocked"
        v-if="forkliftData.role === 'generator'"
        type="text"
        :value="forkliftData.destinationTag"
        @change="updateForklift({ destinationTag: ($event.target as HTMLInputElement).value })"
      />

      <label>托盘长 (米)</label>
      <input
          :disabled="isLocked"
        type="number"
        :value="forkliftData.palletSize.width"
        min="0.4" max="5" step="0.1"
        @change="updateForklift({ palletSize: { ...forkliftData.palletSize, width: clamp(+($event.target as HTMLInputElement).value, 0.4, 5) } })"
      />

      <label>托盘宽 (米)</label>
      <input
          :disabled="isLocked"
        type="number"
        :value="forkliftData.palletSize.height"
        min="0.4" max="5" step="0.1"
        @change="updateForklift({ palletSize: { ...forkliftData.palletSize, height: clamp(+($event.target as HTMLInputElement).value, 0.4, 5) } })"
      />
    </div>

    <!-- 删除按钮 -->
    <button
          :disabled="isLocked"
      v-if="selection.kind !== null"
      class="btn-delete"
      @click="deleteComponent"
    >
      删除组件
    </button>
    </div>
  </aside>
</template>

<style scoped>
.property-panel {
  padding: 12px;
  border-bottom: 1px solid var(--color-border);
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

.locked {
  color: var(--color-primary);
  font-size: 13px;
  padding: 8px;
  background: var(--color-locked-bg);
  border: 1px solid var(--color-locked-border);
  border-radius: 4px;
  text-align: center;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

label {
  font-size: 11px;
  color: var(--color-fg-muted);
  margin-top: 8px;
}

input, select {
  background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-fg-primary);
  padding: 4px 8px;
  font-size: 13px;
}

input:focus, select:focus {
  outline: none;
  border-color: var(--color-primary);
}

.input-flash {
  border-color: var(--color-primary) !important;
  animation: flash-border 0.6s ease-out;
}

@keyframes flash-border {
  0% { border-color: var(--color-primary); box-shadow: 0 0 0 2px rgba(233, 69, 96, 0.3); }
  100% { border-color: var(--color-border); box-shadow: none; }
}

.readonly {
  font-size: 13px;
  color: var(--color-fg-secondary);
  padding: 4px 0;
}

.btn-delete {
  margin-top: 16px;
  width: 100%;
  padding: 6px;
  background: var(--color-danger-bg);
  border: 1px solid var(--color-danger-border);
  border-radius: 4px;
  color: var(--color-danger-fg);
  font-size: 13px;
}

.btn-delete:hover {
  background: var(--color-danger-hover);
}
</style>
