export interface PalletData {
  id: string;
  size: { width: number; height: number };
  destination: string;
}

export interface PalletRuntimeState {
  palletId: string;
  currentComponentId: string;
  currentZoneIndex: number;
  progressInZone: number;
  isBlocked: boolean;
  size: { width: number; height: number };
  worldRotation: number;
}
