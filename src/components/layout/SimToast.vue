<script setup lang="ts">
import { useUIStore } from '../../stores/uiStore';

const uiStore = useUIStore();

const colorMap: Record<string, string> = {
  error: 'var(--color-toast-error)',
  warn: 'var(--color-toast-warn)',
  info: 'var(--color-toast-info)',
};
</script>

<template>
  <TransitionGroup name="toast" tag="div" class="toast-container" v-if="uiStore.toasts.length > 0">
    <div
      v-for="t in uiStore.toasts"
      :key="t.id"
      class="toast-item"
      :style="{ borderColor: colorMap[t.type] }"
    >
      {{ t.message }}
      <button class="toast-close" @click="uiStore.removeToast(t.id)">&times;</button>
    </div>
  </TransitionGroup>
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
  background: var(--color-toast-bg);
  border: 1px solid var(--color-toast-border);
  border-left-width: 4px;
  border-radius: 4px;
  padding: 8px 12px;
  color: var(--color-fg-primary);
  font-size: 13px;
  max-width: 360px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.toast-enter-active {
  transition: all 0.2s ease-out;
}
.toast-leave-active {
  transition: all 0.15s ease-in;
}
.toast-enter-from {
  transform: translateX(100%);
  opacity: 0;
}
.toast-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
.toast-move {
  transition: transform 0.15s ease;
}

.toast-close {
  background: none;
  border: none;
  color: var(--color-fg-muted);
  font-size: 16px;
  cursor: pointer;
  padding: 0 2px;
  flex-shrink: 0;
}

.toast-close:hover {
  color: var(--color-fg-primary);
}
</style>
