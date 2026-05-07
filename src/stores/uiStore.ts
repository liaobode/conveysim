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
  shortcutPanelVisible: boolean;
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
    shortcutPanelVisible: false,
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
      // 去重：相同消息已存在则跳过
      if (this.toasts.some((t) => t.message === message)) return;
      // 限制最大显示数
      if (this.toasts.length >= 3) {
        this.toasts.shift();
      }
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
