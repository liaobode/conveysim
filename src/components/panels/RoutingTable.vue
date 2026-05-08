<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  routingTable: Record<string, string>;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  update: [value: Record<string, string>];
}>();

const newDest = ref('');
const newAction = ref('straight');

function addRule(): void {
  const dest = newDest.value.trim();
  if (!dest) return;
  const updated = { ...props.routingTable, [dest]: newAction.value };
  emit('update', updated);
  newDest.value = '';
}

function removeRule(dest: string): void {
  const updated = { ...props.routingTable };
  delete updated[dest];
  emit('update', updated);
}
</script>

<template>
  <div class="routing-table">
    <label>路由表</label>

    <div v-if="Object.keys(routingTable).length === 0" class="empty">
      暂无路由规则
    </div>

    <div
      v-for="(action, dest) in routingTable"
      :key="dest"
      class="rule-row"
    >
      <span class="dest">{{ dest }}</span>
      <span class="arrow">&rarr;</span>
      <span class="action">{{ action === 'straight' ? '直行' : '转向' }}</span>
      <button :disabled="props.disabled" class="btn-remove" @click="removeRule(dest)">x</button>
    </div>

    <div class="add-rule">
      <input
        v-model="newDest"
        type="text"
        placeholder="目的地标签"
        class="dest-input"
        @keyup.enter="addRule"
      />
      <select :disabled="props.disabled" v-model="newAction" class="action-select">
        <option value="straight">直行</option>
        <option value="turn">转向</option>
      </select>
      <button :disabled="props.disabled" class="btn-add" @click="addRule">+</button>
    </div>
  </div>
</template>

<style scoped>
.routing-table {
  margin-top: 4px;
}

label {
  font-size: 11px;
  color: var(--color-fg-muted);
}

.empty {
  font-size: 12px;
  color: var(--color-fg-dark);
  padding: 4px 0;
}

.rule-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 0;
  font-size: 12px;
}

.dest {
  color: var(--color-fg-primary);
  flex: 1;
}

.arrow {
  color: var(--color-fg-dim);
}

.action {
  color: var(--color-warning);
}

.btn-remove {
  background: none;
  border: none;
  color: var(--color-danger-fg);
  font-size: 14px;
  padding: 0 4px;
  cursor: pointer;
}

.add-rule {
  display: flex;
  gap: 4px;
  margin-top: 6px;
}

.dest-input {
  flex: 1;
  background: var(--color-bg-base);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-fg-primary);
  padding: 3px 6px;
  font-size: 12px;
  min-width: 0;
}

.action-select {
  background: var(--color-bg-base);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-fg-primary);
  padding: 3px 4px;
  font-size: 11px;
}

.btn-add {
  background: var(--color-btn-confirm-bg);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-fg-primary);
  padding: 3px 8px;
  font-size: 14px;
  cursor: pointer;
}

.btn-add:hover {
  background: var(--color-btn-confirm-hover);
}
</style>
