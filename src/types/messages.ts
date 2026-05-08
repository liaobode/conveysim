import type { SceneJSON } from './scene';
import type { PalletRuntimeState } from './pallet';
import type { TransferRuntimeState } from './transfer';
import type { ZoneState } from './conveyor';

// ======== 主线程 → Worker ========

export interface InitSimulationPayload {
  scene: SceneJSON;
  tickIntervalMs: number;
}

export type MainToWorkerMessage =
  | { type: 'INIT_SIMULATION'; payload: InitSimulationPayload }
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'STOP' }
  | { type: 'STEP' }
  | { type: 'SET_SPEED'; multiplier: number }
  | { type: 'SET_MAX_MODE'; enabled: boolean }
  | { type: 'UPDATE_TOPOLOGY'; payload: SceneJSON };

// ======== Worker → 主线程 ========

export interface FrameUpdatePayload {
  tickNumber: number;
  simTime: number;
  pallets: PalletRuntimeState[];
  transferStates: TransferRuntimeState[];
  forkliftCooldowns: Record<string, number>;
  zoneStates: Record<string, ZoneState[]>;
}

export interface DwellStats {
  totalSec: number;
  count: number;
  maxSec: number;
}

export interface CongestionEvent {
  conveyorId: string;
  startSec: number;
  endSec: number;
}

export interface TimeSegmentData {
  startSec: number;
  endSec: number;
  consumedCount: number;
  avgUtilization: number;
}

export interface StatisticsPayload {
  conveyorUtilization: Record<string, number>;
  overallThroughput: number;
  transferActionCounts: Record<string, number>;
  dwellStats: Record<string, DwellStats>;
  congestionEvents: CongestionEvent[];
  bottleneckId: string | null;
  totalConsumed: number;
}

export type SimulationEventType =
  | 'PALLET_GENERATED'
  | 'PALLET_CONSUMED'
  | 'PALLET_BLOCKED'
  | 'TRANSFER_START'
  | 'TRANSFER_COMPLETE'
  | 'CAPACITY_REJECTED'
  | 'ERROR';

export interface SimulationEvent {
  eventType: SimulationEventType;
  simTime: number;
  componentId: string;
  palletId?: string;
  detail?: string;
}

export type WorkerToMainMessage =
  | { type: 'FRAME_UPDATE'; payload: FrameUpdatePayload }
  | { type: 'STATISTICS'; payload: StatisticsPayload }
  | { type: 'SIMULATION_EVENT'; payload: SimulationEvent }
  | { type: 'ERROR'; message: string }
  | { type: 'READY' };
