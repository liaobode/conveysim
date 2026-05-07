<script setup lang="ts">
import { useUIStore } from '../../stores/uiStore';

const uiStore = useUIStore();

const colorMap: Record<string, string> = {
  error: '#e94560',
  warn: '#e9a820',
  info: '#4a8ae0',
};
</script>

<template>
  <div class="toast-container" v-if="uiStore.toasts.length > 0">
    <div
      v-for="t in uiStore.toasts"
      :key="t.id"
      class="toast-item"
      :style="{ borderColor: colorMap[t.type] }"
    >
      {{ t.message }}
      <button class="toast-close" @click="uiStore.removeToast(t.id)">&times;</button>
    </div>
  </div>
</template>

<style scoped>
.toast-container {
  position: fixed;
  bottom: 40px;
  right: 16px;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.toast-item {
  pointer-events: auto;
  background: #16213e;
  border: 1px solid #0f3460;
  border-left-width: 4px;
  border-radius: 4px;
  padding: 8px 12px;
  color: #e0e0e0;
  font-size: 13px;
  max-width: 360px;
  display: flex;
  align-items: center;
  gap: 8px;
  animation: slideIn 0.2s ease-out;
}

@keyframes slideIn {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

.toast-close {
  background: none;
  border: none;
  color: #888;
  font-size: 16px;
  cursor: pointer;
  padding: 0 2px;
  flex-shrink: 0;
}

.toast-close:hover {
  color: #e0e0e0;
}
</style>
