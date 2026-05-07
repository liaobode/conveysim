import type { MainToWorkerMessage, WorkerToMainMessage } from '../types';
import { Simulation } from './Simulation';

let simulation: Simulation | null = null;

function postMsg(msg: WorkerToMainMessage): void {
  (self as any).postMessage(msg);
}

self.onmessage = (e: MessageEvent<MainToWorkerMessage>) => {
  try {
    const msg = e.data;

    switch (msg.type) {
      case 'INIT_SIMULATION': {
        simulation = new Simulation({
          onFrameUpdate: (payload) => {
            postMsg({ type: 'FRAME_UPDATE', payload });
          },
          onStatistics: (payload) => {
            postMsg({ type: 'STATISTICS', payload });
          },
          onEvent: (payload) => {
            postMsg({ type: 'SIMULATION_EVENT', payload });
          },
        });
        simulation.init(msg.payload.scene, msg.payload.tickIntervalMs);
        postMsg({ type: 'READY' });
        break;
      }

      case 'START':
        simulation?.start();
        break;

      case 'PAUSE':
        simulation?.pause();
        break;

      case 'RESUME':
        simulation?.resume();
        break;

      case 'STOP':
        simulation?.stop();
        break;

      case 'STEP':
        simulation?.step();
        break;

      case 'SET_SPEED':
        simulation?.setSpeed(msg.multiplier);
        break;

      case 'UPDATE_TOPOLOGY':
        if (simulation) {
          simulation.init(msg.payload, 50);
        }
        break;
    }
  } catch (err: any) {
    postMsg({ type: 'ERROR', message: 'Worker error: ' + (err?.message || String(err)) });
  }
};

export {};
