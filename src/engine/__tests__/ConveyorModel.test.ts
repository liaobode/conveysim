import { describe, it, expect } from 'vitest';
import { ConveyorModel } from '../ConveyorModel';
import { PalletModel } from '../PalletModel';
import type { ConveyorData } from '../../types';

function makeConveyorData(overrides: Partial<ConveyorData> = {}): ConveyorData {
  return {
    id: 'conv-test',
    type: 'chain',
    x: 0,
    y: 0,
    rotation: 0,
    length: 6,
    width: 0.8,
    speed: 1,
    direction: 'forward',
    zoneSpacing: 1.5,
    ...overrides,
  };
}

function makePallet(id = 'pal-1', destination = 'sink'): PalletModel {
  return new PalletModel(id, destination);
}

describe('ConveyorModel', () => {
  it('has correct zone count based on length and spacing', () => {
    const conv = new ConveyorModel(makeConveyorData({ length: 6, zoneSpacing: 1.5 }));
    expect(conv.zoneCount).toBe(4); // floor(6 / 1.5)
  });

  it('accepts pallet at entry zone', () => {
    const conv = new ConveyorModel(makeConveyorData());
    const pallet = makePallet();
    conv.acceptPallet(pallet, 'input', 0);
    expect(conv.pallets.length).toBe(1);
    expect(conv.zones[0].occupied).toBe(true);
    expect(pallet.currentZoneIndex).toBe(0);
  });

  it('moves pallet forward over time', () => {
    const conv = new ConveyorModel(makeConveyorData({ speed: 1, length: 6, zoneSpacing: 1.5 }));
    const pallet = makePallet();
    conv.acceptPallet(pallet, 'input', 0);

    // dt=1.5s, speed=1m/s → 移动 1.5m = 1 个分区
    const results = conv.movePallets(1.5);
    expect(results.length).toBe(0); // 还没到末端
    expect(pallet.currentZoneIndex).toBe(1);
    expect(pallet.progressInZone).toBe(0);
    expect(conv.zones[1].occupied).toBe(true);
    expect(conv.zones[0].occupied).toBe(false);
  });

  it('marks reachedEnd when pallet exits last zone', () => {
    const conv = new ConveyorModel(makeConveyorData({ speed: 1, length: 3, zoneSpacing: 1.5 }));
    // zoneCount = floor(3/1.5) = 2
    const pallet = makePallet();
    conv.acceptPallet(pallet, 'input', 0);

    // dt=3s, speed=1m/s → 移动 3m = 2 个分区，刚好超出
    const results = conv.movePallets(3.0);
    expect(results.length).toBe(1);
    expect(results[0].pallet).toBe(pallet);
    expect(results[0].reachedEnd).toBe(true);
  });

  it('blocks pallet when next zone is occupied (ZPA)', () => {
    const conv = new ConveyorModel(makeConveyorData({ speed: 1, length: 6, zoneSpacing: 1.5 }));
    // zoneCount = 4
    const pallet1 = makePallet('pal-1');
    const pallet2 = makePallet('pal-2');

    conv.acceptPallet(pallet1, 'input', 0);
    conv.movePallets(0.75); // pallet1 移动半分区

    conv.acceptPallet(pallet2, 'input', 0);
    // pallet2 在 zone 0，pallet1 在 zone 0 内前进中

    // 加速推进 pallet2，试图追上
    const results = conv.movePallets(3.0);
    // pallet2 应被 pallet1 阻塞（前方分区被占）
    expect(pallet2.isBlocked).toBe(true);
    // 阻塞的托盘不应到达末端
    const blocked = results.find(r => r.pallet.id === 'pal-2' && r.reachedEnd);
    expect(blocked).toBeUndefined();
  });

  it('removes pallet correctly', () => {
    const conv = new ConveyorModel(makeConveyorData());
    const pallet = makePallet();
    conv.acceptPallet(pallet, 'input', 0);
    conv.removePallet(pallet);
    expect(conv.pallets.length).toBe(0);
    expect(conv.zones[0].occupied).toBe(false);
  });

  it('empty conveyor returns no results', () => {
    const conv = new ConveyorModel(makeConveyorData());
    const results = conv.movePallets(1.0);
    expect(results.length).toBe(0);
  });

  it('calculates utilization correctly', () => {
    const conv = new ConveyorModel(makeConveyorData({ length: 3, zoneSpacing: 1.5 }));
    // zoneCount = 2
    expect(conv.utilization).toBe(0);
    conv.acceptPallet(makePallet(), 'input', 0);
    expect(conv.utilization).toBe(0.5); // 1/2
  });
});
