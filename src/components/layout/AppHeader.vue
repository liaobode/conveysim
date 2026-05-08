<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useSimulationStore } from '../../stores/simulationStore';
import { useCanvasStore } from '../../stores/canvasStore';
import { useUIStore } from '../../stores/uiStore';
import { useEditorStore } from '../../stores/editorStore';
import { Play, Pause, Square, StepForward, FastForward, FolderOpen, Save, Trash2, FlaskConical, HelpCircle } from 'lucide-vue-next';

const simStore = useSimulationStore();
const canvasStore = useCanvasStore();
const uiStore = useUIStore();

const speedMenuOpen = ref(false);
const speedHighlighted = ref(0);
const speedOptions = [
  { label: '1x', value: 1, isMax: false },
  { label: '2x', value: 2, isMax: false },
  { label: '4x', value: 4, isMax: false },
  { label: '8x', value: 8, isMax: false },
  { label: '16x', value: 16, isMax: false },
  { label: 'Max', value: 0, isMax: true },
] as const;

function toggleSpeedMenu(): void {
  speedMenuOpen.value = !speedMenuOpen.value;
  if (speedMenuOpen.value) initHighlighted();
}

function initHighlighted(): void {
  const idx = speedOptions.findIndex((opt) =>
    opt.isMax ? simStore.maxMode : (!simStore.maxMode && simStore.speedMultiplier === opt.value),
  );
  speedHighlighted.value = idx >= 0 ? idx : 0;
}

function onSpeedKeydown(e: KeyboardEvent): void {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (!speedMenuOpen.value) {
      speedMenuOpen.value = true;
      initHighlighted();
    } else {
      speedHighlighted.value = e.key === 'ArrowDown'
        ? (speedHighlighted.value + 1) % speedOptions.length
        : (speedHighlighted.value - 1 + speedOptions.length) % speedOptions.length;
    }
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    speedMenuOpen.value = !speedMenuOpen.value;
    if (speedMenuOpen.value) initHighlighted();
  } else if (e.key === 'Escape') {
    speedMenuOpen.value = false;
  }
}

function selectSpeed(opt: { label: string; value: number; isMax: boolean }): void {
  speedMenuOpen.value = false;
  if (opt.isMax) {
    simStore.setMaxMode(true);
  } else {
    simStore.setSpeed(opt.value);
  }
}

function closeSpeedMenu(): void {
  speedMenuOpen.value = false;
}

function currentSpeedLabel(): string {
  if (simStore.maxMode) return 'Max';
  return simStore.speedMultiplier + 'x';
}

function onClickOutside(e: MouseEvent): void {
  if (speedMenuOpen.value) {
    speedMenuOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside);
});

function onStart(): void {
  const scene = canvasStore.toJSON();
  console.log('[Header] Starting sim, conv=' + scene.conveyors.length +
    ' trans=' + scene.transferMachines.length +
    ' fork=' + scene.forklifts.length +
    ' conn=' + scene.connections.length);
  simStore.initWorker(scene);
  simStore.start();
}

function onPause(): void {
  if (simStore.status === 'running') {
    simStore.pause();
  } else if (simStore.status === 'paused') {
    simStore.resume();
  }
}

function onStop(): void {
  simStore.stop();
  simStore.destroyWorker();
}

function onStep(): void {
  if (simStore.status === 'idle') {
    const scene = canvasStore.toJSON();
    simStore.initWorker(scene);
  }
  simStore.step();
}

function onBatchRun(): void {
  uiStore.openBatchDialog();
}

function onClear(): void {
  if (simStore.status !== 'idle') return;
  if (!confirm('确定要清空画布吗？所有组件和数据将被清除。')) return;
  canvasStore.clear();
  simStore.clearData();
}

function setupTestCircuit(): void {
  canvasStore.pushUndoSnapshot();
  canvasStore.clear();

  // 发生器 (100, 200)
  const genId = canvasStore.addForklift(100, 200, 'generator');
  canvasStore.updateForklift(genId, { interval: 1, destinationTag: 'sink-1' });

  // 链条输送机1：水平，长度 3m = 150px，中心 (300, 200)
  const conv1Id = canvasStore.addConveyor('chain', 300, 200, 0);
  canvasStore.updateConveyor(conv1Id, { length: 3, speed: 1.5 });

  // 移载机 (500, 200)
  const transId = canvasStore.addTransferMachine(500, 200);
  canvasStore.updateTransfer(transId, {
    actionTime: 1,
    routingTable: { 'sink-1': 'south' },
    defaultRoute: 'south',
  });

  // 链条输送机2：垂直向下，旋转 PI/2，中心 (500, 350)
  const conv2Id = canvasStore.addConveyor('chain', 500, 350, Math.PI / 2);
  canvasStore.updateConveyor(conv2Id, { length: 3, speed: 1.5 });

  // 消费者 (500, 500)
  const consId = canvasStore.addForklift(500, 500, 'consumer');
  canvasStore.updateForklift(consId, { interval: 5 });

  // 手动创建连接
  canvasStore.addConnection(genId, 'output', conv1Id, 'input');
  canvasStore.addConnection(conv1Id, 'output', transId, 'west');
  canvasStore.addConnection(transId, 'south', conv2Id, 'input');
  canvasStore.addConnection(conv2Id, 'output', consId, 'input');

  useEditorStore().requestFitView();
}
</script>

<template>
  <header class="app-header" role="banner" aria-label="主工具栏">
    <span class="logo">ConveySim</span>
    <div class="controls">
      <button class="btn" title="搭建测试回路" @click="setupTestCircuit"><FlaskConical :size="14" /> 测试</button>
      <button class="btn" title="导入场景" @click="uiStore.openLoadDialog()"><FolderOpen :size="14" /> 导入</button>
      <button class="btn" title="保存场景" @click="uiStore.openSaveDialog()"><Save :size="14" /> 保存</button>
      <button
        class="btn"
        :disabled="simStore.status !== 'idle'"
        title="一键清空画布"
        @click="onClear"
      ><Trash2 :size="14" /> 清空</button>
      <span class="sep"></span>
      <button
        class="btn"
        :disabled="simStore.status !== 'idle'"
        title="启动仿真"
        @click="onStart"
      ><Play :size="14" /> 启动</button>
      <button
        class="btn"
        :disabled="simStore.status === 'idle'"
        :title="simStore.status === 'running' ? '暂停' : '继续'"
        @click="onPause"
      ><template v-if="simStore.status === 'running'"><Pause :size="14" /> 暂停</template><template v-else><Play :size="14" /> 继续</template></button>
      <button
        class="btn"
        :disabled="simStore.status === 'idle'"
        title="停止仿真"
        @click="onStop"
      ><Square :size="14" /> 停止</button>
      <button
        class="btn"
        :disabled="simStore.status === 'running'"
        title="单步推进一帧"
        @click="onStep"
      ><StepForward :size="14" /> 单步</button>
      <div class="speed-wrap" @click.stop>
        <button class="btn speed-btn" title="选择仿真速度" @click="toggleSpeedMenu" @keydown="onSpeedKeydown">{{ currentSpeedLabel() }}</button>
        <div v-if="speedMenuOpen" class="speed-dropdown" @click.stop>
          <div
            v-for="(opt, i) in speedOptions"
            :key="opt.label"
            class="speed-option"
            :class="{
              active: opt.isMax ? simStore.maxMode : (!simStore.maxMode && simStore.speedMultiplier === opt.value),
              highlighted: i === speedHighlighted,
            }"
            @click="selectSpeed(opt)"
            @mouseenter="speedHighlighted = i"
          >{{ opt.label }}</div>
        </div>
      </div>
      <span class="sep"></span>
      <button
        class="btn"
        :disabled="simStore.status === 'running' && simStore.multiRunTotal === 0"
        title="批量自动运行"
        @click="onBatchRun"
      ><FastForward :size="14" /> 批量</button>
      <span class="sep"></span>
      <button class="btn" title="键盘快捷键" @click="uiStore.shortcutPanelVisible = true"><HelpCircle :size="14" /> 帮助</button>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 40px;
  padding: 0 12px;
  background: var(--color-bg-surface);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.logo {
  font-weight: 700;
  font-size: 16px;
  color: var(--color-primary);
}

.controls {
  display: flex;
  gap: 4px;
  align-items: center;
}

.btn {
  height: 28px;
  padding: 0 8px;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-base);
  color: var(--color-fg-primary);
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn:not(:disabled):hover {
  background: var(--color-border);
}

.sep {
  width: 1px;
  height: 20px;
  background: var(--color-border);
  margin: 0 4px;
}

.speed-wrap {
  position: relative;
}

.speed-btn {
  width: auto;
  padding: 0 6px;
  font-size: 12px;
  color: var(--color-warning);
  min-width: 36px;
  cursor: pointer;
}

.speed-btn:hover {
  color: var(--color-primary);
}

.speed-dropdown {
  position: absolute;
  top: 32px;
  right: 0;
  background: var(--color-bg-base);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  overflow: hidden;
  z-index: 100;
  min-width: 56px;
}

.speed-option {
  padding: 6px 14px;
  font-size: 12px;
  color: var(--color-fg-primary);
  cursor: pointer;
  text-align: center;
  white-space: nowrap;
}

.speed-option:hover {
  background: var(--color-border);
}

.speed-option.active {
  color: var(--color-primary);
  background: #1a1030; /* unique active highlight — kept inline */
}

.speed-option.highlighted {
  background: var(--color-border);
}
</style>
