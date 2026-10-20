export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      album_photos: {
        Row: {
          bytes: number | null;
          created_at: string;
          height: number | null;
          hidden: boolean;
          id: string;
          invitation_id: string;
          path: string;
          width: number | null;
        };
        ComputedFields: never;
        Insert: {
          bytes?: number | null;
          created_at?: string;
          height?: number | null;
          hidden?: boolean;
          id?: string;
          invitation_id: string;
          path: string;
          width?: number | null;
        };
        Update: {
          bytes?: number | null;
          created_at?: string;
          height?: number | null;
          hidden?: boolean;
          id?: string;
          invitation_id?: string;
          path?: string;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'album_photos_invitation_id_fkey';
            columns: ['invitation_id'];
            isOneToOne: false;
            referencedRelation: 'invitations';
            referencedColumns: ['id'];
          },
        ];
      };
      attendees: {
        Row: {
          age: number | null;
          dietary: string | null;
          full_name: string;
          id: string;
          invitation_id: string;
          kind: string;
          menu: string | null;
          position: number;
        };
        ComputedFields: never;
        Insert: {
          age?: number | null;
          dietary?: string | null;
          full_name: string;
          id?: string;
          invitation_id: string;
          kind?: string;
          menu?: string | null;
          position: number;
        };
        Update: {
          age?: number | null;
          dietary?: string | null;
          full_name?: string;
          id?: string;
          invitation_id?: string;
          kind?: string;
          menu?: string | null;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'attendees_invitation_id_fkey';
            columns: ['invitation_id'];
            isOneToOne: false;
            referencedRelation: 'invitations';
            referencedColumns: ['id'];
          },
        ];
      };
      invitations: {
        Row: {
          attending: boolean | null;
          attends_ceremony: boolean | null;
          attends_reception: boolean | null;
          code: string;
          contact_phone: string | null;
          created_at: string;
          display_name: string;
          email: string | null;
          first_opened_at: string | null;
          group_name: string | null;
          id: string;
          last_opened_at: string | null;
          message: string | null;
          needs_lodging: boolean | null;
          needs_transport: boolean | null;
          notes: string | null;
          open_count: number;
          phone: string | null;
          responded_at: string | null;
          seats: number;
          sent_at: string | null;
          side: string;
          song_request: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          attending?: boolean | null;
          attends_ceremony?: boolean | null;
          attends_reception?: boolean | null;
          code: string;
          contact_phone?: string | null;
          created_at?: string;
          display_name: string;
          email?: string | null;
          first_opened_at?: string | null;
          group_name?: string | null;
          id?: string;
          last_opened_at?: string | null;
          message?: string | null;
          needs_lodging?: boolean | null;
          needs_transport?: boolean | null;
          notes?: string | null;
          open_count?: number;
          phone?: string | null;
          responded_at?: string | null;
          seats?: number;
          sent_at?: string | null;
          side?: string;
          song_request?: string | null;
          updated_at?: string;
        };
        Update: {
          attending?: boolean | null;
          attends_ceremony?: boolean | null;
          attends_reception?: boolean | null;
          code?: string;
          contact_phone?: string | null;
          created_at?: string;
          display_name?: string;
          email?: string | null;
          first_opened_at?: string | null;
          group_name?: string | null;
          id?: string;
          last_opened_at?: string | null;
          message?: string | null;
          needs_lodging?: boolean | null;
          needs_transport?: boolean | null;
          notes?: string | null;
          open_count?: number;
          phone?: string | null;
          responded_at?: string | null;
          seats?: number;
          sent_at?: string | null;
          side?: string;
          song_request?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      site_content: {
        Row: {
          id: number;
          private_data: NonNullable<Json>;
          public_data: NonNullable<Json>;
          updated_at: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          id?: number;
          private_data?: NonNullable<Json>;
          public_data?: NonNullable<Json>;
          updated_at?: string;
          version?: number;
        };
        Update: {
          id?: number;
          private_data?: NonNullable<Json>;
          public_data?: NonNullable<Json>;
          updated_at?: string;
          version?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_album_stats: { Args: Record<PropertyKey, never>; Returns: Json };
      admin_dashboard: { Args: Record<PropertyKey, never>; Returns: Json };
      admin_reset_rsvp: { Args: { p_invitation_id: string }; Returns: undefined };
      admin_rotate_sheet_secret: { Args: Record<PropertyKey, never>; Returns: string };
      admin_save_rsvp: { Args: { p_invitation_id: string; p_payload: Json }; Returns: Json };
      admin_sheet_settings: { Args: Record<PropertyKey, never>; Returns: Json };
      export_for_sheet: { Args: { p_hash?: string; p_secret: string }; Returns: Json };
      get_content: { Args: Record<PropertyKey, never>; Returns: Json };
      get_invitation: { Args: { p_code: string; p_track?: boolean }; Returns: Json };
      ping: { Args: Record<PropertyKey, never>; Returns: number };
      register_album_photo: {
        Args: { p_code: string; p_meta?: Json; p_path: string };
        Returns: undefined;
      };
      submit_rsvp: { Args: { p_code: string; p_payload: Json }; Returns: Json };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
