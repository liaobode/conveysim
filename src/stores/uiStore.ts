import { defineStore } from 'pinia';

export type ToastType = 'error' | 'warn' | 'info';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface UIState {
  propertyPanelVisible: boolean;
  dataPanelVisible: boolean;
  saveDialogVisible: boolean;
  loadDialogVisible: boolean;
  batchDialogVisible: boolean;
  autoSaveTimestamp: number | null;
  toasts: ToastItem[];
}

export const useUIStore = defineStore('ui', {
  state: (): UIState => ({
    propertyPanelVisible: true,
    dataPanelVisible: false,
    saveDialogVisible: false,
    loadDialogVisible: false,
    batchDialogVisible: false,
    autoSaveTimestamp: null,
    toasts: [],
  }),

  actions: {
    togglePropertyPanel(): void {
      this.propertyPanelVisible = !this.propertyPanelVisible;
    },
    toggleDataPanel(): void {
      this.dataPanelVisible = !this.dataPanelVisible;
    },
    openSaveDialog(): void {
      this.saveDialogVisible = true;
    },
    closeSaveDialog(): void {
      this.saveDialogVisible = false;
    },
    openLoadDialog(): void {
      this.loadDialogVisible = true;
    },
    closeLoadDialog(): void {
      this.loadDialogVisible = false;
    },
    openBatchDialog(): void {
      this.batchDialogVisible = true;
    },
    closeBatchDialog(): void {
      this.batchDialogVisible = false;
    },
    addToast(message: string, type: ToastType): void {
      const id = Date.now();
      this.toasts.push({ id, message, type });
      setTimeout(() => {
        this.toasts = this.toasts.filter((t) => t.id !== id);
      }, 5000);
    },
    removeToast(id: number): void {
      this.toasts = this.toasts.filter((t) => t.id !== id);
    },
  },
});
