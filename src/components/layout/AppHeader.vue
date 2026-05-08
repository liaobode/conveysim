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
    if (speedMenuOpen.value) {
      selectSpeed(speedOptions[speedHighlighted.value]);
    } else {
      speedMenuOpen.value = true;
      initHighlighted();
    }
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
  if (speedMenuOpen.value) speedMenuOpen.value = false;
  if (sceneMenuOpen.value) sceneMenuOpen.value = false;
}

onMounted(() => {
  document.addEventListener('click', onClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside);
});

function onStart(): void {
  const scene = canvasStore.toJSON();
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

const sceneMenuOpen = ref(false);
const sceneOptions = [
  { label: '单线输送', action: 'simple' },
  { label: '分拣回路', action: 'routing' },
  { label: '多线并行', action: 'parallel' },
] as const;

function setupScene(type: string): void {
  sceneMenuOpen.value = false;
  canvasStore.pushUndoSnapshot();
  canvasStore.clear();
  simStore.clearData();

  if (type === 'simple') {
    // 单线输送：发生器 → 链条机 → 消费者
    const g = canvasStore.addForklift(100, 200, 'generator');
    canvasStore.updateForklift(g, { label: '上料口', interval: 8, destinationTag: 'sink' });           // 每 8 秒投放一托
    const c = canvasStore.addConveyor('chain', 350, 200, 0);
    canvasStore.updateConveyor(c, { label: '主输送线', length: 6, speed: 0.5 });                         // 0.5 m/s 典型链条机速度
    const o = canvasStore.addForklift(650, 200, 'consumer');
    canvasStore.updateForklift(o, { label: '下料口', interval: 6 });                                     // 每 6 秒取走一托
    canvasStore.addConnection(g, 'output', c, 'input');
    canvasStore.addConnection(c, 'output', o, 'input');
  } else if (type === 'routing') {
    // 分拣回路：发生器 → 移载机 → 两条分支 → 两个消费者
    const g = canvasStore.addForklift(100, 200, 'generator');
    canvasStore.updateForklift(g, { label: '上料口', interval: 10, destinationTag: 'line-b', fluctuation: 0.2 }); // 每 10s ±20% 投放
    const c1 = canvasStore.addConveyor('chain', 300, 200, 0);
    canvasStore.updateConveyor(c1, { label: '入口线', length: 5, speed: 0.5 });                                   // 0.5 m/s
    const t = canvasStore.addTransferMachine(550, 200);
    canvasStore.updateTransfer(t, { label: '分拣台', actionTime: 3, routingTable: { 'line-a': 'north', 'line-b': 'south' }, defaultRoute: 'south' }); // 3 秒完成分拣
    const c2a = canvasStore.addConveyor('chain', 550, 50, -Math.PI / 2);
    canvasStore.updateConveyor(c2a, { label: 'A线', length: 5, speed: 0.5 });
    const oa = canvasStore.addForklift(550, -100, 'consumer');
    canvasStore.updateForklift(oa, { label: 'A出口', interval: 8 });
    const c2b = canvasStore.addConveyor('chain', 550, 400, Math.PI / 2);
    canvasStore.updateConveyor(c2b, { label: 'B线', length: 5, speed: 0.5 });
    const ob = canvasStore.addForklift(550, 650, 'consumer');
    canvasStore.updateForklift(ob, { label: 'B出口', interval: 8 });
    canvasStore.addConnection(g, 'output', c1, 'input');
    canvasStore.addConnection(c1, 'output', t, 'west');
    canvasStore.addConnection(t, 'north', c2a, 'input');
    canvasStore.addConnection(t, 'south', c2b, 'input');
    canvasStore.addConnection(c2a, 'output', oa, 'input');
    canvasStore.addConnection(c2b, 'output', ob, 'input');
  } else if (type === 'parallel') {
    // 多线并行：两条独立输送线并排运行
    const g1 = canvasStore.addForklift(100, 140, 'generator');
    canvasStore.updateForklift(g1, { label: '上料口1', interval: 10, destinationTag: 'sink' });          // 每 10 秒投放
    const c1 = canvasStore.addConveyor('chain', 350, 140, 0);
    canvasStore.updateConveyor(c1, { label: '1号线(链条)', length: 8, speed: 0.5 });                      // 链条机 0.5 m/s
    const o1 = canvasStore.addForklift(700, 140, 'consumer');
    canvasStore.updateForklift(o1, { label: '出口1', interval: 8 });
    canvasStore.addConnection(g1, 'output', c1, 'input');
    canvasStore.addConnection(c1, 'output', o1, 'input');

    const g2 = canvasStore.addForklift(100, 260, 'generator');
    canvasStore.updateForklift(g2, { label: '上料口2', interval: 10, destinationTag: 'sink', fluctuation: 0.15 }); // 10s ±15%
    const c2 = canvasStore.addConveyor('roller', 350, 260, 0);
    canvasStore.updateConveyor(c2, { label: '2号线(滚筒)', length: 8, speed: 0.8 });                      // 滚筒机 0.8 m/s（更快）
    const o2 = canvasStore.addForklift(700, 260, 'consumer');
    canvasStore.updateForklift(o2, { label: '出口2', interval: 8 });
    canvasStore.addConnection(g2, 'output', c2, 'input');
    canvasStore.addConnection(c2, 'output', o2, 'input');
  }

  useEditorStore().requestFitView();
}
</script>

<template>
  <header class="app-header" role="banner" aria-label="主工具栏">
    <span class="logo">ConveySim</span>
    <div class="controls">
      <div class="speed-wrap" @click.stop>
        <button class="btn" title="示例场景" @click="sceneMenuOpen = !sceneMenuOpen"><FlaskConical :size="14" /> 示例</button>
        <div v-if="sceneMenuOpen" class="speed-dropdown">
          <div
            v-for="opt in sceneOptions"
            :key="opt.action"
            class="speed-option"
            @click="setupScene(opt.action)"
          >{{ opt.label }}</div>
        </div>
      </div>
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
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
