import type { SceneJSON, ZoneState, PalletRuntimeState, TransferRuntimeState } from '../types';
import { ConveyorModel } from './ConveyorModel';
import { TransferModel } from './TransferModel';
import { ForkliftModel } from './ForkliftModel';
import { PalletModel } from './PalletModel';
import { generateId } from '../utils/id';

export type DownstreamTarget =
  | { kind: 'conveyor'; model: ConveyorModel }
  | { kind: 'transfer'; model: TransferModel }
  | { kind: 'forklift'; model: ForkliftModel }
  | { kind: 'none' };

export class Simulation {
  private conveyors = new Map<string, ConveyorModel>();
  private transfers = new Map<string, TransferModel>();
  private forklifts = new Map<string, ForkliftModel>();
  private pallets = new Map<string, PalletModel>();

  // 连接图：fromComponentId:outputPort → toComponentId
  private downstreamMap = new Map<string, string>();

  private tickNumber = 0;
  private simTime = 0;
  private tickDurationSec: number;
  private running = false;
  private paused = false;
  private timer: ReturnType<typeof setInterval> | null = null;

  // 统计
  private totalConsumed = 0;
  private transferActionCounts: Record<string, number> = {};

  // 各段停留时间: conveyorId → { totalSec, count, maxSec }
  private dwellStats: Record<string, { totalSec: number; count: number; maxSec: number }> = {};

  // 拥堵事件: { conveyorId, startSec, endSec }
  private congestionEvents: { conveyorId: string; startSec: number; endSec: number }[] = [];
  private congestionStart: Record<string, number> = {}; // 当前拥堵起始时间

  // 瓶颈
  private bottleneckId: string | null = null;

  // 回调
  private onFrameUpdate?: (payload: any) => void;
  private onStatistics?: (payload: any) => void;
  private onEvent?: (payload: any) => void;

  constructor(
    callbacks: {
      onFrameUpdate: (p: any) => void;
      onStatistics: (p: any) => void;
      onEvent: (p: any) => void;
    },
  ) {
    this.onFrameUpdate = callbacks.onFrameUpdate;
    this.onStatistics = callbacks.onStatistics;
    this.onEvent = callbacks.onEvent;
    this.tickDurationSec = 0.05; // 默认 50ms = 0.05s
  }

  init(scene: SceneJSON, tickIntervalMs: number): void {
    this.tickDurationSec = tickIntervalMs / 1000;
    this.tickNumber = 0;
    this.simTime = 0;
    this.totalConsumed = 0;
    this.transferActionCounts = {};
    this.dwellStats = {};
    this.congestionEvents = [];
    this.congestionStart = {};
    this.bottleneckId = null;

    this.conveyors.clear();
    this.transfers.clear();
    this.forklifts.clear();
    this.pallets.clear();
    this.downstreamMap.clear();

    // 创建模型
    for (const c of scene.conveyors) {
      this.conveyors.set(c.id, new ConveyorModel(c));
    }
    for (const t of scene.transferMachines) {
      this.transfers.set(t.id, new TransferModel(t));
    }
    for (const f of scene.forklifts) {
      this.forklifts.set(f.id, new ForkliftModel(f));
    }

    // 构建下游映射
    for (const conn of scene.connections) {
      const key = `${conn.from.componentId}:${conn.from.portName}`;
      this.downstreamMap.set(key, conn.to.componentId);
    }

    // 诊断日志
    console.log('[Sim] init: conv=' + this.conveyors.size +
      ' trans=' + this.transfers.size +
      ' fork=' + this.forklifts.size +
      ' conn=' + this.downstreamMap.size);
  }

  private getDownstream(componentId: string, port = 'output'): DownstreamTarget {
    const key = `${componentId}:${port}`;
    const toId = this.downstreamMap.get(key);
    if (!toId) return { kind: 'none' };

    const conv = this.conveyors.get(toId);
    if (conv) return { kind: 'conveyor', model: conv };

    const trans = this.transfers.get(toId);
    if (trans) return { kind: 'transfer', model: trans };

    const fork = this.forklifts.get(toId);
    if (fork) return { kind: 'forklift', model: fork };

    return { kind: 'none' };
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    console.log('[Sim] start called, conv=' + this.conveyors.size + ' fork=' + this.forklifts.size);
    this.loop();
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  stop(): void {
    this.running = false;
    this.paused = false;
    // 结束所有进行中的拥堵
    for (const [id, start] of Object.entries(this.congestionStart)) {
      this.congestionEvents.push({ conveyorId: id, startSec: start, endSec: this.simTime });
    }
    this.congestionStart = {};
    this.identifyBottleneck();
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  step(): void {
    this.tick();
  }

  setSpeed(multiplier: number): void {
    this.tickDurationSec = (50 / 1000) * multiplier;
  }

  private loop(): void {
    const baseInterval = 50; // ms
    this.timer = setInterval(() => {
      if (!this.running) {
        clearInterval(this.timer!);
        this.timer = null;
        return;
      }
      if (!this.paused) {
        this.tick();
      }
    }, baseInterval);
  }

  private tick(): void {
    try {
    const dt = this.tickDurationSec;

    // === 阶段 1：叉车发生器 ===
    for (const [, forklift] of this.forklifts) {
      if (forklift.role !== 'generator') continue;
      const action = forklift.tick(dt);
      if (action === 'generate') {
        const downstream = this.getDownstream(forklift.id, 'output');
        if (downstream.kind === 'conveyor' && downstream.model.canAcceptPallet()) {
          const pallet = new PalletModel(
            generateId('pal'),
            forklift.destinationTag,
            forklift.palletSize,
          );
          this.pallets.set(pallet.id, pallet);
          downstream.model.acceptPallet(pallet, 'input', this.simTime);
          pallet.worldRotation = downstream.model.rotation;
          this.emitEvent('PALLET_GENERATED', forklift.id, pallet.id);
        } else {
          this.emitEvent('CAPACITY_REJECTED', forklift.id, undefined, '下游输送机入口已满');
        }
      }
    }

    // === 阶段 2：移载机处理 ===
    for (const [, transfer] of this.transfers) {
      const result = transfer.tick(dt);
      if (result) {
        this.transferActionCounts[transfer.id] =
          (this.transferActionCounts[transfer.id] || 0) + 1;

        // 根据路由决定下游端口
        const downstream = this.getDownstream(transfer.id, result.targetPort);
        if (downstream.kind === 'conveyor' && downstream.model.canAcceptPallet()) {
          downstream.model.acceptPallet(result.pallet, 'input', this.simTime);
          // 按移载机配置决定是否旋转货物
          if (transfer.rotatePallet) {
            result.pallet.worldRotation = downstream.model.rotation;
          }
          this.emitEvent('TRANSFER_COMPLETE', transfer.id, result.pallet.id);
        } else {
          // 下游满，下个 tick 重试
          transfer.holdPallet(result.pallet);
        }
      }
    }

    // === 阶段 3：输送机移动托盘 ===
    for (const [, conveyor] of this.conveyors) {
      const results = conveyor.movePallets(dt);
      for (const { pallet, reachedEnd } of results) {
        if (!reachedEnd) continue;

        // 托盘到达输送机末端 → 记录停留时间
        this.recordDwell(pallet);
        conveyor.removePallet(pallet);

        const downstream = this.getDownstream(conveyor.id, 'output');
        switch (downstream.kind) {
          case 'conveyor':
            if (downstream.model.canAcceptPallet()) {
              downstream.model.acceptPallet(pallet, 'input', this.simTime);
            } else {
              // 下游满 → 留在当前输送机最后一个分区
              pallet.isBlocked = true;
              pallet.currentZoneIndex = conveyor.getExitZoneIndex();
              pallet.progressInZone = 0.99;
              conveyor.zones[pallet.currentZoneIndex].occupied = true;
              conveyor.zones[pallet.currentZoneIndex].occupiedByPalletId = pallet.id;
              conveyor.pallets.push(pallet);
            }
            break;
          case 'transfer':
            if (downstream.model.receivePallet(pallet)) {
              // pallet 已进入移载机
            } else {
              pallet.isBlocked = true;
              pallet.progressInZone = 0.99;
              conveyor.pallets.push(pallet);
            }
            break;
          case 'forklift':
            if (downstream.model.role === 'consumer') {
              downstream.model.tick(dt);
              this.totalConsumed++;
              this.emitEvent('PALLET_CONSUMED', downstream.model.id, pallet.id);
              this.pallets.delete(pallet.id);
            }
            break;
          case 'none':
            // 末端无下游 → 托盘消失（记录丢失）
            this.pallets.delete(pallet.id);
            break;
        }
      }
    }

    // === 阶段 4：更新统计 ===
    this.tickNumber++;
    this.simTime += dt;

    this.checkCongestion();

    if (this.tickNumber % 20 === 1) {
      console.log('[Sim] tick=' + this.tickNumber + ' simTime=' + this.simTime.toFixed(1) + ' pallets=' + this.pallets.size);
    }

    this.sendFrameUpdate();

    // 每 20 ticks 发送统计
    if (this.tickNumber % 20 === 0) {
      this.sendStatistics();
    }
    } catch (err: any) {
      this.onEvent?.({ eventType: 'ERROR', simTime: 0, componentId: '', detail: 'tick error: ' + (err?.message || String(err)) });
    }
  }

  private sendFrameUpdate(): void {
    if (!this.onFrameUpdate) return;
    const pallets: PalletRuntimeState[] = [];
    for (const [, p] of this.pallets) {
      pallets.push({
        palletId: p.id,
        currentComponentId: p.currentComponentId,
        currentZoneIndex: p.currentZoneIndex,
        progressInZone: p.progressInZone,
        isBlocked: p.isBlocked,
        size: { ...p.size },
        worldRotation: p.worldRotation,
      });
    }

    const transferStates: TransferRuntimeState[] = [];
    for (const [, t] of this.transfers) {
      transferStates.push({
        transferId: t.id,
        processingPalletId: t.processingPallet?.id ?? null,
        remainingActionTime: t.remainingActionTime,
        targetPort: t.targetPort,
      });
    }

    const zoneStates: Record<string, ZoneState[]> = {};
    for (const [, c] of this.conveyors) {
      zoneStates[c.id] = c.zones;
    }

    const forkliftCooldowns: Record<string, number> = {};
    for (const [, f] of this.forklifts) {
      forkliftCooldowns[f.id] = f.remainingCooldown;
    }

    this.onFrameUpdate({
      tickNumber: this.tickNumber,
      simTime: this.simTime,
      pallets,
      transferStates,
      forkliftCooldowns,
      zoneStates,
    });
  }

  private recordDwell(pallet: PalletModel): void {
    const compId = pallet.currentComponentId;
    const dwell = this.simTime - pallet.enterTime;
    if (dwell <= 0) return;

    const stats = this.dwellStats[compId];
    if (!stats) {
      this.dwellStats[compId] = { totalSec: dwell, count: 1, maxSec: dwell };
    } else {
      stats.totalSec += dwell;
      stats.count++;
      if (dwell > stats.maxSec) stats.maxSec = dwell;
    }
  }

  private checkCongestion(): void {
    for (const [, conv] of this.conveyors) {
      const util = conv.utilization;
      const isCongested = util >= 0.85;
      const wasCongested = this.congestionStart[conv.id] !== undefined;

      if (isCongested && !wasCongested) {
        this.congestionStart[conv.id] = this.simTime;
      } else if (!isCongested && wasCongested) {
        this.congestionEvents.push({
          conveyorId: conv.id,
          startSec: this.congestionStart[conv.id],
          endSec: this.simTime,
        });
        delete this.congestionStart[conv.id];
      }
    }
  }

  private identifyBottleneck(): void {
    let worst = '';
    let worstScore = 0;
    for (const [id, stats] of Object.entries(this.dwellStats)) {
      const avgUtil = this.conveyors.get(id)?.utilization ?? 0;
      const score = stats.totalSec + avgUtil * 100;
      if (score > worstScore) {
        worstScore = score;
        worst = id;
      }
    }
    this.bottleneckId = worst || null;
  }

  private sendStatistics(): void {
    if (!this.onStatistics) return;
    const conveyorUtilization: Record<string, number> = {};
    for (const [, c] of this.conveyors) {
      conveyorUtilization[c.id] = c.utilization;
    }

    const overallThroughput =
      this.simTime > 0 ? (this.totalConsumed / this.simTime) * 3600 : 0;

    this.onStatistics({
      conveyorUtilization,
      overallThroughput,
      transferActionCounts: { ...this.transferActionCounts },
      dwellStats: { ...this.dwellStats },
      congestionEvents: [...this.congestionEvents],
      bottleneckId: this.bottleneckId,
    });
  }

  private emitEvent(
    eventType: string,
    componentId: string,
    palletId?: string,
    detail?: string,
  ): void {
    this.onEvent?.({
      eventType,
      simTime: this.simTime,
      componentId,
      palletId,
      detail,
    });
  }
}
