import { describe, it, expect } from 'vitest';
import { normalRandom, ForkliftModel } from '../ForkliftModel';
import type { ForkliftData } from '../../types';

describe('normalRandom', () => {
  it('returns values within reasonable range', () => {
    let within6Sigma = 0;
    for (let i = 0; i < 1000; i++) {
      const val = normalRandom(10, 2);
      if (val >= 10 - 12 && val <= 10 + 12) within6Sigma++;
    }
    // 6 sigma 覆盖率 > 99%
    expect(within6Sigma).toBeGreaterThan(990);
  });

  it('produces varying output', () => {
    const values = new Set<number>();
    for (let i = 0; i < 100; i++) {
      values.add(+normalRandom(10, 2).toFixed(4));
    }
    expect(values.size).toBeGreaterThan(10);
  });

  it('centers around mean with zero stdDev', () => {
    for (let i = 0; i < 100; i++) {
      const val = normalRandom(5, 0);
      // 当 stdDev = 0 时，sqrt(-2*ln(u))*0 = 0，返回 mean
      expect(val).toBe(5);
    }
  });
});

function makeForkliftData(overrides: Partial<ForkliftData> = {}): ForkliftData {
  return {
    id: 'fork-test',
    x: 100,
    y: 200,
    role: 'generator',
    interval: 2,
    fluctuation: 0,
    destinationTag: 'sink',
    palletSize: { width: 1.2, height: 1.0 },
    ...overrides,
  };
}

describe('ForkliftModel', () => {
  it('fires action on first tick (cooldown starts at 0)', () => {
    const model = new ForkliftModel(makeForkliftData());
    const action = model.tick(0.05);
    expect(action).toBe('generate');
    // 触发后冷却被重置
    expect(model.remainingCooldown).toBeGreaterThan(0);
  });

  it('waits for cooldown before next action', () => {
    const model = new ForkliftModel(makeForkliftData({ interval: 2 }));
    // 第一次 tick 立即触发
    expect(model.tick(0.05)).toBe('generate');
    // 冷却中
    expect(model.tick(0.05)).toBeNull();
    expect(model.tick(0.05)).toBeNull();
  });

  it('fires again after cooldown elapses', () => {
    const model = new ForkliftModel(makeForkliftData({ interval: 2 }));
    model.tick(0.05); // 首次触发，reset cooldown to ~2s
    // 推进大量时间以耗尽冷却
    expect(model.tick(2.0)).toBe('generate');
  });

  it('returns null during cooldown', () => {
    const model = new ForkliftModel(makeForkliftData({ interval: 5 }));
    model.tick(0.05); // 触发，冷却重置为 ~5s
    expect(model.tick(1.0)).toBeNull();
    expect(model.remainingCooldown).toBeGreaterThan(0);
  });

  it('produces variable intervals with fluctuation', () => {
    const model = new ForkliftModel(makeForkliftData({ interval: 2, fluctuation: 0.5 }));
    const cooldowns: number[] = [];
    model.tick(0.05); // 首次触发
    cooldowns.push(model.remainingCooldown);
    // 推进至冷却刚好归零（再触发一次）
    model.tick(model.remainingCooldown + 0.01);
    cooldowns.push(model.remainingCooldown);
    model.tick(model.remainingCooldown + 0.01);
    cooldowns.push(model.remainingCooldown);

    const unique = new Set(cooldowns.map(c => c.toFixed(4)));
    expect(unique.size).toBeGreaterThan(1);
  });

  it('consumer returns consume action', () => {
    const model = new ForkliftModel(makeForkliftData({ role: 'consumer' }));
    expect(model.tick(0.05)).toBe('consume');
  });
});
