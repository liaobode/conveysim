import { defineStore } from 'pinia';
import type {
  PalletRuntimeState,
  ZoneState,
  DwellStats,
  CongestionEvent,
  SceneJSON,
} from '../types';
import { Simulation } from '../engine/Simulation';
import { useUIStore } from './uiStore';

type SimStatus = 'idle' | 'running' | 'paused';

interface SimulationState {
  status: SimStatus;
  speedMultiplier: number;
  tickCount: number;
  elapsedSimTime: number;
  palletStates: Record<string, PalletRuntimeState>;
  conveyorUtilization: Record<string, number>;
  zoneStates: Record<string, ZoneState[]>;
  throughput: number;
  dwellStats: Record<string, DwellStats>;
  congestionEvents: CongestionEvent[];
  bottleneckId: string | null;
  worker: Worker | null;
  directSim: Simulation | null;
  /** 仿真时长限制（秒），0 = 无限制 */
  timeLimitSec: number;
  /** 批量运行 */
  multiRunTotal: number;
  multiRunCurrent: number;
  multiRunResults: { throughput: number; maxUtil: Record<string, number> }[];
  /** 批量运行时当前正在跑的 sim 实例，用于即时停止 */
  _batchSim: Simulation | null;
}

export const useSimulationStore = defineStore('simulation', {
  state: (): SimulationState => ({
    status: 'idle',
    speedMultiplier: 1,
    tickCount: 0,
    elapsedSimTime: 0,
    palletStates: {},
    conveyorUtilization: {},
    zoneStates: {},
    throughput: 0,
    dwellStats: {},
    congestionEvents: [],
    bottleneckId: null,
    worker: null,
    directSim: null,
    timeLimitSec: 0,
    multiRunTotal: 0,
    multiRunCurrent: 0,
    multiRunResults: [],
    _batchSim: null,
  }),

  actions: {
    initWorker(scene: SceneJSON, tickIntervalMs = 50): void {
      // 停止旧的
      this.stop();
      if (this.worker) {
        this.worker.terminate();
        this.worker = null;
      }
      if (this.directSim) {
        this.directSim.stop();
        this.directSim = null;
      }

      this.tickCount = 0;
      this.elapsedSimTime = 0;
      this.palletStates = {};
      this.conveyorUtilization = {};
      this.zoneStates = {};
      this.throughput = 0;
      this.dwellStats = {};
      this.congestionEvents = [];
      this.bottleneckId = null;

      let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

      const cancelFallback = () => {
        if (fallbackTimer) {
          clearTimeout(fallbackTimer);
          fallbackTimer = null;
        }
      };

      // 尝试 Worker
      try {
        const url = new URL('../engine/worker.ts', import.meta.url);
        this.worker = new Worker(url, { type: 'module' });
        console.log('[Store] Worker created at:', url.href);

        this.worker.onerror = (e: ErrorEvent) => {
          useUIStore().addToast('Worker 错误: ' + e.message + '，已回退到主线程', 'error');
          cancelFallback();
          this.fallbackToDirect(scene, tickIntervalMs);
        };

        this.worker.onmessageerror = () => {
          useUIStore().addToast('Worker 消息错误，已回退到主线程', 'error');
          cancelFallback();
          this.fallbackToDirect(scene, tickIntervalMs);
        };

        this.worker.onmessage = (e) => {
          const msg = e.data;
          // Worker 有响应就取消超时
          cancelFallback();

          switch (msg.type) {
            case 'READY':
              console.log('[Store] Worker ready (Worker mode active)');
              break;
            case 'FRAME_UPDATE': {
              const { pallets, zoneStates, tickNumber, simTime } = msg.payload;
              this.tickCount = tickNumber;
              this.elapsedSimTime = simTime;
              const states: Record<string, PalletRuntimeState> = {};
              for (const p of pallets) states[p.palletId] = p;
              this.palletStates = { ...states };
              const zones: Record<string, ZoneState[]> = {};
              for (const [id, zs] of Object.entries(zoneStates)) zones[id] = zs as ZoneState[];
              this.zoneStates = zones;
              break;
            }
            case 'STATISTICS':
              this.conveyorUtilization = msg.payload.conveyorUtilization;
              this.throughput = msg.payload.overallThroughput;
              this.dwellStats = msg.payload.dwellStats || {};
              this.congestionEvents = msg.payload.congestionEvents || [];
              this.bottleneckId = msg.payload.bottleneckId || null;
              break;
            case 'SIMULATION_EVENT':
              if (msg.payload.eventType === 'ERROR') {
                useUIStore().addToast('仿真异常: ' + (msg.payload.detail || '未知错误'), 'error');
              }
              break;
            case 'ERROR':
              useUIStore().addToast('仿真错误: ' + msg.message, 'error');
              break;
          }
        };

        // JSON 序列化去掉 Pinia 响应式 Proxy，否则 structured clone 失败
        const plainScene = JSON.parse(JSON.stringify(scene));
        this.worker.postMessage({
          type: 'INIT_SIMULATION',
          payload: { scene: plainScene, tickIntervalMs },
        });

        // 如果 1 秒内 Worker 没有任何响应，回退到主线程
        fallbackTimer = setTimeout(() => {
          useUIStore().addToast('Worker 超时无响应，已回退到主线程', 'warn');
          fallbackTimer = null;
          this.fallbackToDirect(scene, tickIntervalMs);
        }, 1000);

      } catch (err: any) {
        useUIStore().addToast('Worker 创建失败: ' + err.message + '，使用主线程模式', 'warn');
        this.fallbackToDirect(scene, tickIntervalMs);
      }

      this.status = 'idle';
    },

    /** 主线程直接跑仿真 */
    fallbackToDirect(scene: SceneJSON, tickIntervalMs: number): void {
      if (this.worker) {
        this.worker.terminate();
        this.worker = null;
      }
      console.log('[Store] Starting direct simulation on main thread');
      this.directSim = new Simulation({
        onFrameUpdate: (payload) => {
          const { pallets, zoneStates, tickNumber, simTime } = payload;
          this.tickCount = tickNumber;
          this.elapsedSimTime = simTime;
          const states: Record<string, PalletRuntimeState> = {};
          for (const p of pallets) states[p.palletId] = p;
          this.palletStates = { ...states };
          const zones: Record<string, ZoneState[]> = {};
          for (const [id, zs] of Object.entries(zoneStates)) zones[id] = zs as ZoneState[];
          this.zoneStates = zones;
        },
        onStatistics: (payload) => {
          this.conveyorUtilization = payload.conveyorUtilization;
          this.throughput = payload.overallThroughput;
          this.dwellStats = payload.dwellStats || {};
          this.congestionEvents = payload.congestionEvents || [];
          this.bottleneckId = payload.bottleneckId || null;
        },
        onEvent: (_payload) => {},
      });
      this.directSim.init(scene, tickIntervalMs);
    },

    sendCommand(msg: any): void {
      if (this.worker) {
        this.worker.postMessage(msg);
      }
    },

    start(): void {
      if (this.directSim) {
        this.directSim.start();
        this.status = 'running';
        return;
      }
      this.sendCommand({ type: 'START' });
      this.status = 'running';
    },

    pause(): void {
      this.sendCommand({ type: 'PAUSE' });
      if (this.directSim) this.directSim.pause();
      this.status = 'paused';
    },

    resume(): void {
      this.sendCommand({ type: 'RESUME' });
      if (this.directSim) this.directSim.resume();
      this.status = 'running';
    },

    stop(): void {
      this.sendCommand({ type: 'STOP' });
      if (this.directSim) {
        this.directSim.stop();
        this.directSim = null;
      }
      if (this.worker) {
        this.worker.terminate();
        this.worker = null;
      }
      // 停止仿真，保留分析数据供查看
      this.status = 'idle';
      this.tickCount = 0;
      this.palletStates = {};
      this.zoneStates = {};
      this.multiRunTotal = 0;
      this.multiRunResults = [];
      if (this._batchSim) {
        this._batchSim.stop();
        this._batchSim = null;
      }
    },

    step(): void {
      if (this.status === 'idle') {
        // 需要先 init
      }
      this.sendCommand({ type: 'STEP' });
      if (this.directSim) this.directSim.step();
      this.status = 'paused';
    },

    setSpeed(multiplier: number): void {
      this.speedMultiplier = multiplier;
      this.sendCommand({ type: 'SET_SPEED', multiplier });
      if (this.directSim) this.directSim.setSpeed(multiplier);
    },

    updateTopology(scene: SceneJSON): void {
      const plainScene = JSON.parse(JSON.stringify(scene));
      this.sendCommand({ type: 'UPDATE_TOPOLOGY', payload: plainScene });
      if (this.directSim) this.directSim.init(scene, 50);
    },

    /** 批量自动运行 */
    async runBatch(scene: SceneJSON, totalRuns: number, timeLimitSec: number): Promise<void> {
      this.multiRunTotal = totalRuns;
      this.multiRunCurrent = 0;
      this.multiRunResults = [];
      this.timeLimitSec = timeLimitSec;

      for (let i = 0; i < totalRuns; i++) {
        // 检查是否被取消
        if ((this.status as string) === 'idle' && this.multiRunTotal === 0) {
          this.multiRunResults = [];
          return;
        }

        this.multiRunCurrent = i + 1;
        this.status = 'running';

        // 每轮前 yield 给 UI 呼吸
        await new Promise(r => setTimeout(r, 50));

        const sim = new Simulation({
          onFrameUpdate: () => {},
          onStatistics: () => {},
          onEvent: () => {},
        });
        sim.init(JSON.parse(JSON.stringify(scene)), 50);
        this._batchSim = sim;
        sim.start();

        // 分段等待，允许 UI 更新 + 检查取消信号
        await new Promise<void>((resolve) => {
          const check = setInterval(() => {
            if ((this.status as string) === 'idle' && this.multiRunTotal === 0) {
              // 被停止
              sim.stop();
              clearInterval(check);
              resolve();
              return;
            }
            if (sim.elapsedTime >= timeLimitSec) {
              sim.stop();
              clearInterval(check);
              resolve();
            }
          }, 30);
        });

        if (this.multiRunTotal === 0) return;

        // 收集结果
        const stats = sim.getStats();
        const maxUtil: Record<string, number> = {};
        for (const [id, u] of Object.entries(stats.conveyorUtilization)) {
          maxUtil[id] = Math.max(maxUtil[id] || 0, u);
        }
        this.multiRunResults.push({
          throughput: stats.overallThroughput,
          maxUtil,
        });

        // 更新最后一次的统计
        this.throughput = stats.overallThroughput;
        this.conveyorUtilization = stats.conveyorUtilization;
        this.dwellStats = stats.dwellStats;
        this.congestionEvents = stats.congestionEvents;
        this.bottleneckId = stats.bottleneckId;
        this.elapsedSimTime = stats.simTime;

        // 显式释放本轮 sim 引用，帮助 GC
        this._batchSim = null;
      }

      this.status = 'idle';
    },

    destroyWorker(): void {
      this.stop();
    },
  },
});
