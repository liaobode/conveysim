<script setup lang="ts">
import { ref } from 'vue';

const rounds = ref(10);
const timePerRound = ref(60);

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
  <div class="dialog-overlay" @click.self="emit('close')">
    <div class="dialog">
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
  background: rgba(0, 0, 0, 0.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
}
.dialog {
  background: #16213e; border: 1px solid #0f3460;
  border-radius: 8px; padding: 20px; min-width: 300px;
}
h3 { margin: 0 0 16px; font-size: 16px; color: #e0e0e0; }
label { font-size: 12px; color: #888; display: block; margin-bottom: 4px; }
input {
  width: 100%;
  background: #1a1a2e; border: 1px solid #0f3460;
  border-radius: 4px; color: #e0e0e0;
  padding: 6px 10px; font-size: 14px; margin-bottom: 12px;
}
.hint { font-size: 12px; color: #666; text-align: center; margin-bottom: 12px; }
.dialog-actions { display: flex; gap: 8px; justify-content: flex-end; }
.btn-cancel {
  background: #1a1a2e; border: 1px solid #0f3460;
  color: #888; padding: 6px 16px; border-radius: 4px;
}
.btn-start {
  background: #1a3a5a; border: 1px solid #0f3460;
  color: #e0e0e0; padding: 6px 16px; border-radius: 4px;
}
.btn-start:hover { background: #2a4a6a; }
</style>
