import { defineStore } from 'pinia';
import type {
  ConveyorData,
  TransferMachineData,
  ForkliftData,
  PalletData,
  ConnectionData,
  SceneJSON,
} from '../types';
import { generateId } from '../utils/id';

interface CanvasState {
  conveyors: Record<string, ConveyorData>;
  transferMachines: Record<string, TransferMachineData>;
  forklifts: Record<string, ForkliftData>;
  pallets: Record<string, PalletData>;
  connections: Record<string, ConnectionData>;
  version: number;
  undoStack: string[];
}

const MAX_UNDO = 50;

export const useCanvasStore = defineStore('canvas', {
  state: (): CanvasState => ({
    conveyors: {},
    transferMachines: {},
    forklifts: {},
    pallets: {},
    connections: {},
    version: 0,
    undoStack: [],
  }),

  getters: {
    conveyorList: (s) => Object.values(s.conveyors),
    transferList: (s) => Object.values(s.transferMachines),
    forkliftList: (s) => Object.values(s.forklifts),
    palletList: (s) => Object.values(s.pallets),
    connectionList: (s) => Object.values(s.connections),

    getConveyorById: (s) => (id: string) => s.conveyors[id],
    getTransferById: (s) => (id: string) => s.transferMachines[id],
    getForkliftById: (s) => (id: string) => s.forklifts[id],

    /** 获取连接到某组件的所有下游组件 ID */
    getDownstreamIds: (s) => (componentId: string): string[] => {
      const ids: string[] = [];
      for (const conn of Object.values(s.connections)) {
        if (conn.from.componentId === componentId) {
          ids.push(conn.to.componentId);
        }
      }
      return ids;
    },

    /** 获取连接到某组件的所有上游组件 ID */
    getUpstreamIds: (s) => (componentId: string): string[] => {
      const ids: string[] = [];
      for (const conn of Object.values(s.connections)) {
        if (conn.to.componentId === componentId) {
          ids.push(conn.from.componentId);
        }
      }
      return ids;
    },

    toJSON: (s) => (): SceneJSON => ({
      version: 1,
      conveyors: Object.values(s.conveyors),
      transferMachines: Object.values(s.transferMachines),
      forklifts: Object.values(s.forklifts),
      pallets: Object.values(s.pallets),
      connections: Object.values(s.connections),
    }),
  },

  actions: {
    addConveyor(type: ConveyorData['type'], x: number, y: number, rotation = 0): string {
      const id = generateId('conv');
      const data: ConveyorData = {
        id, type, x, y, rotation,
        length: 3,
        width: 0.8,
        speed: 0.5,
        direction: 'forward',
        zoneSpacing: 1.5,
      };
      this.conveyors[id] = data;
      this.version++;
      return id;
    },

    addTransferMachine(x: number, y: number): string {
      const id = generateId('trans');
      this.transferMachines[id] = {
        id, x, y,
        actionTime: 2,
        routingTable: {},
        defaultRoute: 'straight',
        rotatePallet: false,
      };
      this.version++;
      return id;
    },

    addForklift(x: number, y: number, role: ForkliftData['role']): string {
      const id = generateId('fork');
      this.forklifts[id] = {
        id, x, y, role,
        interval: 60,
        fluctuation: 0,
        destinationTag: role === 'generator' ? 'sink-default' : '',
        palletSize: { width: 1.2, height: 1.0 },
      };
      this.version++;
      return id;
    },

    addPallet(destination = 'sink-default'): string {
      const id = generateId('pal');
      this.pallets[id] = {
        id,
        size: { width: 1.2, height: 1.0 },
        destination,
      };
      return id;
    },

    removeComponent(id: string): void {
      delete this.conveyors[id];
      delete this.transferMachines[id];
      delete this.forklifts[id];
      delete this.pallets[id];
      for (const connId of Object.keys(this.connections)) {
        const c = this.connections[connId];
        if (c.from.componentId === id || c.to.componentId === id) {
          delete this.connections[connId];
        }
      }
      this.version++;
    },

    updateConveyor(id: string, patch: Partial<ConveyorData>): void {
      if (this.conveyors[id]) {
        Object.assign(this.conveyors[id], patch);
      }
    },

    updateTransfer(id: string, patch: Partial<TransferMachineData>): void {
      if (this.transferMachines[id]) {
        Object.assign(this.transferMachines[id], patch);
      }
    },

    updateForklift(id: string, patch: Partial<ForkliftData>): void {
      if (this.forklifts[id]) {
        Object.assign(this.forklifts[id], patch);
      }
    },

    addConnection(fromComponent: string, fromPort: string, toComponent: string, toPort: string): string {
      const id = generateId('conn');
      this.connections[id] = {
        id,
        from: { componentId: fromComponent, portName: fromPort },
        to: { componentId: toComponent, portName: toPort },
      };
      this.version++;
      return id;
    },

    removeConnection(id: string): void {
      delete this.connections[id];
      this.version++;
    },

    loadFromJSON(json: SceneJSON): void {
      this.conveyors = {};
      this.transferMachines = {};
      this.forklifts = {};
      this.pallets = {};
      this.connections = {};
      for (const c of json.conveyors) this.conveyors[c.id] = { ...c };
      for (const t of json.transferMachines) this.transferMachines[t.id] = { ...t };
      for (const f of json.forklifts) this.forklifts[f.id] = { ...f };
      for (const p of json.pallets) this.pallets[p.id] = { ...p };
      for (const c of json.connections) this.connections[c.id] = { ...c };
      this.version++;
    },

    clear(): void {
      this.conveyors = {};
      this.transferMachines = {};
      this.forklifts = {};
      this.pallets = {};
      this.connections = {};
      this.version++;
    },

    /** 保存当前快照到撤销栈 */
    pushUndoSnapshot(): void {
      const json = JSON.stringify(this.toJSON());
      // 去重：如果和栈顶相同，不重复保存
      if (this.undoStack.length > 0 && this.undoStack[this.undoStack.length - 1] === json) return;
      this.undoStack.push(json);
      if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
    },

    /** Ctrl+Z 撤销 */
    undo(): boolean {
      if (this.undoStack.length === 0) return false;
      const json = this.undoStack.pop()!;
      const scene = JSON.parse(json) as SceneJSON;
      this.loadFromJSON(scene);
      return true;
    },
  },
});
