export interface Donor {
  id: string;
  firstName: string;
  lastName?: string;
  block?: string;
  house?: string;
  bags: number;
  paymentType?: 'Banco' | 'Efectivo' | 'Material';
  date: string;
  createdAt: any;
}

export interface ProjectSettings {
  bagsGoal: number;
  donorsGoal: number;
  linearMeters: number;
  costPerBag: number;
  logoUrl?: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}
