import { defineStore } from 'pinia';

export type ToolType =
  | 'select'
  | 'chain-conveyor'
  | 'roller-conveyor'
  | 'transfer-machine'
  | 'forklift-generator'
  | 'forklift-consumer'
  | 'wire';

export interface ClipboardEntry {
  type: 'conveyor' | 'transfer' | 'forklift';
  data: Record<string, unknown>;
}

interface EditorState {
  activeTool: ToolType;
  selectedComponentId: string | null;
  selectedComponentIds: string[];
  selectedConnectionId: string | null;
  hoveredComponentId: string | null;
  viewport: { x: number; y: number; scale: number };
  snapEnabled: boolean;
  showGrid: boolean;
  mouseWorldPos: { x: number; y: number };
  shiftHeld: boolean;
  clipboard: ClipboardEntry[];
  fitViewCounter: number;
}

export const useEditorStore = defineStore('editor', {
  state: (): EditorState => ({
    activeTool: 'select',
    selectedComponentId: null,
    selectedComponentIds: [],
    selectedConnectionId: null,
    hoveredComponentId: null,
    viewport: { x: 0, y: 0, scale: 1 },
    snapEnabled: true,
    showGrid: true,
    mouseWorldPos: { x: 0, y: 0 },
    shiftHeld: false,
    clipboard: [],
    fitViewCounter: 0,
  }),

  getters: {
    isMultiSelect: (s) => s.selectedComponentIds.length > 1,
  },

  actions: {
    setTool(tool: ToolType): void {
      this.activeTool = tool;
      this.deselectAll();
    },

    selectComponent(id: string | null): void {
      this.selectedComponentId = id;
      this.selectedConnectionId = null;
      if (id) {
        this.selectedComponentIds = [id];
      } else {
        this.selectedComponentIds = [];
      }
    },

    selectMultiple(ids: string[]): void {
      this.selectedComponentIds = ids;
      this.selectedComponentId = ids.length > 0 ? ids[0] : null;
      this.selectedConnectionId = null;
    },

    deselectAll(): void {
      this.selectedComponentId = null;
      this.selectedComponentIds = [];
      this.selectedConnectionId = null;
    },

    selectConnection(id: string | null): void {
      this.selectedComponentId = null;
      this.selectedComponentIds = [];
      this.selectedConnectionId = id;
    },

    setViewport(x: number, y: number, scale: number): void {
      this.viewport.x = x;
      this.viewport.y = y;
      this.viewport.scale = scale;
    },

    setMouseWorldPos(x: number, y: number): void {
      this.mouseWorldPos.x = x;
      this.mouseWorldPos.y = y;
    },

    copyToClipboard(entries: ClipboardEntry[]): void {
      this.clipboard = entries;
    },

    clearClipboard(): void {
      this.clipboard = [];
    },

    requestFitView(): void {
      this.fitViewCounter++;
    },
  },
});
