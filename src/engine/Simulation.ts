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
          downstream.model.acceptPallet(pallet);
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
          downstream.model.acceptPallet(result.pallet);
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

        // 托盘到达输送机末端
        conveyor.removePallet(pallet);

        const downstream = this.getDownstream(conveyor.id, 'output');
        switch (downstream.kind) {
          case 'conveyor':
            if (downstream.model.canAcceptPallet()) {
              downstream.model.acceptPallet(pallet);
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
