export type Role = 'ADMIN' | 'TECHNICIAN';
export type Status = 'RECEIVED' | 'UNDER_REVIEW' | 'IN_REPAIR' | 'RESOLVED';
export type Category = 'HARDWARE' | 'SOFTWARE' | 'CONNECTIVITY' | 'FURNITURE' | 'OTHER';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH';
export type OperationalStatus = 'OPERATIVE' | 'OUT_OF_SERVICE' | 'MAINTENANCE';
export type Session = { id: string; email: string; role: Role };
export type Equipment = { id: string; code: string; name: string; type: string; location: string; operationalStatus: OperationalStatus; publicToken: string; createdAt: string; incidentCount: number };
export type PublicEquipment = Pick<Equipment, 'code' | 'name' | 'type' | 'location' | 'operationalStatus'>;
export type Incident = {
  id: string; category: Category; description: string; priority: Priority; status: Status;
  trackingCode: string; createdAt: string; updatedAt: string;
  equipmentName: string; equipmentCode: string; location: string;
};
export type Event = {
  id: string; eventType: 'CREATED' | 'STATUS_CHANGED' | 'INTERNAL_NOTE';
  previousStatus: Status | null; nextStatus: Status | null; note: string | null;
  createdAt: string; actorEmail: string | null;
};
export type IncidentDetail = {
  id: string; tracking_code: string; status: Status; category: Category; priority: Priority;
  description: string; created_at: string; updated_at: string; resolved_at: string | null;
  equipmentName: string; equipmentCode: string; location: string; equipmentToken: string;
  events: Event[];
};
export type Tracking = {
  trackingCode: string; category: Category; priority: Priority; status: Status;
  createdAt: string; updatedAt: string; resolvedAt: string | null;
  equipmentName: string; equipmentCode: string; location: string;
};
export type Stats = { equipment: number; total: number; received: number; review: number; repair: number; resolved: number };
export const statusLabels: Record<Status, string> = {
  RECEIVED: 'Recibido', UNDER_REVIEW: 'En revisión', IN_REPAIR: 'En reparación', RESOLVED: 'Resuelto',
};
export const categoryLabels: Record<Category, string> = {
  HARDWARE: 'Hardware', SOFTWARE: 'Software', CONNECTIVITY: 'Conectividad', FURNITURE: 'Mobiliario', OTHER: 'Otro',
};
export const priorityLabels: Record<Priority, string> = { LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta' };
export const operationalLabels: Record<OperationalStatus, string> = { OPERATIVE: 'Operativo', OUT_OF_SERVICE: 'Fuera de servicio', MAINTENANCE: 'En mantenimiento' };
export const statusOrder: Status[] = ['RECEIVED', 'UNDER_REVIEW', 'IN_REPAIR', 'RESOLVED'];
export const formatDate = (value: string) => new Date(value).toLocaleString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
export const formatShortDate = (value: string) => new Date(value).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
