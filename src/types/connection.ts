export interface PortId {
  componentId: string;
  portName: string;
}

export interface ConnectionData {
  id: string;
  from: PortId;
  to: PortId;
}

export interface PortGeometry {
  worldX: number;
  worldY: number;
  normalAngle: number;
}
