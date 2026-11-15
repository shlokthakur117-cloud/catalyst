export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "elder" | "caregiver";
export type RelationshipStatus = "active" | "pending" | "revoked";
export type MedicationStatus = "active" | "discontinued";
export type DoseStatus =
  | "scheduled"
  | "reminded"
  | "taken"
  | "not_yet"
  | "unsure"
  | "unconfirmed"
  | "skipped";
export type AlertType = "unconfirmed_dose" | "unsure_dose" | "missed_appointment";
export type AlertUrgency = "medium" | "high" | "critical";
export type AlertStatus = "open" | "claimed" | "resolved";
export type AppointmentStatus = "upcoming" | "completed" | "cancelled";
export type DoseActorRole = "elder" | "caregiver" | "system";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: UserRole;
          full_name: string;
          email: string;
          phone: string | null;
          emergency_contact_phone: string | null;
          emergency_notes: string | null;
          pin_hash: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role: UserRole;
          full_name: string;
          email: string;
          phone?: string | null;
          emergency_contact_phone?: string | null;
          emergency_notes?: string | null;
          pin_hash?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          role?: UserRole;
          full_name?: string;
          email?: string;
          phone?: string | null;
          emergency_contact_phone?: string | null;
          emergency_notes?: string | null;
          pin_hash?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      care_relationships: {
        Row: {
          id: string;
          elder_id: string;
          caregiver_id: string;
          relationship_type: string;
          status: RelationshipStatus;
          invite_code: string | null;
          expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          elder_id: string;
          caregiver_id: string;
          relationship_type?: string;
          status?: RelationshipStatus;
          invite_code?: string | null;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          elder_id?: string;
          caregiver_id?: string;
          relationship_type?: string;
          status?: RelationshipStatus;
          invite_code?: string | null;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      medications: {
        Row: {
          id: string;
          elder_id: string;
          name: string;
          strength: string;
          instructions: string;
          prescribing_doctor: string | null;
          rx_number: string | null;
          warnings: string | null;
          status: MedicationStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          elder_id: string;
          name: string;
          strength: string;
          instructions: string;
          prescribing_doctor?: string | null;
          rx_number?: string | null;
          warnings?: string | null;
          status?: MedicationStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          elder_id?: string;
          name?: string;
          strength?: string;
          instructions?: string;
          prescribing_doctor?: string | null;
          rx_number?: string | null;
          warnings?: string | null;
          status?: MedicationStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      medication_schedules: {
        Row: {
          id: string;
          medication_id: string;
          elder_id: string;
          time_of_day: string;
          exact_time: string | null;
          days_of_week: number[];
          dose_amount: string;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          medication_id: string;
          elder_id: string;
          time_of_day: string;
          exact_time?: string | null;
          days_of_week?: number[];
          dose_amount?: string;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          medication_id?: string;
          elder_id?: string;
          time_of_day?: string;
          exact_time?: string | null;
          days_of_week?: number[];
          dose_amount?: string;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      dose_logs: {
        Row: {
          id: string;
          schedule_id: string | null;
          medication_id: string;
          elder_id: string;
          scheduled_for: string;
          status: DoseStatus;
          reminded_at: string | null;
          confirmed_at: string | null;
          confirmed_by: string | null;
          actor_role: DoseActorRole | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          schedule_id?: string | null;
          medication_id: string;
          elder_id: string;
          scheduled_for: string;
          status?: DoseStatus;
          reminded_at?: string | null;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          actor_role?: DoseActorRole | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          schedule_id?: string | null;
          medication_id?: string;
          elder_id?: string;
          scheduled_for?: string;
          status?: DoseStatus;
          reminded_at?: string | null;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          actor_role?: DoseActorRole | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      caregiver_alerts: {
        Row: {
          id: string;
          elder_id: string;
          dose_log_id: string | null;
          alert_type: AlertType;
          urgency: AlertUrgency;
          status: AlertStatus;
          claimed_by: string | null;
          claimed_at: string | null;
          resolved_at: string | null;
          resolution_notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          elder_id: string;
          dose_log_id?: string | null;
          alert_type: AlertType;
          urgency?: AlertUrgency;
          status?: AlertStatus;
          claimed_by?: string | null;
          claimed_at?: string | null;
          resolved_at?: string | null;
          resolution_notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          elder_id?: string;
          dose_log_id?: string | null;
          alert_type?: AlertType;
          urgency?: AlertUrgency;
          status?: AlertStatus;
          claimed_by?: string | null;
          claimed_at?: string | null;
          resolved_at?: string | null;
          resolution_notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      appointments: {
        Row: {
          id: string;
          elder_id: string;
          title: string;
          doctor_name: string;
          clinic_address: string | null;
          scheduled_at: string;
          companion_notes: string | null;
          status: AppointmentStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          elder_id: string;
          title: string;
          doctor_name: string;
          clinic_address?: string | null;
          scheduled_at: string;
          companion_notes?: string | null;
          status?: AppointmentStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          elder_id?: string;
          title?: string;
          doctor_name?: string;
          clinic_address?: string | null;
          scheduled_at?: string;
          companion_notes?: string | null;
          status?: AppointmentStatus;
          created_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          elder_id: string;
          actor_id: string | null;
          actor_role: string;
          action: string;
          entity_type: string;
          entity_id: string;
          old_values: Json | null;
          new_values: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          elder_id: string;
          actor_id?: string | null;
          actor_role: string;
          action: string;
          entity_type: string;
          entity_id: string;
          old_values?: Json | null;
          new_values?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          elder_id?: string;
          actor_id?: string | null;
          actor_role?: string;
          action?: string;
          entity_type?: string;
          entity_id?: string;
          old_values?: Json | null;
          new_values?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      user_role: UserRole;
      relationship_status: RelationshipStatus;
      medication_status: MedicationStatus;
      dose_status: DoseStatus;
      alert_type: AlertType;
      alert_urgency: AlertUrgency;
      alert_status: AlertStatus;
      appointment_status: AppointmentStatus;
      dose_actor_role: DoseActorRole;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
