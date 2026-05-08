import type { ConveyorData, TransferMachineData, ForkliftData } from '../types';

/** 组件 ID → 可读标签，优先显示用户设置的自定义名称 */
export function convLabel(
  id: string,
  conveyors: Record<string, ConveyorData>,
  transfers: Record<string, TransferMachineData>,
  forklifts: Record<string, ForkliftData>,
): string {
  const c = conveyors[id];
  if (c) return c.label || `${c.type === 'chain' ? '链条' : '滚筒'} ${id.slice(-4)}`;
  const t = transfers[id];
  if (t) return t.label || `移载机 ${id.slice(-4)}`;
  const f = forklifts[id];
  if (f) return f.label || `${f.role === 'generator' ? '发生器' : '消费者'} ${id.slice(-4)}`;
  return id;
}
