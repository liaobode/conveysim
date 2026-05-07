import { useCanvasStore } from '../../stores/canvasStore';
import { useEditorStore } from '../../stores/editorStore';
import type { ToolType } from '../../stores/editorStore';
import { screenToWorld } from '../../utils/geometry';

/** 处理从工具栏拖入画布，返回创建的组件 ID 或 null */
export function handleCanvasDrop(
  event: DragEvent,
  canvasRect: DOMRect,
  viewport: { x: number; y: number; scale: number },
): string | null {
  const rawType = event.dataTransfer?.getData('application/conveysim-component');
  if (!rawType || rawType === 'select' || rawType === 'wire') return null;
  const toolType = rawType as ToolType;

  const canvasStore = useCanvasStore();
  const editorStore = useEditorStore();
  const pos = screenToWorld(event.clientX, event.clientY, viewport, canvasRect);

  let newId: string | null = null;

  switch (toolType) {
    case 'chain-conveyor':
      newId = canvasStore.addConveyor('chain', pos.x, pos.y);
      break;
    case 'roller-conveyor':
      newId = canvasStore.addConveyor('roller', pos.x, pos.y);
      break;
    case 'transfer-machine':
      newId = canvasStore.addTransferMachine(pos.x, pos.y);
      break;
    case 'forklift-generator':
      newId = canvasStore.addForklift(pos.x, pos.y, 'generator');
      break;
    case 'forklift-consumer':
      newId = canvasStore.addForklift(pos.x, pos.y, 'consumer');
      break;
  }

  editorStore.setTool('select');
  return newId;
}
