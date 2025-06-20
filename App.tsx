
import React, { useState, useEffect, useMemo, useCallback, createContext, useContext } from 'react';
import { Service, ServiceStatus, ServiceType, Client, ToastMessage, ToastType } from './types';
// import { useLocalStorage } from './hooks/useLocalStorage'; // Removed
import { supabase } from './lib/supabaseClient'; // Added
import type { ClientRow, ServiceRow, Database } from './types_db'; // Added Database for mapping
import Navbar from './components/Navbar';
import ServiceList from './components/ServiceList';
import Modal from './components/Modal';
import ServiceForm from './components/ServiceForm';
import ClientForm from './components/ClientForm';
import ClientList from './components/ClientList';
import Button from './components/Button';
import { PlusIcon, InformationCircleIcon, MagnifyingGlassIcon, ChevronUpDownIcon, EyeIcon, DownloadIcon, PdfFileIcon, WhatsAppIcon } from './components/Icons'; 
import Alert from './components/Alert';
import Spinner from './components/Spinner'; // Added for loading state
import { SERVICE_STATUS_OPTIONS } from './constants';
import jsPDF from 'jspdf';

const APP_NAME = "Gestor de Servicios CCTV";
const ALL_STATUSES_FILTER = "";

// Toast Context (remains the same)
interface ToastContextType {
  addToast: (type: ToastType, message: string, title?: string) => void;
}
const ToastContext = createContext<ToastContextType | undefined>(undefined);
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};

// Toast Container Component (remains the same)
const ToastContainer: React.FC<{ toasts: ToastMessage[]; removeToast: (id: string) => void }> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed top-4 right-4 z-[200] w-full max-w-xs sm:max-w-sm space-y-3">
      {toasts.map(toast => (
        <Alert
          key={toast.id}
          type={toast.type}
          title={toast.title}
          message={toast.message}
          className="shadow-lg"
        >
          <button
            onClick={() => removeToast(toast.id)}
            className="ml-auto -mx-1.5 -my-1.5 bg-transparent rounded-lg focus:ring-2 focus:ring-gray-300 p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 inline-flex h-8 w-8 text-gray-500 dark:text-[rgba(255,255,255,0.60)]"
            aria-label="Cerrar"
          >
            <span className="sr-only">Cerrar</span>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
          </button>
        </Alert>
      ))}
    </div>
  );
};

// PDF Generation
const PDF_COLORS = { 
    PRIMARY_BLUE: '#2563EB', DARK_GRAY: '#374151', MEDIUM_GRAY: '#6B7280', LIGHT_GRAY: '#D1D5DB', BORDER_GRAY: '#E5E7EB', WHITE: '#FFFFFF',
};
const addImageToPdfDoc = (
    doc: jsPDF, imageDataUrl: string, title: string, currentY: number, xPos: number, imageWidth: number, imageHeight: number,
    options: { margin: number, lineHeightSmall: number, pageWidth: number }
): number => {
    const titleHeight = options.lineHeightSmall;
    const spacingAfterTitle = 2;
    const spacingAfterImage = options.lineHeightSmall;
    const borderColor = PDF_COLORS.BORDER_GRAY;
    const borderWidth = 0.2;

    const estimatedHeight = titleHeight + spacingAfterTitle + imageHeight + spacingAfterImage;
    if (currentY + estimatedHeight > doc.internal.pageSize.getHeight() - options.margin) {
        doc.addPage();
        currentY = options.margin;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(PDF_COLORS.DARK_GRAY);
    doc.text(title, xPos, currentY);
    currentY += titleHeight + spacingAfterTitle;

    try {
        doc.setDrawColor(borderColor);
        doc.setLineWidth(borderWidth);
        doc.addImage(imageDataUrl, 'JPEG', xPos, currentY, imageWidth, imageHeight); 
        doc.rect(xPos, currentY, imageWidth, imageHeight, 'S');
    } catch (e) {
        console.error("Error al agregar imagen al PDF:", e);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(PDF_COLORS.MEDIUM_GRAY);
        doc.text(`[Error al cargar imagen]`, xPos, currentY + imageHeight / 2);
    }
    return currentY + imageHeight + spacingAfterImage;
};

const generateServicePdfDoc = (service: Service, client: Client | undefined): jsPDF => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - 2 * margin;
    let y = 15; 

    const lineHeight = 7;
    const lineHeightSmall = 5;
    const sectionSpacing = 8;
    const fieldSpacing = 3;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(PDF_COLORS.MEDIUM_GRAY);
    doc.text("[Logo de la Empresa Aquí]", margin, y);
    y += lineHeight;

    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(PDF_COLORS.PRIMARY_BLUE);
    doc.text(`Ticket de Servicio: ${client?.clientName || 'Cliente Desconocido'}`, margin, y);
    y += lineHeight * 1.5;
    doc.setDrawColor(PDF_COLORS.LIGHT_GRAY);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += sectionSpacing;

    const drawField = (label: string, value: string | undefined | number, currentY: number) => {
        if (value === undefined || value === null || (typeof value === 'string' && value.trim() === "")) return currentY;
        const stringValue = String(value);
        doc.setFontSize(10);
        const labelX = margin;
        const valueX = margin + 45; 
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(PDF_COLORS.DARK_GRAY);
        doc.text(`${label}:`, labelX, currentY);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(PDF_COLORS.DARK_GRAY);
        const valueLines = doc.splitTextToSize(stringValue, contentWidth - (valueX - margin));
        doc.text(valueLines, valueX, currentY);
        return currentY + valueLines.length * lineHeightSmall + fieldSpacing / 2 ;
    };
    
    const drawSectionHeader = (title: string, currentY: number) => {
        if (currentY + sectionSpacing > doc.internal.pageSize.getHeight() - margin) { doc.addPage(); currentY = margin; }
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(PDF_COLORS.PRIMARY_BLUE);
        doc.text(title, margin, currentY);
        currentY += lineHeightSmall * 1.5;
        doc.setDrawColor(PDF_COLORS.LIGHT_GRAY);
        doc.setLineWidth(0.2);
        doc.line(margin, currentY, pageWidth - margin, currentY);
        return currentY + fieldSpacing;
    };

    y = drawSectionHeader("Información del Cliente", y);
    y = drawField("ID Servicio", service.id, y);
    if (client) {
      y = drawField("Cliente", client.clientName, y);
      y = drawField("NIT Cliente", client.nitCliente, y);
      y = drawField("Teléfono", client.telefonoCliente, y);
      if(client.email) y = drawField("Email", client.email, y);
      y = drawField("Dirección Cliente", client.address, y);
    }
    y = drawField("Fecha Servicio", new Date(service.date).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' }), y);
    y = drawField("Dirección Servicio", service.serviceAddress, y);
    y += sectionSpacing / 2;

    y = drawSectionHeader("Detalles del Servicio", y);
    y = drawField("Tipo de Servicio", service.serviceType, y);
    if (service.serviceType === ServiceType.NEW_IP_CAMERA_INSTALLATION && service.numIpCameras !== undefined) {
        y = drawField("Nº Cámaras IP", service.numIpCameras, y);
    }
    if (service.serviceType === ServiceType.NEW_DVR_INSTALLATION && service.numDvrCameras !== undefined) {
        y = drawField("Nº Cámaras DVR", service.numDvrCameras, y);
    }
    y = drawField("Técnico", service.technician, y);
    y = drawField("Estado", service.status, y);
    if (service.cost !== undefined) {
      y = drawField("Costo", `$${service.cost.toLocaleString(undefined, { maximumFractionDigits: 0, minimumFractionDigits: 0 })}`, y);
    }
    y += sectionSpacing / 2;

    const drawMultiLineTextSection = (title: string, text: string | undefined, currentY: number) => {
      if (!text) return currentY;
      if (currentY + sectionSpacing > doc.internal.pageSize.getHeight() - margin) { doc.addPage(); currentY = margin; }
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(PDF_COLORS.DARK_GRAY);
      doc.text(title, margin, currentY);
      currentY += lineHeightSmall * 1.5;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const textLines = doc.splitTextToSize(text, contentWidth);
      doc.text(textLines, margin, currentY);
      return currentY + textLines.length * lineHeightSmall + sectionSpacing;
    };
    
    y = drawMultiLineTextSection("Descripción del Servicio:", service.description, y);
    y = drawMultiLineTextSection("Notas Adicionales:", service.notes, y);
    
    const hasDeviceLabelFoto = !!service.deviceLabelFoto;
    // For single QR photo (non-IP Cam, e.g. DVR unit QR)
    const hasSingleDeviceQrFoto = service.serviceType !== ServiceType.NEW_IP_CAMERA_INSTALLATION && service.qrDeviceFotos && service.qrDeviceFotos.length > 0 && !!service.qrDeviceFotos[0];
    // For multiple IP Cam QR photos
    const hasIpQrFotos = service.serviceType === ServiceType.NEW_IP_CAMERA_INSTALLATION && service.qrDeviceFotos && service.qrDeviceFotos.length > 0;
    // For DVR Camera photos
    const hasDvrCameraFotos = service.serviceType === ServiceType.NEW_DVR_INSTALLATION && service.dvrCameraFotos && service.dvrCameraFotos.length > 0;


    if (hasDeviceLabelFoto || hasSingleDeviceQrFoto || hasIpQrFotos || hasDvrCameraFotos) {
        if (y + sectionSpacing + 60 > doc.internal.pageSize.getHeight() - margin) { doc.addPage(); y = margin; }
        y = drawSectionHeader("Imágenes Adjuntas", y);
        const imageOptions = { margin, lineHeightSmall, pageWidth };
        const imageDisplayWidth = contentWidth / 2 - 5; 
        const imageMaxHeight = 60;
        
        let currentX = margin;
        let imagesInRow = 0;
        let maxHeightInRow = 0;

        const processImage = (fotoUrl: string, title: string) => {
            if (imagesInRow >= 2 || (currentX + imageDisplayWidth > pageWidth - margin && imagesInRow > 0)) {
                y += maxHeightInRow + sectionSpacing / 2;
                currentX = margin;
                imagesInRow = 0;
                maxHeightInRow = 0;
            }
            if (y + imageMaxHeight + sectionSpacing > doc.internal.pageSize.getHeight() - margin) {
                doc.addPage(); y = margin; currentX = margin; imagesInRow = 0; maxHeightInRow = 0;
            }
            const imageYAfter = addImageToPdfDoc(doc, fotoUrl, title, y, currentX, imageDisplayWidth, imageMaxHeight, imageOptions);
            maxHeightInRow = Math.max(maxHeightInRow, (imageYAfter - y)); // Height of this image block including title
            currentX += imageDisplayWidth + 10; // Move X for next image in row
            imagesInRow++;
        };

        if (hasDeviceLabelFoto) {
           processImage(service.deviceLabelFoto!, "Foto Etiqueta Dispositivo");
        }

        if (hasSingleDeviceQrFoto && service.qrDeviceFotos) { 
            processImage(service.qrDeviceFotos[0], "Foto QR Disp. Principal");
        }
        
        if (hasIpQrFotos && service.qrDeviceFotos) {
            service.qrDeviceFotos.forEach((fotoUrl, index) => {
                if(fotoUrl) processImage(fotoUrl, `Foto QR Disp. IP #${index + 1}`);
            });
        }
        
        if (hasDvrCameraFotos && service.dvrCameraFotos) {
            service.dvrCameraFotos.forEach((fotoUrl, index) => {
                 if(fotoUrl) processImage(fotoUrl, `Foto Cámara DVR #${index + 1}`);
            });
        }

        if (imagesInRow > 0) y += maxHeightInRow; // Add height of the last row of images
        y += sectionSpacing;
    }


    if (y + sectionSpacing * 2 > doc.internal.pageSize.getHeight() - margin ) { doc.addPage(); y = margin; }
    y = drawSectionHeader("Términos y Condiciones", y);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(PDF_COLORS.MEDIUM_GRAY);
    const termsPlaceholder = "Aquí irían los términos y condiciones estándar del servicio, garantía, etc. Este es un texto de ejemplo.";
    const termsLines = doc.splitTextToSize(termsPlaceholder, contentWidth);
    doc.text(termsLines, margin, y);
    y += termsLines.length * (lineHeightSmall -1) + sectionSpacing;

    const pageCount = doc.internal.pages.length;
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(PDF_COLORS.MEDIUM_GRAY);
        doc.text(`Página ${i} de ${pageCount}`, pageWidth - margin - 20, doc.internal.pageSize.getHeight() - 10);
    }
    return doc;
};

// Client Management Modal (remains the same)
const ClientManagementModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  onAddClient: () => void;
  onEditClient: (client: Client) => void;
  onDeleteClient: (client: Client) => void;
}> = ({ isOpen, onClose, clients, onAddClient, onEditClient, onDeleteClient }) => {
  const [searchTerm, setSearchTerm] = useState('');
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Gestionar Clientes" maxWidth="max-w-2xl">
      <ClientList
        clients={clients}
        onAddClient={onAddClient}
        onEdit={onEditClient}
        onDelete={onDeleteClient}
        searchTerm={searchTerm}
        onSearchChange={(e) => setSearchTerm(e.target.value)}
      />
    </Modal>
  );
};


const App: React.FC = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true); 

  // Service Modals State
  const [isServiceFormModalOpen, setIsServiceFormModalOpen] = useState(false);
  const [isDeleteServiceModalOpen, setIsDeleteServiceModalOpen] = useState(false);
  const [isDetailsServiceModalOpen, setIsDetailsServiceModalOpen] = useState(false);
  const [currentService, setCurrentService] = useState<Service | null>(null);
  const [serviceToProcess, setServiceToProcess] = useState<Service | null>(null);
  const [serviceFormError, setServiceFormError] = useState<string | null>(null);

  // Client Modals State
  const [isClientManagementModalOpen, setIsClientManagementModalOpen] = useState(false);
  const [isClientFormModalOpen, setIsClientFormModalOpen] = useState(false);
  const [isDeleteClientModalOpen, setIsDeleteClientModalOpen] = useState(false);
  const [currentClient, setCurrentClient] = useState<Client | null>(null);
  const [clientToProcess, setClientToProcess] = useState<Client | null>(null);
  const [clientFormError, setClientFormError] = useState<string | null>(null);

  // Image Preview Modal State
  const [isPreviewImageModalOpen, setIsPreviewImageModalOpen] = useState(false);
  const [imageToPreview, setImageToPreview] = useState<{src: string; alt: string} | null>(null);

  // Filters and Sort State
  const [searchTermNit, setSearchTermNit] = useState<string>(''); 
  const [serviceStatusFilter, setServiceStatusFilter] = useState<string>(ALL_STATUSES_FILTER);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'ascending' | 'descending' }>({ key: 'date', direction: 'descending' });

  // Toast Management
  const addToast = useCallback((type: ToastType, message: string, title?: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, type, message, title }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 5000);
  }, []);
  const removeToast = (id: string) => setToasts(prev => prev.filter(toast => toast.id !== id));

  // Map Supabase Row to App's Client type
  const mapClientRowToClient = (row: ClientRow): Client => ({
    id: row.id,
    clientName: row.client_name,
    nitCliente: row.nit_cliente,
    telefonoCliente: row.telefono_cliente,
    address: row.address,
    email: row.email || undefined,
  });

  // Map App's Client (or partial for insert) to Supabase Insert/Update type
  const mapClientToDbClient = (client: Partial<Client>): Partial<Database['public']['Tables']['clients']['Insert']> => ({
    client_name: client.clientName,
    nit_cliente: client.nitCliente,
    telefono_cliente: client.telefonoCliente,
    address: client.address,
    email: client.email || null,
  });

  // Map Supabase Row to App's Service type
  const mapServiceRowToService = (row: ServiceRow): Service => ({
    id: row.id,
    clientId: row.client_id,
    serviceAddress: row.service_address,
    numIpCameras: row.num_ip_cameras === null ? undefined : row.num_ip_cameras,
    qrDeviceFotos: row.qr_device_fotos || [], // Default to empty array if null
    deviceLabelFoto: row.device_label_foto || undefined,
    numDvrCameras: row.num_dvr_cameras === null ? undefined : row.num_dvr_cameras,
    dvrCameraFotos: row.dvr_camera_fotos || [], // Default to empty array if null
    date: row.date,
    serviceType: row.service_type,
    description: row.description,
    technician: row.technician,
    status: row.status,
    cost: row.cost === null ? undefined : row.cost,
    notes: row.notes || undefined,
  });

  // Map App's Service (or partial) to Supabase Insert/Update type
  const mapServiceToDbService = (service: Partial<Service>): Partial<Database['public']['Tables']['services']['Insert']> => ({
    client_id: service.clientId,
    service_address: service.serviceAddress,
    num_ip_cameras: service.numIpCameras === undefined ? null : service.numIpCameras,
    qr_device_fotos: service.qrDeviceFotos && service.qrDeviceFotos.length > 0 ? service.qrDeviceFotos.filter(f => f) : null, // Filter out undefined/null before sending
    device_label_foto: service.deviceLabelFoto || null,
    num_dvr_cameras: service.numDvrCameras === undefined ? null : service.numDvrCameras,
    dvr_camera_fotos: service.dvrCameraFotos && service.dvrCameraFotos.length > 0 ? service.dvrCameraFotos.filter(f => f) : null, // Filter out undefined/null
    date: service.date,
    service_type: service.serviceType,
    description: service.description,
    technician: service.technician,
    status: service.status,
    cost: service.cost === undefined ? null : service.cost,
    notes: service.notes || null,
  });


  // Data fetching from Supabase
  const fetchClients = useCallback(async () => {
    const { data, error } = await supabase.from('clients').select('*').order('client_name', { ascending: true });
    if (error) {
      addToast('error', `Error al cargar clientes: ${error.message}`, 'Error de Carga');
      console.error('Error al obtener clientes:', error);
      return [];
    }
    return data.map(mapClientRowToClient) || [];
  }, [addToast]);

  const fetchServices = useCallback(async () => {
    const { data, error } = await supabase.from('services').select('*').order('date', { ascending: false });
    if (error) {
      addToast('error', `Error al cargar servicios: ${error.message}`, 'Error de Carga');
      console.error('Error al obtener servicios:', error);
      return [];
    }
    return data.map(mapServiceRowToService) || [];
  }, [addToast]);

  useEffect(() => {
    document.title = APP_NAME;
    setIsLoading(true);
    Promise.all([fetchClients(), fetchServices()])
      .then(([fetchedClients, fetchedServices]) => {
        setClients(fetchedClients);
        setServices(fetchedServices);
      })
      .catch(err => {
        console.error("Error al cargar datos iniciales:", err);
        addToast('error', 'No se pudieron cargar los datos iniciales.', 'Error General');
      })
      .finally(() => setIsLoading(false));
  }, [addToast, fetchClients, fetchServices]);


  // Service Modal Open/Close
  const openServiceFormModal = (service?: Service) => { setCurrentService(service || null); setServiceFormError(null); setIsServiceFormModalOpen(true); };
  const closeServiceFormModal = () => setIsServiceFormModalOpen(false);
  const openDeleteServiceModal = (service: Service) => { setServiceToProcess(service); setIsDeleteServiceModalOpen(true); };
  const closeDeleteServiceModal = () => setIsDeleteServiceModalOpen(false);
  const openDetailsServiceModal = (service: Service) => { setServiceToProcess(service); setIsDetailsServiceModalOpen(true); };
  const closeDetailsServiceModal = () => setIsDetailsServiceModalOpen(false);

  // Client Modal Open/Close
  const openClientManagementModal = () => setIsClientManagementModalOpen(true);
  const closeClientManagementModal = () => setIsClientManagementModalOpen(false);
  const openClientFormModal = (client?: Client) => { setCurrentClient(client || null); setClientFormError(null); setIsClientFormModalOpen(true); };
  const closeClientFormModal = () => { setIsClientFormModalOpen(false); setCurrentClient(null); setClientFormError(null);};
  const openDeleteClientModal = (client: Client) => { setClientToProcess(client); setIsDeleteClientModalOpen(true); };
  const closeDeleteClientModal = () => setIsDeleteClientModalOpen(false);

  // Image Preview Modal
  const openImagePreviewModal = (src: string, alt: string) => { setImageToPreview({ src, alt }); setIsPreviewImageModalOpen(true); };
  const closeImagePreviewModal = () => setIsPreviewImageModalOpen(false);

  // Client CRUD
  const handleClientFormSubmit = async (clientData: Omit<Client, 'id'> | Client) => {
    setClientFormError(null);
    const dbClientPayload = mapClientToDbClient(clientData);

    if ('id' in clientData && clientData.id) { // Update existing client
        const { data, error } = await supabase
            .from('clients')
            .update(dbClientPayload)
            .eq('id', clientData.id)
            .select()
            .single(); 

        if (error) {
            addToast('error', `Error al actualizar cliente: ${error.message}`, 'Error de Actualización');
            console.error("Error de Supabase al actualizar cliente:", error);
            if (error.code === '23505') { 
                 setClientFormError(`Error: El NIT '${clientData.nitCliente}' ya existe para otro cliente.`);
            }
        } else if (data) {
            setClients(prev => prev.map(c => (c.id === data.id ? mapClientRowToClient(data) : c)));
            addToast('success', 'Cliente actualizado exitosamente.');
            closeClientFormModal();
        }
    } else { // Add new client
        const { data, error } = await supabase
            .from('clients')
            .insert(dbClientPayload as Database['public']['Tables']['clients']['Insert']) 
            .select()
            .single();

        if (error) {
            addToast('error', `Error al agregar cliente: ${error.message}`, 'Error de Creación');
            console.error("Error de Supabase al agregar cliente:", error);
            if (error.code === '23505') { 
                 setClientFormError(`Error: El NIT '${clientData.nitCliente}' ya existe.`);
            }
        } else if (data) {
             setClients(prev => [...prev, mapClientRowToClient(data)]);
            addToast('success', 'Cliente agregado exitosamente.');
            closeClientFormModal();
        }
    }
  };

  const handleDeleteClient = async () => {
    if (clientToProcess) {
        const { count, error: serviceCheckError } = await supabase
            .from('services')
            .select('id', { count: 'exact', head: true }) 
            .eq('client_id', clientToProcess.id);

        if (serviceCheckError) {
            addToast('error', `Error al verificar servicios asociados: ${serviceCheckError.message}`, 'Error de Eliminación');
            return;
        }
        if (count && count > 0) {
            addToast('error', `No se puede eliminar el cliente '${clientToProcess.clientName}' porque tiene ${count} servicio(s) asociado(s).`, "Error de Eliminación");
            closeDeleteClientModal();
            return;
        }

        const { error } = await supabase.from('clients').delete().eq('id', clientToProcess.id);
        if (error) {
            addToast('error', `Error al eliminar cliente: ${error.message}`, 'Error de Eliminación');
            console.error("Error de Supabase al eliminar cliente:", error);
        } else {
            setClients(prev => prev.filter(c => c.id !== clientToProcess.id));
            addToast('info', `Cliente '${clientToProcess.clientName}' eliminado.`);
            closeDeleteClientModal();
        }
    }
  };
  
  // Service CRUD
  const handleServiceFormSubmit = async (serviceData: Omit<Service, 'id'> | Service) => {
    if (!serviceData.clientId) {
        addToast('error', 'Debe seleccionar un cliente para el servicio.', 'Error de Validación');
        setServiceFormError('Debe seleccionar un cliente para el servicio.');
        return;
    }
    if (serviceData.serviceType === ServiceType.NEW_IP_CAMERA_INSTALLATION && (!serviceData.numIpCameras || serviceData.numIpCameras <=0)) {
        addToast('error', 'Debe especificar un número válido de cámaras IP para este tipo de servicio.', 'Error de Validación');
        setServiceFormError('Debe especificar un número válido de cámaras IP.');
        return;
    }
    if (serviceData.serviceType === ServiceType.NEW_DVR_INSTALLATION && (!serviceData.numDvrCameras || serviceData.numDvrCameras <=0)) {
        addToast('error', 'Debe especificar un número válido de cámaras para DVR para este tipo de servicio.', 'Error de Validación');
        setServiceFormError('Debe especificar un número válido de cámaras para DVR.');
        return;
    }

    setServiceFormError(null);
    const dbServicePayload = mapServiceToDbService(serviceData);

    if ('id' in serviceData && serviceData.id) { // Update
        const { data, error } = await supabase
            .from('services')
            .update(dbServicePayload)
            .eq('id', serviceData.id)
            .select()
            .single();
        if (error) {
            addToast('error', `Error al actualizar servicio: ${error.message}`, 'Error de Actualización');
        } else if(data) {
            setServices(prev => prev.map(s => (s.id === data.id ? mapServiceRowToService(data) : s)));
            addToast('success', 'Servicio actualizado exitosamente.');
            closeServiceFormModal();
        }
    } else { // Insert
        const { data, error } = await supabase
            .from('services')
            .insert(dbServicePayload as Database['public']['Tables']['services']['Insert']) 
            .select()
            .single();
        if (error) {
             addToast('error', `Error al agregar servicio: ${error.message}`, 'Error de Creación');
        } else if (data) {
            setServices(prev => [mapServiceRowToService(data), ...prev ]); 
            addToast('success', 'Servicio agregado exitosamente.');
            closeServiceFormModal();
        }
    }
  };

  const handleDeleteService = async () => {
    if (serviceToProcess) {
        const { error } = await supabase.from('services').delete().eq('id', serviceToProcess.id);
        if (error) {
            addToast('error', `Error al eliminar servicio: ${error.message}`, 'Error de Eliminación');
        } else {
            const client = clients.find(c => c.id === serviceToProcess.clientId);
            setServices(prev => prev.filter(s => s.id !== serviceToProcess.id));
            addToast('info', `Servicio para '${client?.clientName || 'Cliente desconocido'}' eliminado.`);
            closeDeleteServiceModal();
        }
    }
  };

  // Filtering and Sorting Logic
  const handleNitSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => setSearchTermNit(event.target.value);
  const handleStatusFilterChange = (event: React.ChangeEvent<HTMLSelectElement>) => setServiceStatusFilter(event.target.value);
  
  const requestSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedAndFilteredServices = useMemo(() => {
    let tempServices = [...services];

    if (searchTermNit.trim()) {
      const lowerSearchTerm = searchTermNit.toLowerCase();
      tempServices = tempServices.filter(service => {
        const client = clients.find(c => c.id === service.clientId);
        return client?.nitCliente.toLowerCase().includes(lowerSearchTerm) || client?.clientName.toLowerCase().includes(lowerSearchTerm);
      });
    }

    if (serviceStatusFilter !== ALL_STATUSES_FILTER) {
      tempServices = tempServices.filter(service => service.status === serviceStatusFilter);
    }

    tempServices.sort((a, b) => {
      let valA: any = '';
      let valB: any = '';
      if (sortConfig.key === 'clientName') {
        valA = clients.find(c => c.id === a.clientId)?.clientName || '';
        valB = clients.find(c => c.id === b.clientId)?.clientName || '';
      } else if (sortConfig.key === 'date') {
        valA = new Date(a.date).getTime();
        valB = new Date(b.date).getTime();
      } else if (sortConfig.key === 'status') {
        valA = a.status;
        valB = b.status;
      } else { 
         valA = new Date(a.date).getTime();
         valB = new Date(b.date).getTime();
      }
      if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
      return 0;
    });
    return tempServices;
  }, [services, clients, searchTermNit, serviceStatusFilter, sortConfig]);

  const getServiceEmptyStateMessages = () => { 
    if (isLoading) return { title: 'Cargando servicios...', message: 'Por favor espere. Asegúrese de que Supabase esté configurado correctamente.', showAddButton: false };
    const hasNitFilter = searchTermNit.trim() !== '';
    const hasStatusFilter = serviceStatusFilter !== ALL_STATUSES_FILTER;
    if (services.length === 0 && !hasNitFilter && !hasStatusFilter) {
      return { title: 'Aún no hay servicios', message: 'Agregue clientes y luego servicios para comenzar.', showAddButton: true };
    }
    if (sortedAndFilteredServices.length === 0 ) {
        if (hasNitFilter && hasStatusFilter) return { title: 'No se encontraron servicios', message: `No hay servicios que coincidan con la búsqueda "${searchTermNit}" y el estado "${serviceStatusFilter}".`, showAddButton: false };
        if (hasNitFilter) return { title: 'No se encontraron servicios', message: `No hay servicios que coincidan con la búsqueda "${searchTermNit}".`, showAddButton: false };
        if (hasStatusFilter) return { title: 'No se encontraron servicios', message: `No hay servicios con el estado "${serviceStatusFilter}".`, showAddButton: false };
        return { title: 'No hay servicios para mostrar', message: 'Parece que no hay servicios que coincidan con los filtros actuales.', showAddButton: false }; 
    }
     return { title: '', message: '', showAddButton: false };
  };
  const serviceEmptyState = getServiceEmptyStateMessages();
  const filteredServices = sortedAndFilteredServices; 

  // PDF and WhatsApp Handlers
   const handleGeneratePdf = (service: Service) => {
    const client = clients.find(c => c.id === service.clientId);
    if (!client) {
      addToast('error', 'Cliente no encontrado para este servicio.', 'Error al generar PDF');
      return;
    }
    const doc = generateServicePdfDoc(service, client);
    doc.save(`servicio_${service.id}_${client.clientName.replace(/\s+/g, '_')}.pdf`);
    addToast('success', 'PDF generado exitosamente.');
  };

  const handleShareWhatsApp = async (service: Service) => {
    const client = clients.find(c => c.id === service.clientId);
    if (!client) {
      addToast('error', 'Cliente no encontrado para este servicio.', 'Error al compartir');
      return;
    }
    const doc = generateServicePdfDoc(service, client);
    const pdfBlob = doc.output('blob');
    const fileName = `servicio_${service.id}_${client.clientName.replace(/\s+/g, '_')}.pdf`;
    const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
    let shareText = `*Ticket de Servicio CCTV*\n\nCliente: ${client.clientName}\nNIT: ${client.nitCliente}\nTel: ${client.telefonoCliente}\nFecha: ${new Date(service.date).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' })}\n\nAdjunto PDF.`;
    const shareData = { files: [pdfFile], title: `Ticket: ${client.clientName}`, text: shareText };

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
      try {
        await navigator.share(shareData);
        addToast('info', 'Intento de compartir iniciado.');
      } catch (error: any) {
        if (error.name === 'AbortError') addToast('warning', 'Compartir cancelado.');
        else { doc.save(fileName); addToast('error', 'No se pudo compartir. PDF descargado.'); }
      }
    } else {
      doc.save(fileName);
      addToast('info', 'Navegador no soporta compartir archivos. PDF descargado.');
    }
  };

  // CSV Export
  const exportToCsv = () => {
    if (filteredServices.length === 0) {
      addToast('warning', 'No hay servicios para exportar con los filtros actuales.');
      return;
    }
    const headers = ["ID Servicio", "Cliente", "NIT Cliente", "Teléfono Cliente", "Email Cliente", "Dirección Cliente", "Dirección Servicio", "Fecha", "Tipo Servicio", "Nº Cámaras IP", "Nº Cámaras DVR", "Descripción", "Técnico", "Estado", "Costo", "Notas", "URLs Fotos QR Dispositivo", "URLs Fotos Cámaras DVR", "URL Foto Etiqueta"];
    const csvRows = [headers.join(',')];

    filteredServices.forEach(service => {
      const client = clients.find(c => c.id === service.clientId);
      const row = [
        service.id,
        client?.clientName || '',
        client?.nitCliente || '',
        client?.telefonoCliente || '',
        client?.email || '',
        client?.address || '',
        service.serviceAddress,
        service.date,
        service.serviceType,
        service.numIpCameras !== undefined ? service.numIpCameras.toString() : '',
        service.numDvrCameras !== undefined ? service.numDvrCameras.toString() : '',
        `"${(service.description || '').replace(/"/g, '""')}"`, 
        service.technician,
        service.status,
        service.cost !== undefined ? service.cost.toString() : '',
        `"${(service.notes || '').replace(/"/g, '""')}"`,
        `"${(service.qrDeviceFotos || []).filter(f=>f).join('; ')}"`, // Ensure only defined URLs are joined
        `"${(service.dvrCameraFotos || []).filter(f=>f).join('; ')}"`, // Ensure only defined URLs are joined
        service.deviceLabelFoto || ''
      ];
      csvRows.push(row.join(','));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `servicios_cctv_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      addToast('success', 'Datos exportados a CSV.');
    }
  };
  
  const SortButton: React.FC<{ sortKey: string; label: string }> = ({ sortKey, label }) => (
    <Button
      onClick={() => requestSort(sortKey)}
      variant="ghost"
      size="sm"
      className="flex items-center"
      aria-label={`Ordenar por ${label}`}
    >
      {label}
      {sortConfig.key === sortKey ? (
        sortConfig.direction === 'ascending' ? 
        <ChevronUpDownIcon className="w-4 h-4 ml-1 transform rotate-180" /> : <ChevronUpDownIcon className="w-4 h-4 ml-1" />
      ) : <ChevronUpDownIcon className="w-4 h-4 ml-1 text-slate-400 dark:text-[rgba(255,255,255,0.38)]" />}
    </Button>
  );


  return (
    <ToastContext.Provider value={{ addToast }}>
      <div className="min-h-screen bg-slate-50 dark:bg-[#121212] flex flex-col">
        <Navbar appName={APP_NAME} onAddService={() => openServiceFormModal()} onManageClients={openClientManagementModal} />
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        
        <main className="flex-grow container mx-auto px-4 py-8">
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
            <div className="relative lg:col-span-1">
              <label htmlFor="nitSearch" className="block text-sm font-medium text-slate-700 dark:text-[rgba(255,255,255,0.60)] mb-1">Buscar Cliente (NIT/Nombre)</label>
              <div className="absolute inset-y-0 left-0 pl-3 pt-7 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-slate-400 dark:text-[rgba(255,255,255,0.38)]" />
              </div>
              <input
                type="text" id="nitSearch" placeholder="NIT o Nombre de Cliente..."
                className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-[rgba(255,255,255,0.23)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white dark:bg-slate-700 text-slate-900 dark:text-[rgba(255,255,255,0.87)]"
                value={searchTermNit} onChange={handleNitSearchChange} aria-label="Buscar por NIT o Nombre de Cliente"
              />
            </div>
            <div className="lg:col-span-1">
              <label htmlFor="statusFilter" className="block text-sm font-medium text-slate-700 dark:text-[rgba(255,255,255,0.60)] mb-1">Filtrar por Estado Servicio</label>
              <div className="relative">
                  <select id="statusFilter" className="w-full pl-3 pr-10 py-2 border border-slate-300 dark:border-[rgba(255,255,255,0.23)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white dark:bg-slate-700 text-slate-900 dark:text-[rgba(255,255,255,0.87)] appearance-none" value={serviceStatusFilter} onChange={handleStatusFilterChange} aria-label="Filtrar por estado del servicio">
                  <option value={ALL_STATUSES_FILTER}>Todos los Estados</option>
                  {SERVICE_STATUS_OPTIONS.map(status => (<option key={status} value={status}>{status}</option>))}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none"><ChevronUpDownIcon className="w-5 h-5 text-slate-400 dark:text-[rgba(255,255,255,0.38)]" /></div>
              </div>
            </div>
             <div className="flex items-center justify-start md:justify-end space-x-2 mt-4 md:mt-0 lg:col-span-1">
                <Button onClick={exportToCsv} variant="outline" size="sm">
                    <DownloadIcon className="w-4 h-4 mr-2" />
                    Exportar CSV
                </Button>
            </div>
          </div>
          
           <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600 dark:text-[rgba(255,255,255,0.60)]">
            <span>Ordenar por:</span>
            <SortButton sortKey="clientName" label="Cliente" />
            <SortButton sortKey="date" label="Fecha" />
            <SortButton sortKey="status" label="Estado" />
          </div>

          {isLoading ? (
             <div className="flex justify-center items-center py-10">
                <Spinner size="lg" />
                <p className="ml-3 text-slate-600 dark:text-[rgba(255,255,255,0.60)]">Cargando datos...</p>
            </div>
          ) : filteredServices.length === 0 && !isLoading ? ( 
            <div className="text-center py-10">
              <InformationCircleIcon className="w-16 h-16 mx-auto text-slate-400 dark:text-[rgba(255,255,255,0.38)] mb-4" />
              <h2 className="text-2xl font-semibold text-slate-700 dark:text-[rgba(255,255,255,0.87)] mb-2">{serviceEmptyState.title}</h2>
              <p className="text-slate-500 dark:text-[rgba(255,255,255,0.60)] mb-6">{serviceEmptyState.message}</p>
              {serviceEmptyState.showAddButton && clients.length > 0 && (
                <Button onClick={() => openServiceFormModal()} variant="primary" size="lg"><PlusIcon className="w-5 h-5 mr-2" />Agregar Nuevo Servicio</Button>
              )}
               {serviceEmptyState.showAddButton && clients.length === 0 && (
                <Button onClick={openClientManagementModal} variant="primary" size="lg"><PlusIcon className="w-5 h-5 mr-2" />Agregar Cliente Primero</Button>
              )}
            </div>
          ) : (
            <ServiceList
              services={filteredServices}
              onEdit={openServiceFormModal}
              onDelete={openDeleteServiceModal}
              onViewDetails={openDetailsServiceModal}
              clients={clients} 
            />
          )}
        </main>

        <footer className="text-center py-4 text-sm text-slate-500 dark:text-[rgba(255,255,255,0.60)] border-t border-slate-200 dark:border-[rgba(255,255,255,0.12)] no-print">
          © {new Date().getFullYear()} {APP_NAME}. Todos los derechos reservados. <span className="text-xs">(Conectado a Supabase)</span>
        </footer>

        {/* Client Management Modals */}
        {isClientManagementModalOpen && (
          <ClientManagementModal
            isOpen={isClientManagementModalOpen}
            onClose={closeClientManagementModal}
            clients={clients}
            onAddClient={() => openClientFormModal()}
            onEditClient={(client) => openClientFormModal(client)}
            onDeleteClient={(client) => openDeleteClientModal(client)}
          />
        )}
        {isClientFormModalOpen && (
          <Modal isOpen={isClientFormModalOpen} onClose={closeClientFormModal} title={currentClient ? 'Editar Cliente' : 'Agregar Nuevo Cliente'}>
            <ClientForm onSubmit={handleClientFormSubmit} onCancel={closeClientFormModal} initialData={currentClient} formError={clientFormError} />
          </Modal>
        )}
        {isDeleteClientModalOpen && clientToProcess && (
          <Modal isOpen={isDeleteClientModalOpen} onClose={closeDeleteClientModal} title="Confirmar Eliminación Cliente">
            <div className="p-2 text-slate-700 dark:text-[rgba(255,255,255,0.87)]">
              <p>¿Seguro que quieres eliminar al cliente <strong>{clientToProcess.clientName}</strong> (NIT: {clientToProcess.nitCliente})?</p>
              <p className="text-sm text-amber-600 dark:text-amber-500 mt-1">Si este cliente tiene servicios asociados, no podrá ser eliminado (configurado en base de datos para restringir).</p>
              <p className="text-sm text-red-500 dark:text-red-400 mt-2">Esta acción no se puede deshacer.</p>
              <div className="mt-6 flex justify-end space-x-3">
                <Button onClick={closeDeleteClientModal} variant="secondary">Cancelar</Button>
                <Button onClick={handleDeleteClient} variant="danger">Eliminar Cliente</Button>
              </div>
            </div>
          </Modal>
        )}

        {/* Service Modals */}
        {isServiceFormModalOpen && (
          <Modal isOpen={isServiceFormModalOpen} onClose={closeServiceFormModal} title={currentService ? 'Editar Servicio' : 'Agregar Nuevo Servicio'} maxWidth="max-w-2xl">
            {serviceFormError && <Alert type="error" message={serviceFormError} className="mb-4" />}
            <ServiceForm
              onSubmit={handleServiceFormSubmit}
              onCancel={closeServiceFormModal}
              initialData={currentService}
              clients={clients}
              onAddNewClient={() => { closeServiceFormModal(); openClientFormModal(); }}
            />
          </Modal>
        )}
        {isDeleteServiceModalOpen && serviceToProcess && (
          <Modal isOpen={isDeleteServiceModalOpen} onClose={closeDeleteServiceModal} title="Confirmar Eliminación Servicio">
            <div className="p-2 text-slate-700 dark:text-[rgba(255,255,255,0.87)]">
              <p>¿Seguro que quieres eliminar el servicio del {new Date(serviceToProcess.date).toLocaleDateString()} para <strong>{clients.find(c=>c.id === serviceToProcess.clientId)?.clientName || 'Cliente desconocido'}</strong>?</p>
              <p className="text-sm text-red-500 dark:text-red-400 mt-2">Esta acción no se puede deshacer.</p>
              <div className="mt-6 flex justify-end space-x-3">
                <Button onClick={closeDeleteServiceModal} variant="secondary">Cancelar</Button>
                <Button onClick={handleDeleteService} variant="danger">Eliminar Servicio</Button>
              </div>
            </div>
          </Modal>
        )}
        {isDetailsServiceModalOpen && serviceToProcess && (
          <Modal isOpen={isDetailsServiceModalOpen} onClose={closeDetailsServiceModal} title={`Detalles del Servicio: ${clients.find(c => c.id === serviceToProcess.clientId)?.clientName || ''}`} maxWidth="max-w-3xl">
            <div className="printable-area p-2 space-y-4 text-slate-700 dark:text-[rgba(255,255,255,0.87)]">
              <h3 className="text-xl font-semibold text-slate-800 dark:text-white mb-3 md:hidden">Ticket de Servicio</h3>
              {(() => {
                const client = clients.find(c => c.id === serviceToProcess.clientId);
                return (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                      <div><strong>Cliente:</strong> {client?.clientName || 'N/A'}</div>
                      <div><strong>NIT Cliente:</strong> {client?.nitCliente || 'N/A'}</div>
                      <div><strong>Teléfono Cliente:</strong> {client?.telefonoCliente || 'N/A'}</div>
                      {client?.email && <div><strong>Email Cliente:</strong> {client.email}</div>}
                      <div><strong>Fecha Servicio:</strong> {new Date(serviceToProcess.date).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                    </div>
                    <div className="dark:text-[rgba(255,255,255,0.60)]"><strong>Dirección Cliente:</strong> {client?.address || 'N/A'}</div>
                  </>
                );
              })()}
              <div className="dark:text-[rgba(255,255,255,0.60)]"><strong>Dirección del Servicio:</strong> {serviceToProcess.serviceAddress}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                <div><strong>Tipo de Servicio:</strong> {serviceToProcess.serviceType}</div>
                {serviceToProcess.serviceType === ServiceType.NEW_IP_CAMERA_INSTALLATION && serviceToProcess.numIpCameras !== undefined && (
                     <div><strong>Nº Cámaras IP:</strong> {serviceToProcess.numIpCameras}</div>
                )}
                {serviceToProcess.serviceType === ServiceType.NEW_DVR_INSTALLATION && serviceToProcess.numDvrCameras !== undefined && (
                     <div><strong>Nº Cámaras DVR:</strong> {serviceToProcess.numDvrCameras}</div>
                )}
                <div><strong>Técnico:</strong> {serviceToProcess.technician}</div>
              </div>
              <div><strong>Estado:</strong> <span className={`px-2 py-1 text-xs font-semibold rounded-full status-badge ${ serviceToProcess.status === ServiceStatus.COMPLETED ? 'bg-green-100 text-green-700 dark:bg-green-600/30 dark:text-green-300' : serviceToProcess.status === ServiceStatus.SCHEDULED ? 'bg-blue-100 text-blue-700 dark:bg-blue-600/30 dark:text-blue-300' : serviceToProcess.status === ServiceStatus.IN_PROGRESS ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-600/30 dark:text-yellow-300' : serviceToProcess.status === ServiceStatus.CANCELLED ? 'bg-red-100 text-red-700 dark:bg-red-600/30 dark:text-red-300' : 'bg-gray-100 text-gray-700 dark:bg-slate-600/30 dark:text-slate-300' }`}>{serviceToProcess.status}</span></div>
              {serviceToProcess.cost !== undefined && <div><strong>Costo:</strong> ${serviceToProcess.cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>}
              <div className="prose prose-sm dark:prose-invert max-w-none dark:text-[rgba(255,255,255,0.87)]"><strong>Descripción:</strong><p className="dark:text-[rgba(255,255,255,0.60)]">{serviceToProcess.description}</p></div>
              {serviceToProcess.notes && (<div className="prose prose-sm dark:prose-invert max-w-none dark:text-[rgba(255,255,255,0.87)]"><strong>Notas:</strong><p className="dark:text-[rgba(255,255,255,0.60)]">{serviceToProcess.notes}</p></div>)}
              
              {/* Device Label Photo */}
              {serviceToProcess.deviceLabelFoto && (
                <div className="mt-2">
                  <h4 className="text-md font-semibold mb-1">Foto Etiqueta del Dispositivo Principal:</h4>
                  <img 
                    src={serviceToProcess.deviceLabelFoto} 
                    alt="Foto Etiqueta del Dispositivo Principal" 
                    className="max-w-xs h-auto max-h-48 border rounded shadow cursor-pointer dark:border-[rgba(255,255,255,0.23)] object-contain" 
                    onClick={() => openImagePreviewModal(serviceToProcess.deviceLabelFoto!, 'Foto Etiqueta del Dispositivo Principal')} 
                  />
                </div>
              )}

              {/* QR Photos for IP Cameras */}
              {(serviceToProcess.serviceType === ServiceType.NEW_IP_CAMERA_INSTALLATION && serviceToProcess.qrDeviceFotos && serviceToProcess.qrDeviceFotos.length > 0) && (
                <div className="mt-2">
                  <h4 className="text-md font-semibold mb-1">Fotos QR de los Dispositivos IP:</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-start">
                    {serviceToProcess.qrDeviceFotos.map((foto, index) => foto && ( // Check if foto is defined before rendering
                      <div key={`qr-ip-${index}`} className="mt-1">
                        <img 
                            src={foto} 
                            alt={`Foto QR Disp. IP ${index + 1}`} 
                            className="max-w-full h-auto max-h-48 border rounded shadow cursor-pointer dark:border-[rgba(255,255,255,0.23)] object-contain" 
                            onClick={() => openImagePreviewModal(foto, `Foto QR Disp. IP ${index + 1}`)} 
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Single QR Device Foto (for non-IP Cam installations, e.g., DVR unit QR) */}
              {(serviceToProcess.serviceType !== ServiceType.NEW_IP_CAMERA_INSTALLATION && serviceToProcess.qrDeviceFotos && serviceToProcess.qrDeviceFotos.length > 0 && serviceToProcess.qrDeviceFotos[0]) && (
                <div className="mt-2">
                  <h4 className="text-md font-semibold mb-1">Foto QR del Dispositivo Principal:</h4>
                  <img 
                    src={serviceToProcess.qrDeviceFotos[0]} 
                    alt="Foto QR del Dispositivo Principal" 
                    className="max-w-xs h-auto max-h-48 border rounded shadow cursor-pointer dark:border-[rgba(255,255,255,0.23)] object-contain" 
                    onClick={() => openImagePreviewModal(serviceToProcess.qrDeviceFotos![0], 'Foto QR del Dispositivo Principal')} 
                  />
                </div>
              )}

              {/* DVR Camera Photos */}
              {(serviceToProcess.serviceType === ServiceType.NEW_DVR_INSTALLATION && serviceToProcess.dvrCameraFotos && serviceToProcess.dvrCameraFotos.length > 0) && (
                <div className="mt-2">
                  <h4 className="text-md font-semibold mb-1">Fotos de Cámaras DVR:</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-start">
                    {serviceToProcess.dvrCameraFotos.map((foto, index) => foto && ( // Check if foto is defined
                      <div key={`dvr-cam-${index}`} className="mt-1">
                        <img 
                            src={foto} 
                            alt={`Foto Cámara DVR ${index + 1}`} 
                            className="max-w-full h-auto max-h-48 border rounded shadow cursor-pointer dark:border-[rgba(255,255,255,0.23)] object-contain" 
                            onClick={() => openImagePreviewModal(foto, `Foto Cámara DVR ${index + 1}`)} 
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-[rgba(255,255,255,0.12)] no-print"><h4 className="text-lg font-semibold mb-3">Acciones</h4><div className="flex flex-wrap gap-3"><Button onClick={() => handleGeneratePdf(serviceToProcess)} variant="outline" size="sm"><PdfFileIcon className="w-4 h-4 mr-2" />Generar PDF</Button><Button onClick={() => handleShareWhatsApp(serviceToProcess)} variant="outline" size="sm" className="bg-green-500 hover:bg-green-600 text-white dark:bg-green-600 dark:hover:bg-green-700 dark:border-green-500 dark:text-white"><WhatsAppIcon className="w-4 h-4 mr-2" />Compartir WhatsApp</Button></div></div>
              <div className="mt-6 flex justify-end no-print"><Button onClick={closeDetailsServiceModal} variant="secondary">Cerrar</Button></div>
            </div>
          </Modal>
        )}
        {isPreviewImageModalOpen && imageToPreview && (
            <Modal isOpen={isPreviewImageModalOpen} onClose={closeImagePreviewModal} title={imageToPreview.alt} maxWidth="max-w-3xl">
                <img src={imageToPreview.src} alt={imageToPreview.alt} className="max-w-full max-h-[80vh] mx-auto object-contain rounded"/>
                 <div className="mt-4 flex justify-end">
                    <Button onClick={closeImagePreviewModal} variant="secondary">Cerrar</Button>
                </div>
            </Modal>
        )}
      </div>
    </ToastContext.Provider>
  );
};

export default App;
