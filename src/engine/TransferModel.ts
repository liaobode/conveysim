import type { TransferMachineData } from '../types';
import type { PalletModel } from './PalletModel';

export interface TransferResult {
  pallet: PalletModel;
  targetPort: string;
}

export class TransferModel {
  id: string;
  actionTime: number;
  remainingActionTime: number;
  routingTable: Record<string, string>;
  defaultRoute: string;
  rotatePallet: boolean;
  processingPallet: PalletModel | null = null;
  targetPort: string | null = null;
  inputQueue: PalletModel[] = [];
  maxQueueSize = 3;

  constructor(data: TransferMachineData) {
    this.id = data.id;
    this.actionTime = data.actionTime;
    this.remainingActionTime = 0;
    this.routingTable = { ...data.routingTable };
    this.defaultRoute = data.defaultRoute;
    this.rotatePallet = data.rotatePallet ?? false;
  }

  receivePallet(pallet: PalletModel): boolean {
    if (this.processingPallet !== null) {
      if (this.inputQueue.length < this.maxQueueSize) {
        this.inputQueue.push(pallet);
        return true;
      }
      return false; // 队列满
    }
    this.startProcessing(pallet);
    return true;
  }

  private startProcessing(pallet: PalletModel): void {
    this.processingPallet = pallet;
    this.remainingActionTime = this.actionTime;
    this.targetPort = this.routingTable[pallet.destination] ?? this.defaultRoute;
    pallet.currentComponentId = this.id;
    pallet.currentZoneIndex = 0;
    pallet.progressInZone = 0;
    pallet.isBlocked = false;
  }

  tick(deltaTimeSec: number): TransferResult | null {
    // 空闲且队列有货
    if (this.processingPallet === null && this.inputQueue.length > 0) {
      this.startProcessing(this.inputQueue.shift()!);
    }

    if (this.processingPallet === null) return null;

    this.remainingActionTime -= deltaTimeSec;
    if (this.remainingActionTime <= 0) {
      const pallet = this.processingPallet;
      const target = this.targetPort!;
      this.processingPallet = null;
      this.targetPort = null;
      return { pallet, targetPort: target };
    }
    return null;
  }

  holdPallet(pallet: PalletModel): void {
    this.processingPallet = pallet;
    this.targetPort = this.routingTable[pallet.destination] ?? this.defaultRoute;
  }
}
