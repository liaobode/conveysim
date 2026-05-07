<script setup lang="ts">
import { useSimulationStore } from '../../stores/simulationStore';
import { useCanvasStore } from '../../stores/canvasStore';
import { useUIStore } from '../../stores/uiStore';

const simStore = useSimulationStore();
const canvasStore = useCanvasStore();
const uiStore = useUIStore();

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

function cycleSpeed(): void {
  const speeds = [1, 2, 4];
  const idx = speeds.indexOf(simStore.speedMultiplier);
  const next = speeds[(idx + 1) % speeds.length];
  simStore.setSpeed(next);
}

function onBatchRun(): void {
  uiStore.openBatchDialog();
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
}
</script>

<template>
  <header class="app-header">
    <span class="logo">ConveySim</span>
    <div class="controls">
      <button class="btn" title="搭建测试回路" @click="setupTestCircuit">&#9881; 测试</button>
      <button class="btn" title="导入场景" @click="uiStore.openLoadDialog()">&#128193; 导入</button>
      <button class="btn" title="保存场景" @click="uiStore.openSaveDialog()">&#128190; 保存</button>
      <span class="sep"></span>
      <button
        class="btn"
        :disabled="simStore.status !== 'idle'"
        title="启动仿真"
        @click="onStart"
      >&#9654; 启动</button>
      <button
        class="btn"
        :disabled="simStore.status === 'idle'"
        :title="simStore.status === 'running' ? '暂停' : '继续'"
        @click="onPause"
      >{{ simStore.status === 'running' ? '&#9646;&#9646; 暂停' : '&#9654; 继续' }}</button>
      <button
        class="btn"
        :disabled="simStore.status === 'idle'"
        title="停止仿真"
        @click="onStop"
      >&#9632; 停止</button>
      <button
        class="btn"
        :disabled="simStore.status === 'running'"
        title="单步推进一帧"
        @click="onStep"
      >&#9654;| 单步</button>
      <button class="btn speed-btn" title="切换速度" @click="cycleSpeed">{{ simStore.speedMultiplier }}x</button>
      <span class="sep"></span>
      <button
        class="btn"
        :disabled="simStore.status === 'running' && simStore.multiRunTotal === 0"
        title="批量自动运行"
        @click="onBatchRun"
      >&#9654;&#9654; 批量</button>
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
  background: #16213e;
  border-bottom: 1px solid #0f3460;
  flex-shrink: 0;
}

.logo {
  font-weight: 700;
  font-size: 16px;
  color: #e94560;
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
  border: 1px solid #0f3460;
  background: #1a1a2e;
  color: #e0e0e0;
  border-radius: 4px;
  font-size: 12px;
}

.btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.btn:not(:disabled):hover {
  background: #0f3460;
}

.sep {
  width: 1px;
  height: 20px;
  background: #0f3460;
  margin: 0 4px;
}

.speed-btn {
  width: auto;
  padding: 0 6px;
  font-size: 12px;
  color: #e9a820;
  min-width: 28px;
}

.speed-btn:hover {
  color: #e94560;
}
</style>
