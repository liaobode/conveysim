<script setup lang="ts">
import { ref } from 'vue';
import { useCanvasStore } from '../../stores/canvasStore';
import { uploadJSON } from '../../utils/persistence';
import { trapFocus } from '../../utils/focusTrap';

const canvasStore = useCanvasStore();

const emit = defineEmits<{
  close: [];
}>();
const dialogRef = ref<HTMLElement>();

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
  <div class="dialog-overlay" @click.self="emit('close')" @keydown.escape="emit('close')">
    <div ref="dialogRef" class="dialog" @keydown="(e: KeyboardEvent) => trapFocus(e, dialogRef!)">
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
  background: var(--color-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 20px;
  min-width: 320px;
}

h3 {
  margin: 0 0 8px;
  font-size: 16px;
  color: var(--color-fg-primary);
}

.desc {
  font-size: 13px;
  color: var(--color-fg-muted);
  margin-bottom: 16px;
}

.dialog-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.btn-cancel {
  background: var(--color-bg-base);
  border: 1px solid var(--color-border);
  color: var(--color-fg-muted);
  padding: 6px 16px;
  border-radius: 4px;
}

.btn-load {
  background: var(--color-btn-confirm-bg);
  border: 1px solid var(--color-border);
  color: var(--color-fg-primary);
  padding: 6px 16px;
  border-radius: 4px;
}

.btn-load:hover {
  background: var(--color-btn-confirm-hover);
}
</style>
