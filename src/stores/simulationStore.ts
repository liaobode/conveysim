import { defineStore } from 'pinia';
import type {
  PalletRuntimeState,
  ZoneState,
  DwellStats,
  CongestionEvent,
  SceneJSON,
  SimulationEvent,
  TimeSegmentData,
  MainToWorkerMessage,
} from '../types';
import { Simulation } from '../engine/Simulation';
import { useUIStore } from './uiStore';

type SimStatus = 'idle' | 'running' | 'paused';

interface SimulationState {
  status: SimStatus;
  speedMultiplier: number;
  maxMode: boolean;
  tickCount: number;
  elapsedSimTime: number;
  palletStates: Record<string, PalletRuntimeState>;
  conveyorUtilization: Record<string, number>;
  zoneStates: Record<string, ZoneState[]>;
  forkliftCooldowns: Record<string, number>;
  throughput: number;
  dwellStats: Record<string, DwellStats>;
  congestionEvents: CongestionEvent[];
  bottleneckId: string | null;
  eventLog: SimulationEvent[];
  timeSegments: TimeSegmentData[];
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
  /** 批量运行取消标志，避免 status/multiRunTotal 复合判断的竞态 */
  _batchCancelled: boolean;
}

// 分时段统计累加器（无需响应式）
const SEGMENT_DURATION_SEC = 60;
const MAX_SEGMENTS = 120;
let _segStartTime = 0;
let _segConsumedStart = 0;
let _segUtilSamples: number[] = [];
let _segConsumedCount = 0;

function accumulateSegment(
  simTime: number,
  totalConsumed: number,
  conveyorUtilization: Record<string, number>,
): TimeSegmentData | null {
  if (_segStartTime === 0) {
    _segStartTime = simTime;
    _segConsumedStart = totalConsumed;
  }

  // 累加当前时段的采样
  _segConsumedCount = totalConsumed - _segConsumedStart;
  const utils = Object.values(conveyorUtilization);
  if (utils.length > 0) {
    _segUtilSamples.push(utils.reduce((a, b) => a + b, 0) / utils.length);
  }

  // 跨越时段边界时生成快照
  const segEnd = _segStartTime + SEGMENT_DURATION_SEC;
  if (simTime >= segEnd) {
    const avgUtil = _segUtilSamples.length > 0
      ? _segUtilSamples.reduce((a, b) => a + b, 0) / _segUtilSamples.length
      : 0;
    const segment: TimeSegmentData = {
      startSec: Math.round(_segStartTime),
      endSec: Math.round(segEnd),
      consumedCount: _segConsumedCount,
      avgUtilization: Math.round(avgUtil * 1000) / 1000,
    };

    // 推进到下一个时段
    _segStartTime = segEnd;
    _segConsumedStart = totalConsumed;
    _segUtilSamples = [];
    _segConsumedCount = 0;

    return segment;
  }

  return null;
}

function resetSegmentAccumulator(): void {
  _segStartTime = 0;
  _segConsumedStart = 0;
  _segUtilSamples = [];
  _segConsumedCount = 0;
}

export const useSimulationStore = defineStore('simulation', {
  state: (): SimulationState => ({
    status: 'idle',
    speedMultiplier: 1,
    maxMode: false,
    tickCount: 0,
    elapsedSimTime: 0,
    palletStates: {},
    conveyorUtilization: {},
    zoneStates: {},
    forkliftCooldowns: {},
    throughput: 0,
    dwellStats: {},
    congestionEvents: [],
    bottleneckId: null,
    eventLog: [],
    timeSegments: [],
    worker: null,
    directSim: null,
    timeLimitSec: 0,
    multiRunTotal: 0,
    multiRunCurrent: 0,
    multiRunResults: [],
    _batchSim: null,
    _batchCancelled: false,
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
      this.eventLog = [];
      this.timeSegments = [];
      resetSegmentAccumulator();

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
              break;
            case 'FRAME_UPDATE': {
              const { pallets, zoneStates, forkliftCooldowns, tickNumber, simTime } = msg.payload;
              this.tickCount = tickNumber;
              this.elapsedSimTime = simTime;
              const states: Record<string, PalletRuntimeState> = {};
              for (const p of pallets) states[p.palletId] = p;
              this.palletStates = { ...states };
              const zones: Record<string, ZoneState[]> = {};
              for (const [id, zs] of Object.entries(zoneStates)) zones[id] = zs as ZoneState[];
              this.zoneStates = zones;
              this.forkliftCooldowns = forkliftCooldowns || {};
              break;
            }
            case 'STATISTICS':
              this.conveyorUtilization = msg.payload.conveyorUtilization;
              this.throughput = msg.payload.overallThroughput;
              this.dwellStats = msg.payload.dwellStats || {};
              this.congestionEvents = msg.payload.congestionEvents || [];
              this.bottleneckId = msg.payload.bottleneckId || null;
              this._pushSegment(this.elapsedSimTime, msg.payload.totalConsumed, msg.payload.conveyorUtilization);
              break;
            case 'SIMULATION_EVENT':
              this.addEvent(msg.payload);
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

      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        useUIStore().addToast('Worker 创建失败: ' + msg + '，使用主线程模式', 'warn');
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
      this.directSim = new Simulation({
        onFrameUpdate: (payload) => {
          const { pallets, zoneStates, forkliftCooldowns, tickNumber, simTime } = payload;
          this.tickCount = tickNumber;
          this.elapsedSimTime = simTime;
          const states: Record<string, PalletRuntimeState> = {};
          for (const p of pallets) states[p.palletId] = p;
          this.palletStates = { ...states };
          const zones: Record<string, ZoneState[]> = {};
          for (const [id, zs] of Object.entries(zoneStates)) zones[id] = zs as ZoneState[];
          this.zoneStates = zones;
          this.forkliftCooldowns = forkliftCooldowns || {};
        },
        onStatistics: (payload) => {
          this.conveyorUtilization = payload.conveyorUtilization;
          this.throughput = payload.overallThroughput;
          this.dwellStats = payload.dwellStats || {};
          this.congestionEvents = payload.congestionEvents || [];
          this.bottleneckId = payload.bottleneckId || null;
          this._pushSegment(this.elapsedSimTime, payload.totalConsumed, payload.conveyorUtilization);
        },
        onEvent: (payload) => {
          this.addEvent(payload);
        },
      });
      this.directSim.init(scene, tickIntervalMs);
    },

    /** 向 Worker 发送命令，同时执行 direct 模式下的对应操作 */
    _dispatch(msg: MainToWorkerMessage, directFn?: () => void): void {
      if (this.worker) this.worker.postMessage(msg);
      directFn?.();
    },

    start(): void {
      this._dispatch({ type: 'START' }, () => this.directSim?.start());
      this.status = 'running';
    },

    pause(): void {
      this._dispatch({ type: 'PAUSE' }, () => this.directSim?.pause());
      this.status = 'paused';
    },

    resume(): void {
      this._dispatch({ type: 'RESUME' }, () => this.directSim?.resume());
      this.status = 'running';
    },

    stop(): void {
      this._dispatch({ type: 'STOP' }, () => {
        this.directSim?.stop();
        this.directSim = null;
      });
      if (this.worker) {
        this.worker.terminate();
        this.worker = null;
      }
      // 停止仿真，保留分析数据供查看
      this.status = 'idle';
      this._batchCancelled = true;
      this.multiRunTotal = 0;
      if (this._batchSim) {
        this._batchSim.stop();
        this._batchSim = null;
      }
    },

    step(): void {
      if (this.status === 'idle') return;
      this._dispatch({ type: 'STEP' }, () => this.directSim?.step());
      this.status = 'paused';
    },

    clearData(): void {
      this.tickCount = 0;
      this.elapsedSimTime = 0;
      this.palletStates = {};
      this.conveyorUtilization = {};
      this.zoneStates = {};
      this.forkliftCooldowns = {};
      this.throughput = 0;
      this.dwellStats = {};
      this.congestionEvents = [];
      this.bottleneckId = null;
      this.multiRunResults = [];
      this.eventLog = [];
      this.timeSegments = [];
      resetSegmentAccumulator();
    },

    addEvent(event: SimulationEvent): void {
      this.eventLog.push(event);
      if (this.eventLog.length > 500) {
        this.eventLog.shift();
      }
    },

    clearEventLog(): void {
      this.eventLog = [];
    },

    _pushSegment(simTime: number, totalConsumed: number, conveyorUtilization: Record<string, number>): void {
      const seg = accumulateSegment(simTime, totalConsumed, conveyorUtilization);
      if (seg) {
        this.timeSegments.push(seg);
        if (this.timeSegments.length > MAX_SEGMENTS) {
          this.timeSegments.shift();
        }
      }
    },

    setSpeed(multiplier: number): void {
      this.speedMultiplier = multiplier;
      this.maxMode = false;
      this._dispatch({ type: 'SET_SPEED', multiplier }, () => this.directSim?.setSpeed(multiplier));
      this._dispatch({ type: 'SET_MAX_MODE', enabled: false }, () => this.directSim?.setMaxMode(false));
    },

    setMaxMode(enabled: boolean): void {
      this.maxMode = enabled;
      this._dispatch({ type: 'SET_MAX_MODE', enabled }, () => this.directSim?.setMaxMode(enabled));
    },

    updateTopology(scene: SceneJSON): void {
      const plainScene = JSON.parse(JSON.stringify(scene));
      this._dispatch({ type: 'UPDATE_TOPOLOGY', payload: plainScene }, () => this.directSim?.init(scene, 50));
    },

    /** 批量自动运行 */
    async runBatch(scene: SceneJSON, totalRuns: number, timeLimitSec: number): Promise<void> {
      this._batchCancelled = false;
      this.multiRunTotal = totalRuns;
      this.multiRunCurrent = 0;
      this.multiRunResults = [];
      this.timeLimitSec = timeLimitSec;

      for (let i = 0; i < totalRuns; i++) {
        // 检查是否被取消
        if (this._batchCancelled) {
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
          onEvent: (payload) => {
            this.addEvent(payload);
          },
        });
        sim.init(JSON.parse(JSON.stringify(scene)), 50);
        this._batchSim = sim;
        sim.start();

        // 分段等待，允许 UI 更新 + 检查取消信号
        await new Promise<void>((resolve) => {
          const check = setInterval(() => {
            if (this._batchCancelled) {
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

        if (this._batchCancelled) return;

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
