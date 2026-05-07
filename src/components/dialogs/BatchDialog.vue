<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { trapFocus } from '../../utils/focusTrap';

const rounds = ref(10);
const timePerRound = ref(60);
const dialogRef = ref<HTMLElement>();

onMounted(() => {
  const first = dialogRef.value?.querySelector<HTMLElement>('input');
  first?.focus();
});

const emit = defineEmits<{
  close: [];
  start: [rounds: number, timePerRound: number];
}>();

function handleStart(): void {
  emit('start', rounds.value, timePerRound.value);
  emit('close');
}
</script>

<template>
  <div class="dialog-overlay" @click.self="emit('close')" @keydown.escape="emit('close')">
    <div ref="dialogRef" class="dialog" @keydown="(e: KeyboardEvent) => trapFocus(e, dialogRef!)">
      <h3>批量运行设置</h3>

      <label>运行轮数</label>
      <input v-model.number="rounds" type="number" min="1" max="100" />

      <label>每轮时长 (秒)</label>
      <input v-model.number="timePerRound" type="number" min="10" max="3600" />

      <p class="hint">共模拟 {{ (rounds * timePerRound) }} 秒（约 {{ (rounds * timePerRound / 60).toFixed(1) }} 分钟）</p>

      <div class="dialog-actions">
        <button class="btn-cancel" @click="emit('close')">取消</button>
        <button class="btn-start" @click="handleStart">开始批量运行</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dialog-overlay {
  position: fixed; inset: 0;
  background: var(--color-overlay);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
}
.dialog {
  background: var(--color-bg-surface); border: 1px solid var(--color-border);
  border-radius: 8px; padding: 20px; min-width: 300px;
}
h3 { margin: 0 0 16px; font-size: 16px; color: var(--color-fg-primary); }
label { font-size: 12px; color: var(--color-fg-muted); display: block; margin-bottom: 4px; }
input {
  width: 100%;
  background: var(--color-bg-base); border: 1px solid var(--color-border);
  border-radius: 4px; color: var(--color-fg-primary);
  padding: 6px 10px; font-size: 14px; margin-bottom: 12px;
}
.hint { font-size: 12px; color: var(--color-fg-dim); text-align: center; margin-bottom: 12px; }
.dialog-actions { display: flex; gap: 8px; justify-content: flex-end; }
.btn-cancel {
  background: var(--color-bg-base); border: 1px solid var(--color-border);
  color: var(--color-fg-muted); padding: 6px 16px; border-radius: 4px;
}
.btn-start {
  background: var(--color-btn-confirm-bg); border: 1px solid var(--color-border);
  color: var(--color-fg-primary); padding: 6px 16px; border-radius: 4px;
}
.btn-start:hover { background: var(--color-btn-confirm-hover); }
</style>
