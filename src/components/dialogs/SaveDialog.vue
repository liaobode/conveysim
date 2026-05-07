<script setup lang="ts">
import { ref, computed } from 'vue';
import { useCanvasStore } from '../../stores/canvasStore';
import { downloadJSON, saveScene, listScenes } from '../../utils/persistence';

const canvasStore = useCanvasStore();
const sceneName = ref('方案1');
const filename = ref('conveysim-scene.json');
const showOverwriteConfirm = ref(false);

const existingNames = computed(() => new Set(listScenes().map(s => s.name)));

const emit = defineEmits<{ close: [] }>();

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
  <div class="dialog-overlay" @click.self="emit('close')">
    <div class="dialog">
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
  background: rgba(0, 0, 0, 0.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
}
.dialog {
  background: #16213e;
  border: 1px solid #0f3460;
  border-radius: 8px;
  padding: 20px;
  min-width: 320px;
}
h3 { margin: 0 0 12px; font-size: 16px; color: #e0e0e0; }
label { font-size: 12px; color: #888; display: block; margin-bottom: 4px; }
input {
  width: 100%;
  background: #1a1a2e; border: 1px solid #0f3460;
  border-radius: 4px; color: #e0e0e0;
  padding: 6px 10px; font-size: 13px; margin-bottom: 12px;
}
.dialog-actions { display: flex; gap: 8px; justify-content: flex-end; }
.divider { text-align: center; color: #444; font-size: 12px; margin: 12px 0; }
.btn-cancel {
  background: #1a1a2e; border: 1px solid #0f3460;
  color: #888; padding: 6px 16px; border-radius: 4px;
}
.btn-save {
  background: #1a3a5a; border: 1px solid #0f3460;
  color: #e0e0e0; padding: 6px 16px; border-radius: 4px;
}
.btn-save:hover { background: #2a4a6a; }
.btn-export {
  width: 100%;
  background: #2a2a4a; border: 1px solid #0f3460;
  color: #888; padding: 6px 16px; border-radius: 4px; font-size: 12px;
}
.btn-export:hover { background: #3a3a5a; color: #e0e0e0; }
.overwrite-warn {
  background: #4a2010; border: 1px solid #e9a820;
  border-radius: 4px; padding: 6px 10px; margin-bottom: 12px;
  color: #e9a820; font-size: 13px; text-align: center;
}
.btn-save { transition: background 0.2s; }
.btn-save:has(+ .overwrite-warn) { background: #5a3010; border-color: #e9a820; }
</style>
