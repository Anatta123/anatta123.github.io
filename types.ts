
export enum ServiceStatus {
  SCHEDULED = 'Programado',
  IN_PROGRESS = 'En Progreso',
  COMPLETED = 'Completado',
  CANCELLED = 'Cancelado',
  PENDING = 'Pendiente'
}

export enum ServiceType {
  NEW_INSTALLATION = 'Nueva Instalación',
  MAINTENANCE = 'Mantenimiento',
  REPAIR = 'Reparación',
  UPGRADE = 'Actualización',
  CONSULTATION = 'Consulta',
  NEW_IP_CAMERA_INSTALLATION = 'Nueva instalacion de camaras IP',
  NEW_DVR_INSTALLATION = 'Nueva instalacion dvr'
}

export interface Client {
  id: string;
  clientName: string;
  nitCliente: string; // Mandatory
  telefonoCliente: string; // Mandatory
  address: string; // Client's primary address, mandatory
  email?: string; // Optional
}

export interface Service {
  id: string;
  clientId: string; // Links to Client
  serviceAddress: string; // Specific address for this service, mandatory
  numIpCameras?: number; // Added for number of IP cameras
  qrDeviceFotos?: string[]; // Changed from qrDeviceFoto to handle multiple QR photos
  deviceLabelFoto?: string; // Remains singular for now
  numDvrCameras?: number; // Added for number of DVR cameras
  dvrCameraFotos?: string[]; // Added for DVR camera photos
  date: string; // ISO string format for date e.g. "2024-07-28"
  serviceType: string; // Uses ServiceType enum string values
  description: string;
  technician: string;
  status: string; // Uses ServiceStatus enum string values
  cost?: number;
  notes?: string;
}

// For Toast Notifications
export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
}