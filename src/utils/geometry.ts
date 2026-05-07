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

/** 两点之间的距离 */
export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** 角度归一化到 [0, 2PI) */
export function normalizeAngle(angle: number): number {
  const twoPI = Math.PI * 2;
  return ((angle % twoPI) + twoPI) % twoPI;
}
