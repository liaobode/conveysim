<script setup lang="ts">
import { useCanvasStore } from '../../stores/canvasStore';
import { uploadJSON } from '../../utils/persistence';

const canvasStore = useCanvasStore();

const emit = defineEmits<{
  close: [];
}>();

async function handleLoad(): Promise<void> {
  try {
    const scene = await uploadJSON();
    canvasStore.loadFromJSON(scene);
    emit('close');
  } catch {
    // 用户取消或文件无效
  }
}
</script>

<template>
  <div class="dialog-overlay" @click.self="emit('close')">
    <div class="dialog">
      <h3>导入场景</h3>
      <p class="desc">选择之前导出的 .json 文件</p>
      <div class="dialog-actions">
        <button class="btn-cancel" @click="emit('close')">取消</button>
        <button class="btn-load" @click="handleLoad">选择文件</button>
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
  margin: 0 0 8px;
  font-size: 16px;
  color: #e0e0e0;
}

.desc {
  font-size: 13px;
  color: #888;
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

.btn-load {
  background: #1a3a5a;
  border: 1px solid #0f3460;
  color: #e0e0e0;
  padding: 6px 16px;
  border-radius: 4px;
}

.btn-load:hover {
  background: #2a4a6a;
}
</style>
