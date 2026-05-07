<script setup lang="ts">
import { computed } from 'vue';
import { useEditorStore } from '../../stores/editorStore';
import { useCanvasStore } from '../../stores/canvasStore';
import type { ConveyorData, TransferMachineData, ForkliftData } from '../../types';
import RoutingTable from './RoutingTable.vue';

const editorStore = useEditorStore();
const canvasStore = useCanvasStore();

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
  if (selection.value.kind === 'conveyor') {
    canvasStore.updateConveyor(selection.value.id, patch);
  }
}

function updateTransfer(patch: Partial<TransferMachineData>): void {
  if (selection.value.kind === 'transfer') {
    canvasStore.updateTransfer(selection.value.id, patch);
  }
}

function updateForklift(patch: Partial<ForkliftData>): void {
  if (selection.value.kind === 'forklift') {
    canvasStore.updateForklift(selection.value.id, patch);
  }
}

function deleteComponent(): void {
  if (selection.value.id) {
    canvasStore.removeComponent(selection.value.id);
    editorStore.selectComponent(null);
  }
}
</script>

<template>
  <aside class="property-panel">
    <div class="panel-title">属性</div>

    <!-- 未选中 -->
    <p v-if="selection.kind === null" class="placeholder">选择组件以编辑属性</p>

    <!-- 输送机属性 -->
    <div v-if="selection.kind === 'conveyor' && conveyorData" class="form">
      <label>类型</label>
      <p class="readonly">{{ conveyorData.type === 'chain' ? '链条输送机' : '滚筒输送机' }}</p>

      <label>长度 (米)</label>
      <input
        type="number"
        :value="conveyorData.length"
        min="0.5" step="0.5"
        @change="updateConveyor({ length: +($event.target as HTMLInputElement).value })"
      />

      <label>宽度 (米)</label>
      <input
        type="number"
        :value="conveyorData.width"
        min="0.2" step="0.1"
        @change="updateConveyor({ width: +($event.target as HTMLInputElement).value })"
      />

      <label>速度 (米/秒)</label>
      <input
        type="number"
        :value="conveyorData.speed"
        min="0.1" step="0.1"
        @change="updateConveyor({ speed: +($event.target as HTMLInputElement).value })"
      />

      <label>方向</label>
      <select
        :value="conveyorData.direction"
        @change="updateConveyor({ direction: ($event.target as HTMLSelectElement).value as ConveyorData['direction'] })"
      >
        <option value="forward">单向</option>
        <option value="bidirectional">双向</option>
      </select>

      <label>ZPA 间距 (米)</label>
      <input
        type="number"
        :value="conveyorData.zoneSpacing"
        min="0.5" step="0.1"
        @change="updateConveyor({ zoneSpacing: +($event.target as HTMLInputElement).value })"
      />
    </div>

    <!-- 移载机属性 -->
    <div v-if="selection.kind === 'transfer' && transferData" class="form">
      <label>动作时间 (秒)</label>
      <input
        type="number"
        :value="transferData.actionTime"
        min="0.5" step="0.5"
        @change="updateTransfer({ actionTime: +($event.target as HTMLInputElement).value })"
      />

      <label>默认路由</label>
      <select
        :value="transferData.defaultRoute"
        @change="updateTransfer({ defaultRoute: ($event.target as HTMLSelectElement).value })"
      >
        <option value="straight">直行</option>
        <option value="turn">转向</option>
      </select>

      <RoutingTable
        :routing-table="transferData.routingTable"
        @update="updateTransfer({ routingTable: $event })"
      />
    </div>

    <!-- 叉车属性 -->
    <div v-if="selection.kind === 'forklift' && forkliftData" class="form">
      <label>角色</label>
      <p class="readonly">{{ forkliftData.role === 'generator' ? '上料口 (Generator)' : '下料口 (Consumer)' }}</p>

      <label>操作间隔 (秒)</label>
      <input
        type="number"
        :value="forkliftData.interval"
        min="1" step="1"
        @change="updateForklift({ interval: +($event.target as HTMLInputElement).value })"
      />

      <label v-if="forkliftData.role === 'generator'">托盘目的地标签</label>
      <input
        v-if="forkliftData.role === 'generator'"
        type="text"
        :value="forkliftData.destinationTag"
        @change="updateForklift({ destinationTag: ($event.target as HTMLInputElement).value })"
      />

      <label>托盘长 (米)</label>
      <input
        type="number"
        :value="forkliftData.palletSize.width"
        min="0.4" step="0.1"
        @change="updateForklift({ palletSize: { ...forkliftData.palletSize, width: +($event.target as HTMLInputElement).value } })"
      />

      <label>托盘宽 (米)</label>
      <input
        type="number"
        :value="forkliftData.palletSize.height"
        min="0.4" step="0.1"
        @change="updateForklift({ palletSize: { ...forkliftData.palletSize, height: +($event.target as HTMLInputElement).value } })"
      />
    </div>

    <!-- 删除按钮 -->
    <button
      v-if="selection.kind !== null"
      class="btn-delete"
      @click="deleteComponent"
    >
      删除组件
    </button>
  </aside>
</template>

<style scoped>
.property-panel {
  padding: 12px;
  border-bottom: 1px solid #0f3460;
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

.form {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

label {
  font-size: 11px;
  color: #888;
  margin-top: 8px;
}

input, select {
  background: #1a1a2e;
  border: 1px solid #0f3460;
  border-radius: 4px;
  color: #e0e0e0;
  padding: 4px 8px;
  font-size: 13px;
}

input:focus, select:focus {
  outline: none;
  border-color: #e94560;
}

.readonly {
  font-size: 13px;
  color: #aaa;
  padding: 4px 0;
}

.btn-delete {
  margin-top: 16px;
  width: 100%;
  padding: 6px;
  background: #3a1010;
  border: 1px solid #6a2020;
  border-radius: 4px;
  color: #e06060;
  font-size: 13px;
}

.btn-delete:hover {
  background: #5a2020;
}
</style>
