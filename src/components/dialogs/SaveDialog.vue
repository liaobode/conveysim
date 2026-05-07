<script setup lang="ts">
import { ref } from 'vue';
import { useCanvasStore } from '../../stores/canvasStore';
import { downloadJSON } from '../../utils/persistence';

const canvasStore = useCanvasStore();
const filename = ref('conveysim-scene.json');

const emit = defineEmits<{
  close: [];
}>();

function handleSave(): void {
  const scene = canvasStore.toJSON();
  downloadJSON(scene, filename.value);
  emit('close');
}
</script>

<template>
  <div class="dialog-overlay" @click.self="emit('close')">
    <div class="dialog">
      <h3>导出场景</h3>
      <label>文件名</label>
      <input v-model="filename" type="text" />
      <div class="dialog-actions">
        <button class="btn-cancel" @click="emit('close')">取消</button>
        <button class="btn-save" @click="handleSave">导出 JSON</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: #16213e;
  border: 1px solid #0f3460;
  border-radius: 8px;
  padding: 20px;
  min-width: 320px;
}

h3 {
  margin: 0 0 12px;
  font-size: 16px;
  color: #e0e0e0;
}

label {
  font-size: 12px;
  color: #888;
  display: block;
  margin-bottom: 4px;
}

input {
  width: 100%;
  background: #1a1a2e;
  border: 1px solid #0f3460;
  border-radius: 4px;
  color: #e0e0e0;
  padding: 6px 10px;
  font-size: 13px;
  margin-bottom: 16px;
}

.dialog-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.btn-cancel {
  background: #1a1a2e;
  border: 1px solid #0f3460;
  color: #888;
  padding: 6px 16px;
  border-radius: 4px;
}

.btn-save {
  background: #1a3a5a;
  border: 1px solid #0f3460;
  color: #e0e0e0;
  padding: 6px 16px;
  border-radius: 4px;
}

.btn-save:hover {
  background: #2a4a6a;
}
</style>
