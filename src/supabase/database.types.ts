export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: { [_ in never]: never };
    Views: { [_ in never]: never };
    Functions: {
      strato_access_directory: {
        Args: { p_tenant_id: string };
        Returns: Json;
      };
      strato_current_principal: {
        Args: { p_tenant_id: string };
        Returns: Json;
      };
      strato_save_access_directory: {
        Args: { p_state: Json; p_tenant_id: string };
        Returns: Json;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
