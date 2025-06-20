
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database { // Added export keyword
  public: {
    Tables: {
      clients: {
        Row: {
          id: string
          client_name: string
          nit_cliente: string
          telefono_cliente: string
          address: string
          email: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string // UUID is auto-generated
          client_name: string
          nit_cliente: string
          telefono_cliente: string
          address: string
          email?: string | null
          created_at?: string // Handled by Supabase
          updated_at?: string // Handled by Supabase
        }
        Update: {
          id?: string
          client_name?: string
          nit_cliente?: string
          telefono_cliente?: string
          address?: string
          email?: string | null
          // created_at and updated_at are typically not updated directly
        }
        Relationships: []
      }
      services: {
        Row: {
          id: string
          client_id: string
          service_address: string
          num_ip_cameras: number | null
          qr_device_fotos: string[] | null
          device_label_foto: string | null
          num_dvr_cameras: number | null // Added column
          dvr_camera_fotos: string[] | null // Added column
          date: string // ISO date string 'YYYY-MM-DD'
          service_type: string
          description: string
          technician: string
          status: string
          cost: number | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string // UUID is auto-generated
          client_id: string
          service_address: string
          num_ip_cameras?: number | null
          qr_device_fotos?: string[] | null
          device_label_foto?: string | null
          num_dvr_cameras?: number | null // Added column
          dvr_camera_fotos?: string[] | null // Added column
          date: string
          service_type: string
          description: string
          technician: string
          status: string
          cost?: number | null
          notes?: string | null
          created_at?: string // Handled by Supabase
          updated_at?: string // Handled by Supabase
        }
        Update: {
          id?: string
          client_id?: string
          service_address?: string
          num_ip_cameras?: number | null
          qr_device_fotos?: string[] | null
          device_label_foto?: string | null
          num_dvr_cameras?: number | null // Added column
          dvr_camera_fotos?: string[] | null // Added column
          date?: string
          service_type?: string
          description?: string
          technician?: string
          status?: string
          cost?: number | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "services_client_id_fkey" // Ensure this matches your actual FK constraint name
            columns: ["client_id"]
            referencedRelation: "clients"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
        handle_updated_at: { // Assuming you created this function from the SQL
        Args: Record<PropertyKey, never>
        Returns: unknown // or the specific return type if known
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Map app's Client type to Supabase Row type
export type ClientRow = Database['public']['Tables']['clients']['Row'];
// Map app's Service type to Supabase Row type
export type ServiceRow = Database['public']['Tables']['services']['Row'];