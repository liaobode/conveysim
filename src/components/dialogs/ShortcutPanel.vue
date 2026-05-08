<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { trapFocus } from '../../utils/focusTrap';

const emit = defineEmits<{ close: [] }>();
const dialogRef = ref<HTMLElement>();

onMounted(() => {
  const btn = dialogRef.value?.querySelector<HTMLElement>('button');
  btn?.focus();
});

const shortcuts = [
  { key: 'Delete / Backspace', desc: '删除选中组件' },
  { key: 'Ctrl + A', desc: '全选所有组件' },
  { key: 'Ctrl + C', desc: '复制选中组件' },
  { key: 'Ctrl + V', desc: '粘贴组件' },
  { key: 'Ctrl + Z', desc: '撤销' },
  { key: 'Ctrl + Y / Shift+Z', desc: '重做' },
  { key: 'R', desc: '旋转输送机 90°' },
  { key: 'S', desc: '切换连线 / 选择工具' },
  { key: 'Shift + 拖拽', desc: '框选组件' },
  { key: 'Escape', desc: '取消选中 / 退出工具' },
  { key: '鼠标中键拖拽', desc: '平移画布' },
  { key: '鼠标滚轮', desc: '缩放画布' },
  { key: '↑↓ Enter Esc', desc: '速度下拉菜单导航' },
];
</script>

<template>
  <div class="dialog-overlay" @click.self="emit('close')" @keydown.escape="emit('close')">
    <div ref="dialogRef" class="dialog" @keydown="(e: KeyboardEvent) => trapFocus(e, dialogRef!)">
      <h3>键盘快捷键</h3>
      <div class="shortcut-list">
        <div v-for="s in shortcuts" :key="s.key" class="shortcut-row">
          <kbd class="key">{{ s.key }}</kbd>
          <span class="desc">{{ s.desc }}</span>
        </div>
      </div>
      <div class="dialog-actions">
        <button class="btn-close" @click="emit('close')">关闭</button>
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
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 20px;
  min-width: 340px;
  max-width: 400px;
}
h3 { margin: 0 0 16px; font-size: 16px; color: var(--color-fg-primary); }
.shortcut-list { display: flex; flex-direction: column; gap: 4px; margin-bottom: 16px; }
.shortcut-row { display: flex; align-items: center; gap: 10px; font-size: 13px; }
.key {
  min-width: 130px;
  padding: 2px 8px;
  background: var(--color-bg-base);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-warning);
  font-family: var(--font-mono);
  font-size: 12px;
  text-align: center;
}
.desc { color: var(--color-fg-secondary); }
.dialog-actions { display: flex; justify-content: flex-end; }
.btn-close {
  background: var(--color-btn-confirm-bg);
  border: 1px solid var(--color-border);
  color: var(--color-fg-primary);
  padding: 6px 20px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
}
.btn-close:hover { background: var(--color-btn-confirm-hover); }
</style>
