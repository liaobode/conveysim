export class PalletModel {
  id: string;
  size: { width: number; height: number };
  destination: string;
  currentComponentId: string;
  currentZoneIndex: number;
  progressInZone: number;
  isBlocked: boolean;
  _reverseFlow: boolean;

  constructor(id: string, destination: string, size = { width: 1.2, height: 1.0 }) {
    this.id = id;
    this.destination = destination;
    this.size = size;
    this.currentComponentId = '';
    this.currentZoneIndex = -1;
    this.progressInZone = 0;
    this.isBlocked = false;
    this._reverseFlow = false;
  }
}
