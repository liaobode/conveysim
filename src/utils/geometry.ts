export const PIXELS_PER_METER = 50;

export function metersToPixels(meters: number): number {
  return meters * PIXELS_PER_METER;
}

export function pixelsToMeters(pixels: number): number {
  return pixels / PIXELS_PER_METER;
}

export interface Point {
  x: number;
  y: number;
}

/** 屏幕上某点转换为世界坐标（考虑视口偏移和缩放） */
export function screenToWorld(
  screenX: number,
  screenY: number,
  viewport: { x: number; y: number; scale: number },
  canvasRect: DOMRect,
): Point {
  const localX = screenX - canvasRect.left;
  const localY = screenY - canvasRect.top;
  return {
    x: (localX - viewport.x) / viewport.scale,
    y: (localY - viewport.y) / viewport.scale,
  };
}

/** 计算输送机端口的世界坐标 */
export function getConveyorPort(
  cx: number,
  cy: number,
  rotation: number,
  lengthMeters: number,
  port: 'input' | 'output',
): Point {
  const halfLen = metersToPixels(lengthMeters) / 2;
  const sign = port === 'input' ? -1 : 1;
  return {
    x: cx + sign * halfLen * Math.cos(rotation),
    y: cy + sign * halfLen * Math.sin(rotation),
  };
}

/** 获取任意组件的端口世界坐标 */
export function getComponentPortPos(
  compId: string,
  portName: string,
  conveyors: Record<string, { x: number; y: number; rotation: number; length: number }>,
  transfers: Record<string, { x: number; y: number }>,
  forklifts: Record<string, { x: number; y: number }>,
): Point | null {
  const conv = conveyors[compId];
  if (conv) {
    return getConveyorPort(conv.x, conv.y, conv.rotation, conv.length, portName === 'input' ? 'input' : 'output');
  }
  const trans = transfers[compId];
  if (trans) {
    const half = 25;
    switch (portName) {
      case 'north': return { x: trans.x, y: trans.y - half };
      case 'south': return { x: trans.x, y: trans.y + half };
      case 'east': return { x: trans.x + half, y: trans.y };
      case 'west': return { x: trans.x - half, y: trans.y };
    }
  }
  const fork = forklifts[compId];
  if (fork) {
    return { x: fork.x + 26, y: fork.y };
  }
  return null;
}

/** 两点之间的距离 */
export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** 角度归一化到 [0, 2PI) */
export function normalizeAngle(angle: number): number {
  const twoPI = Math.PI * 2;
  return ((angle % twoPI) + twoPI) % twoPI;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** 计算旋转矩形的轴对齐包围盒 */
function rotatedRectBounds(
  cx: number, cy: number, hw: number, hh: number, angle: number,
): Bounds {
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));
  const halfSpanX = hw * cos + hh * sin;
  const halfSpanY = hw * sin + hh * cos;
  return {
    minX: cx - halfSpanX,
    minY: cy - halfSpanY,
    maxX: cx + halfSpanX,
    maxY: cy + halfSpanY,
  };
}

/** 计算所有组件的包围盒（世界坐标） */
export function computeComponentsBounds(
  conveyors: { x: number; y: number; rotation: number; length: number; width: number }[],
  transfers: { x: number; y: number }[],
  forklifts: { x: number; y: number }[],
): Bounds {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const c of conveyors) {
    const lenPx = metersToPixels(c.length);
    const wPx = metersToPixels(c.width);
    const b = rotatedRectBounds(c.x, c.y, lenPx / 2, wPx / 2, c.rotation);
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  }

  for (const t of transfers) {
    minX = Math.min(minX, t.x - 25);
    minY = Math.min(minY, t.y - 25);
    maxX = Math.max(maxX, t.x + 25);
    maxY = Math.max(maxY, t.y + 25);
  }

  for (const f of forklifts) {
    minX = Math.min(minX, f.x - 20);
    minY = Math.min(minY, f.y - 15);
    maxX = Math.max(maxX, f.x + 20);
    maxY = Math.max(maxY, f.y + 15);
  }

  return { minX, minY, maxX, maxY };
}
