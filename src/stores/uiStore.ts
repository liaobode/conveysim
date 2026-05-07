import { defineStore } from 'pinia';

interface UIState {
  propertyPanelVisible: boolean;
  dataPanelVisible: boolean;
  saveDialogVisible: boolean;
  loadDialogVisible: boolean;
  autoSaveTimestamp: number | null;
}

export const useUIStore = defineStore('ui', {
  state: (): UIState => ({
    propertyPanelVisible: true,
    dataPanelVisible: false,
    saveDialogVisible: false,
    loadDialogVisible: false,
    autoSaveTimestamp: null,
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
  },
});
