import type { ConveyorData, ZoneState } from '../types';
import type { PalletModel } from './PalletModel';

export class ConveyorModel {
  id: string;
  type: 'chain' | 'roller';
  length: number;
  speed: number;
  direction: 1 | -1;
  bidirectional: boolean;
  zoneSpacing: number;
  zones: ZoneState[];
  zoneCount: number;
  maxCapacity: number;
  pallets: PalletModel[] = [];

  constructor(data: ConveyorData) {
    this.id = data.id;
    this.type = data.type;
    this.length = data.length;
    this.speed = data.speed;
    this.direction = 1; // 默认正向
    this.bidirectional = data.direction === 'bidirectional';
    this.zoneSpacing = data.zoneSpacing;

    this.zoneCount = Math.max(1, Math.floor(data.length / data.zoneSpacing));
    this.maxCapacity = this.zoneCount;
    this.zones = Array.from({ length: this.zoneCount }, (_, i) => ({
      index: i,
      occupied: false,
      occupiedByPalletId: null,
    }));
  }

  getEntryZoneIndex(): number {
    return this.direction === 1 ? 0 : this.zoneCount - 1;
  }

  getExitZoneIndex(): number {
    return this.direction === 1 ? this.zoneCount - 1 : 0;
  }

  /** 检查指定端口方向的入口分区是否空闲 */
  canAcceptPallet(fromPort = 'input'): boolean {
    // 双向模式下，两个端口都能接收
    if (this.bidirectional) {
      const inputIdx = fromPort === 'output' ? this.getExitZoneIndex() : this.getEntryZoneIndex();
      return !this.zones[inputIdx].occupied;
    }
    return !this.zones[this.getEntryZoneIndex()].occupied;
  }

  acceptPallet(pallet: PalletModel, fromPort = 'input'): void {
    let idx = this.getEntryZoneIndex();
    // 双向：从 output 端口进入 → 逆方向
    if (this.bidirectional && fromPort === 'output') {
      idx = this.getExitZoneIndex();
      pallet._reverseFlow = true;
    }
    this.zones[idx].occupied = true;
    this.zones[idx].occupiedByPalletId = pallet.id;
    pallet.currentComponentId = this.id;
    pallet.currentZoneIndex = idx;
    pallet.progressInZone = 0;
    pallet.isBlocked = false;
    this.pallets.push(pallet);
  }

  removePallet(pallet: PalletModel): void {
    const zone = this.zones[pallet.currentZoneIndex];
    if (zone && zone.occupiedByPalletId === pallet.id) {
      zone.occupied = false;
      zone.occupiedByPalletId = null;
    }
    const idx = this.pallets.indexOf(pallet);
    if (idx >= 0) this.pallets.splice(idx, 1);
  }

  /** 每 tick 移动所有托盘，返回到达末端需要转移的托盘列表 */
  movePallets(deltaTimeSec: number): { pallet: PalletModel; reachedEnd: boolean }[] {
    const results: { pallet: PalletModel; reachedEnd: boolean }[] = [];

    // 按流动方向排序（下游优先，后堵会影响前）
    const sorted = [...this.pallets].sort((a, b) => {
      const dirA = a._reverseFlow ? -this.direction : this.direction;
      // 流向相同的排在一起，末端优先
      const aEnd = dirA === 1 ? this.zoneCount - 1 - a.currentZoneIndex : a.currentZoneIndex;
      const bEnd = dirA === 1 ? this.zoneCount - 1 - b.currentZoneIndex : b.currentZoneIndex;
      return bEnd - aEnd;
    });

    for (const pallet of sorted) {
      const palDir = pallet._reverseFlow ? -this.direction : this.direction;

      // ZPA 检查：下一个分区是否被占？
      const nextIdx = pallet.currentZoneIndex + palDir;
      if (nextIdx >= 0 && nextIdx < this.zoneCount) {
        if (
          this.zones[nextIdx].occupied &&
          this.zones[nextIdx].occupiedByPalletId !== pallet.id
        ) {
          pallet.isBlocked = true;
          continue;
        }
      }

      // 未阻塞 → 移动
      pallet.isBlocked = false;
      const distance = this.speed * deltaTimeSec;             // 本 tick 移动距离 (米)
      const progressDelta = distance / this.zoneSpacing;       // 转换为分区进度增量
      pallet.progressInZone += progressDelta;

      // 跨分区处理
      while (pallet.progressInZone >= 1.0) {
        pallet.progressInZone -= 1.0;
        // 离开当前分区
        this.zones[pallet.currentZoneIndex].occupied = false;
        this.zones[pallet.currentZoneIndex].occupiedByPalletId = null;

        const newIdx = pallet.currentZoneIndex + palDir;

        // 到达输送机末端
        if (newIdx < 0 || newIdx >= this.zoneCount) {
          pallet.currentZoneIndex = newIdx; // 越界标记
          results.push({ pallet, reachedEnd: true });
          break;
        }

        // 目标分区被占 → 卡在当前分区边界
        if (this.zones[newIdx].occupied) {
          pallet.progressInZone = 0;
          pallet.isBlocked = true;
          // 留在当前分区（不进入新分区）
          this.zones[pallet.currentZoneIndex].occupied = true;
          this.zones[pallet.currentZoneIndex].occupiedByPalletId = pallet.id;
          break;
        }

        // 进入新分区
        pallet.currentZoneIndex = newIdx;
        this.zones[newIdx].occupied = true;
        this.zones[newIdx].occupiedByPalletId = pallet.id;
      }
    }

    return results;
  }

  /** 利用率 */
  get utilization(): number {
    let occupied = 0;
    for (const z of this.zones) {
      if (z.occupied) occupied++;
    }
    return occupied / this.zoneCount;
  }
}
