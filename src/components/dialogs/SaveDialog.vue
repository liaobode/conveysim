<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useCanvasStore } from '../../stores/canvasStore';
import { downloadJSON, saveScene, listScenes } from '../../utils/persistence';
import { trapFocus } from '../../utils/focusTrap';

const canvasStore = useCanvasStore();
const sceneName = ref('方案1');
const filename = ref('conveysim-scene.json');
const showOverwriteConfirm = ref(false);
const dialogRef = ref<HTMLElement>();

const existingNames = computed(() => new Set(listScenes().map(s => s.name)));

const emit = defineEmits<{ close: [] }>();

onMounted(() => {
  const first = dialogRef.value?.querySelector<HTMLElement>('input');
  first?.focus();
});

function handleSaveToLibrary(): void {
  if (existingNames.value.has(sceneName.value) && !showOverwriteConfirm.value) {
    showOverwriteConfirm.value = true;
    return;
  }
  const scene = canvasStore.toJSON();
  saveScene(sceneName.value, scene);
  showOverwriteConfirm.value = false;
  emit('close');
}

function handleExportFile(): void {
  const scene = canvasStore.toJSON();
  downloadJSON(scene, filename.value);
  emit('close');
}
</script>

<template>
  <div class="dialog-overlay" @click.self="emit('close')" @keydown.escape="emit('close')">
    <div ref="dialogRef" class="dialog" @keydown="(e: KeyboardEvent) => trapFocus(e, dialogRef!)">
      <h3>保存场景</h3>

      <label>场景名称</label>
      <input v-model="sceneName" type="text" placeholder="输入场景名称" />

      <div v-if="showOverwriteConfirm" class="overwrite-warn">
        场景「{{ sceneName }}」已存在，是否覆盖？
      </div>
      <div class="dialog-actions">
        <button class="btn-cancel" @click="emit('close')">取消</button>
        <button class="btn-save" @click="handleSaveToLibrary">
          {{ showOverwriteConfirm ? '确认覆盖' : '保存到场景库' }}
        </button>
      </div>

      <div class="divider">或</div>

      <label>导出文件名</label>
      <input v-model="filename" type="text" />
      <button class="btn-export" @click="handleExportFile">导出 JSON 文件</button>
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
  min-width: 320px;
}
h3 { margin: 0 0 12px; font-size: 16px; color: var(--color-fg-primary); }
label { font-size: 12px; color: var(--color-fg-muted); display: block; margin-bottom: 4px; }
input {
  width: 100%;
  background: var(--color-bg-base); border: 1px solid var(--color-border);
  border-radius: 4px; color: var(--color-fg-primary);
  padding: 6px 10px; font-size: 13px; margin-bottom: 12px;
}
.dialog-actions { display: flex; gap: 8px; justify-content: flex-end; }
.divider { text-align: center; color: var(--color-fg-dim); font-size: 12px; margin: 12px 0; }
.btn-cancel {
  background: var(--color-bg-base); border: 1px solid var(--color-border);
  color: var(--color-fg-muted); padding: 6px 16px; border-radius: 4px;
}
.btn-save {
  background: var(--color-btn-confirm-bg); border: 1px solid var(--color-border);
  color: var(--color-fg-primary); padding: 6px 16px; border-radius: 4px;
}
.btn-save:hover { background: var(--color-btn-confirm-hover); }
.btn-export {
  width: 100%;
  background: var(--color-btn-export-bg); border: 1px solid var(--color-border);
  color: var(--color-fg-muted); padding: 6px 16px; border-radius: 4px; font-size: 12px;
}
.btn-export:hover { background: var(--color-btn-export-hover); color: var(--color-fg-primary); }
.overwrite-warn {
  background: var(--color-warn-bg); border: 1px solid var(--color-warning);
  border-radius: 4px; padding: 6px 10px; margin-bottom: 12px;
  color: var(--color-warning); font-size: 13px; text-align: center;
}
.btn-save { transition: background 0.2s; }
.btn-save:has(+ .overwrite-warn) { background: var(--color-save-warn-bg); border-color: var(--color-warning); }
</style>
