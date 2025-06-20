
import { ServiceStatus, ServiceType } from './types';

export const SERVICE_STATUS_OPTIONS: string[] = Object.values(ServiceStatus);
export const SERVICE_TYPE_OPTIONS: string[] = Object.values(ServiceType);

export const DEFAULT_SERVICE_STATUS: string = ServiceStatus.PENDING;
export const DEFAULT_SERVICE_TYPE: string = ServiceType.NEW_INSTALLATION;