import { defineStore } from 'pinia';
import type {
  PalletRuntimeState,
  ZoneState,
  SceneJSON,
} from '../types';
import { Simulation } from '../engine/Simulation';

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
  worker: Worker | null;
  directSim: Simulation | null;
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
    worker: null,
    directSim: null,
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
          console.error('[Store] Worker error:', e.message, '- falling back');
          cancelFallback();
          this.fallbackToDirect(scene, tickIntervalMs);
        };

        this.worker.onmessageerror = () => {
          console.error('[Store] Worker message error - falling back');
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
              break;
            case 'SIMULATION_EVENT':
              if (msg.payload.eventType === 'ERROR') {
                console.error('[Sim]', msg.payload.detail);
              }
              break;
            case 'ERROR':
              console.error('[Store] Sim error:', msg.message);
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
          console.warn('[Store] Worker no response in 1s, falling back to direct');
          fallbackTimer = null;
          this.fallbackToDirect(scene, tickIntervalMs);
        }, 1000);

      } catch (err: any) {
        console.warn('[Store] Worker creation failed:', err.message, '- using direct mode');
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
      // 清空所有仿真状态，画布回到初始
      this.status = 'idle';
      this.tickCount = 0;
      this.elapsedSimTime = 0;
      this.palletStates = {};
      this.conveyorUtilization = {};
      this.zoneStates = {};
      this.throughput = 0;
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

    destroyWorker(): void {
      this.stop();
    },
  },
});
