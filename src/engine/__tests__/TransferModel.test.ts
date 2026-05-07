import { describe, it, expect } from 'vitest';
import { TransferModel } from '../TransferModel';
import { PalletModel } from '../PalletModel';
import type { TransferMachineData } from '../../types';

function makeTransferData(overrides: Partial<TransferMachineData> = {}): TransferMachineData {
  return {
    id: 'trans-test',
    x: 100,
    y: 200,
    actionTime: 2,
    routingTable: { 'sink-1': 'south', 'sink-2': 'east' },
    defaultRoute: 'north',
    rotatePallet: false,
    ...overrides,
  };
}

function makePallet(id = 'pal-1', destination = 'sink-1'): PalletModel {
  return new PalletModel(id, destination);
}

describe('TransferModel', () => {
  it('starts processing immediately when idle', () => {
    const model = new TransferModel(makeTransferData());
    const pallet = makePallet();
    const accepted = model.receivePallet(pallet);
    expect(accepted).toBe(true);
    expect(model.processingPallet).toBe(pallet);
  });

  it('routing table matches destination to port', () => {
    const model = new TransferModel(makeTransferData());
    const pallet = makePallet('pal-1', 'sink-1');
    model.receivePallet(pallet);
    // targetPort 由 routingTable[sink-1] → south
    expect(model.targetPort).toBe('south');
  });

  it('falls back to defaultRoute when destination not in table', () => {
    const model = new TransferModel(makeTransferData());
    const pallet = makePallet('pal-2', 'unknown-sink');
    model.receivePallet(pallet);
    expect(model.targetPort).toBe('north');
  });

  it('decrements remaining action time', () => {
    const model = new TransferModel(makeTransferData({ actionTime: 2 }));
    model.receivePallet(makePallet());
    expect(model.remainingActionTime).toBe(2);
    model.tick(0.5);
    expect(model.remainingActionTime).toBeLessThan(2);
  });

  it('completes action after enough time and returns result', () => {
    const model = new TransferModel(makeTransferData({ actionTime: 1 }));
    const pallet = makePallet();
    model.receivePallet(pallet);

    // 还不够
    let result = model.tick(0.5);
    expect(result).toBeNull();

    // 时间到
    result = model.tick(0.6);
    expect(result).not.toBeNull();
    expect(result!.pallet).toBe(pallet);
    expect(result!.targetPort).toBe('south');
    expect(model.processingPallet).toBeNull();
  });

  it('queues pallets when busy', () => {
    const model = new TransferModel(makeTransferData());
    model.receivePallet(makePallet('pal-1'));
    const accepted = model.receivePallet(makePallet('pal-2'));
    expect(accepted).toBe(true);
    expect(model.inputQueue.length).toBe(1);
  });

  it('rejects when queue is full', () => {
    const model = new TransferModel(makeTransferData());
    model.receivePallet(makePallet('pal-1'));
    model.receivePallet(makePallet('pal-2'));
    model.receivePallet(makePallet('pal-3'));
    model.receivePallet(makePallet('pal-4'));
    const accepted = model.receivePallet(makePallet('pal-5'));
    expect(accepted).toBe(false);
  });

  it('processes next queued pallet after current completes', () => {
    const model = new TransferModel(makeTransferData({ actionTime: 1 }));
    model.receivePallet(makePallet('pal-1', 'sink-1'));
    model.receivePallet(makePallet('pal-2', 'sink-2'));

    // 完成 pal-1
    const result = model.tick(1.0);
    expect(result!.pallet.id).toBe('pal-1');

    // 下一个 tick 从队列取出 pal-2 开始处理
    model.tick(0);
    expect(model.processingPallet).not.toBeNull();
    expect(model.processingPallet!.id).toBe('pal-2');
    expect(model.targetPort).toBe('east'); // sink-2 → east
  });
});
