export interface TransferMachineData {
  id: string;
  label: string;
  x: number;
  y: number;
  actionTime: number;
  routingTable: Record<string, string>;
  defaultRoute: string;
  /** 是否需要旋转货物方向 */
  rotatePallet: boolean;
}

export interface TransferRuntimeState {
  transferId: string;
  processingPalletId: string | null;
  remainingActionTime: number;
  targetPort: string | null;
}
