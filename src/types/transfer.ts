export interface TransferMachineData {
  id: string;
  x: number;
  y: number;
  actionTime: number;
  routingTable: Record<string, string>;
  defaultRoute: string;
}

export interface TransferRuntimeState {
  transferId: string;
  processingPalletId: string | null;
  remainingActionTime: number;
  targetPort: string | null;
}
