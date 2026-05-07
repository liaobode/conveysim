import type { SceneJSON } from '../types';

const DRAFT_KEY = 'conveysim-draft';

export function exportToJSON(scene: SceneJSON): string {
  return JSON.stringify(scene, null, 2);
}

export function importFromJSON(json: string): SceneJSON {
  const data = JSON.parse(json);
  if (!data.version || !Array.isArray(data.conveyors)) {
    throw new Error('Invalid scene file format');
  }
  return data as SceneJSON;
}

export function saveDraft(scene: SceneJSON): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(scene));
  } catch {
    // localStorage full or unavailable
  }
}

export function loadDraft(): SceneJSON | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SceneJSON;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  localStorage.removeItem(DRAFT_KEY);
}

export function downloadJSON(scene: SceneJSON, filename = 'conveysim-scene.json'): void {
  const json = exportToJSON(scene);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function uploadJSON(): Promise<SceneJSON> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return reject(new Error('No file selected'));
      const reader = new FileReader();
      reader.onload = () => {
        try {
          resolve(importFromJSON(reader.result as string));
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    };
    input.click();
  });
}
