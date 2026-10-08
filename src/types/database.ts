
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "activities": {
                  Row: {
                    "action": string,"actor_id": string | null,"board_id": string | null,"created_at": string,"id": string,"metadata": NonNullable<Json>,"task_id": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"board_id"?: string | null,"created_at"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"task_id"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"board_id"?: string | null,"created_at"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"task_id"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "activities_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activities_board_id_workspace_id_fkey"
      columns: ["board_id","workspace_id"]
isOneToOne: false
      referencedRelation: "boards"
      referencedColumns: ["id","workspace_id"]
    },{
      foreignKeyName: "activities_task_id_board_id_workspace_id_fkey"
      columns: ["task_id","board_id","workspace_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id","board_id","workspace_id"]
    },{
      foreignKeyName: "activities_task_id_workspace_id_fkey"
      columns: ["task_id","workspace_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id","workspace_id"]
    },{
      foreignKeyName: "activities_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"attachments": {
                  Row: {
                    "board_id": string,"bucket_id": string,"created_at": string,"created_by": string | null,"expires_at": string | null,"id": string,"mime_type": string,"name": string,"size_bytes": number,"storage_path": string,"task_id": string,"upload_state": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "board_id": string,"bucket_id"?: string,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string | null,"id"?: string,"mime_type": string,"name": string,"size_bytes": number,"storage_path": string,"task_id": string,"upload_state"?: string,"workspace_id": string
                  }
                  Update: {
                    "board_id"?: string,"bucket_id"?: string,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string | null,"id"?: string,"mime_type"?: string,"name"?: string,"size_bytes"?: number,"storage_path"?: string,"task_id"?: string,"upload_state"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attachments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attachments_task_id_board_id_workspace_id_fkey"
      columns: ["task_id","board_id","workspace_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id","board_id","workspace_id"]
    }
                  ]
                },"boards": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"name": string,"position": number,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"name": string,"position"?: number,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"name"?: string,"position"?: number,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "boards_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "boards_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"checklist_items": {
                  Row: {
                    "board_id": string,"checklist_id": string,"created_at": string,"created_by": string | null,"id": string,"is_completed": boolean,"position": number,"task_id": string,"text": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "board_id": string,"checklist_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_completed"?: boolean,"position"?: number,"task_id": string,"text": string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "board_id"?: string,"checklist_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_completed"?: boolean,"position"?: number,"task_id"?: string,"text"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "checklist_items_checklist_id_task_id_board_id_workspace_id_fkey"
      columns: ["checklist_id","task_id","board_id","workspace_id"]
isOneToOne: false
      referencedRelation: "checklists"
      referencedColumns: ["id","task_id","board_id","workspace_id"]
    },{
      foreignKeyName: "checklist_items_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"checklists": {
                  Row: {
                    "board_id": string,"created_at": string,"created_by": string | null,"id": string,"position": number,"task_id": string,"title": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "board_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"position"?: number,"task_id": string,"title"?: string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "board_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"position"?: number,"task_id"?: string,"title"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "checklists_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "checklists_task_id_board_id_workspace_id_fkey"
      columns: ["task_id","board_id","workspace_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id","board_id","workspace_id"]
    }
                  ]
                },"columns": {
                  Row: {
                    "board_id": string,"created_at": string,"created_by": string | null,"id": string,"is_done": boolean,"name": string,"position": number,"updated_at": string,"version": number,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "board_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_done"?: boolean,"name": string,"position"?: number,"updated_at"?: string,"version"?: number,"workspace_id": string
                  }
                  Update: {
                    "board_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_done"?: boolean,"name"?: string,"position"?: number,"updated_at"?: string,"version"?: number,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "columns_board_id_workspace_id_fkey"
      columns: ["board_id","workspace_id"]
isOneToOne: false
      referencedRelation: "boards"
      referencedColumns: ["id","workspace_id"]
    },{
      foreignKeyName: "columns_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"comments": {
                  Row: {
                    "board_id": string,"body": string,"created_at": string,"created_by": string | null,"id": string,"task_id": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "board_id": string,"body": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"task_id": string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "board_id"?: string,"body"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"task_id"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "comments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_task_id_board_id_workspace_id_fkey"
      columns: ["task_id","board_id","workspace_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id","board_id","workspace_id"]
    }
                  ]
                },"invites": {
                  Row: {
                    "created_at": string,"created_by": string | null,"expires_at": string,"id": string,"max_uses": number,"revoked_at": string | null,"token_hash": string,"use_count": number,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"id"?: string,"max_uses"?: number,"revoked_at"?: string | null,"token_hash": string,"use_count"?: number,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"id"?: string,"max_uses"?: number,"revoked_at"?: string | null,"token_hash"?: string,"use_count"?: number,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invites_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invites_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"labels": {
                  Row: {
                    "color": string,"created_at": string,"created_by": string | null,"id": string,"name": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"name": string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "color"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"name"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "labels_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "labels_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_path": string | null,"created_at": string,"id": string,"name": string,"updated_at": string,"username": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_path"?: string | null,"created_at"?: string,"id": string,"name": string,"updated_at"?: string,"username": string
                  }
                  Update: {
                    "avatar_path"?: string | null,"created_at"?: string,"id"?: string,"name"?: string,"updated_at"?: string,"username"?: string
                  }
                  Relationships: [
                    
                  ]
                },"task_assignees": {
                  Row: {
                    "assigned_by": string | null,"board_id": string,"created_at": string,"task_id": string,"user_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_by"?: string | null,"board_id": string,"created_at"?: string,"task_id": string,"user_id": string,"workspace_id": string
                  }
                  Update: {
                    "assigned_by"?: string | null,"board_id"?: string,"created_at"?: string,"task_id"?: string,"user_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_assignees_assigned_by_fkey"
      columns: ["assigned_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_assignees_task_id_board_id_workspace_id_fkey"
      columns: ["task_id","board_id","workspace_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id","board_id","workspace_id"]
    },{
      foreignKeyName: "task_assignees_workspace_id_user_id_fkey"
      columns: ["workspace_id","user_id"]
isOneToOne: false
      referencedRelation: "workspace_members"
      referencedColumns: ["workspace_id","user_id"]
    }
                  ]
                },"task_labels": {
                  Row: {
                    "board_id": string,"created_at": string,"created_by": string | null,"label_id": string,"task_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "board_id": string,"created_at"?: string,"created_by"?: string | null,"label_id": string,"task_id": string,"workspace_id": string
                  }
                  Update: {
                    "board_id"?: string,"created_at"?: string,"created_by"?: string | null,"label_id"?: string,"task_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_labels_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_labels_label_id_workspace_id_fkey"
      columns: ["label_id","workspace_id"]
isOneToOne: false
      referencedRelation: "labels"
      referencedColumns: ["id","workspace_id"]
    },{
      foreignKeyName: "task_labels_task_id_board_id_workspace_id_fkey"
      columns: ["task_id","board_id","workspace_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id","board_id","workspace_id"]
    }
                  ]
                },"tasks": {
                  Row: {
                    "board_id": string,"column_id": string,"created_at": string,"created_by": string | null,"description": string,"due_date": string | null,"id": string,"position": number,"priority": Database["public"]['Enums']["task_priority"],"title": string,"updated_at": string,"version": number,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "board_id": string,"column_id": string,"created_at"?: string,"created_by"?: string | null,"description"?: string,"due_date"?: string | null,"id"?: string,"position"?: number,"priority"?: Database["public"]['Enums']["task_priority"],"title": string,"updated_at"?: string,"version"?: number,"workspace_id": string
                  }
                  Update: {
                    "board_id"?: string,"column_id"?: string,"created_at"?: string,"created_by"?: string | null,"description"?: string,"due_date"?: string | null,"id"?: string,"position"?: number,"priority"?: Database["public"]['Enums']["task_priority"],"title"?: string,"updated_at"?: string,"version"?: number,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tasks_column_id_board_id_workspace_id_fkey"
      columns: ["column_id","board_id","workspace_id"]
isOneToOne: false
      referencedRelation: "columns"
      referencedColumns: ["id","board_id","workspace_id"]
    },{
      foreignKeyName: "tasks_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"workspace_members": {
                  Row: {
                    "joined_at": string,"role": Database["public"]['Enums']["workspace_role"],"user_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "joined_at"?: string,"role"?: Database["public"]['Enums']["workspace_role"],"user_id": string,"workspace_id": string
                  }
                  Update: {
                    "joined_at"?: string,"role"?: Database["public"]['Enums']["workspace_role"],"user_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workspace_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workspace_members_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspaces": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"owner_id": string,"realtime_epoch": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"owner_id": string,"realtime_epoch"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"owner_id"?: string,"realtime_epoch"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workspaces_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_workspace_invite":
{ Args: { "invite_token": string }; Returns: Json
                           },
"claim_storage_cleanup":
{ Args: Record<PropertyKey, never>; Returns: {
              "lease": string,"path": string
            }[]
                           },
"complete_storage_cleanup":
{ Args: { "claim_lease": string,"object_path": string }; Returns: undefined
                           },
"create_workspace_invite":
{ Args: { "target_workspace": string }; Returns: Json
                           },
"finalize_attachment":
{ Args: { "attachment_id": string }; Returns: undefined
                           },
"inspect_workspace_invite":
{ Args: { "invite_token": string }; Returns: Json
                           },
"move_task":
{ Args: { "expected_version": number,"new_position": number,"target_column": string,"target_task": string }; Returns: Json
                           },
"my_tasks":
{ Args: { "page_number"?: number,"show_completed"?: boolean }; Returns: {
              "board_id": string,"board_name": string,"due_date": string,"id": string,"is_done": boolean,"priority": Database["public"]['Enums']["task_priority"],"title": string,"workspace_id": string,"workspace_name": string
            }[]
                           },
"reorder_task":
{ Args: { "expected_version": number,"next_task": string,"previous_task": string,"target_column": string,"target_task": string }; Returns: Json
                           },
"reserve_attachment":
{ Args: { "file_name": string,"file_size": number,"file_type": string,"target_task": string }; Returns: {
              "board_id": string,
"bucket_id": string,
"created_at": string,
"created_by": string | null,
"expires_at": string | null,
"id": string,
"mime_type": string,
"name": string,
"size_bytes": number,
"storage_path": string,
"task_id": string,
"upload_state": string,
"workspace_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "attachments"
        isOneToOne: true
        isSetofReturn: false
      } },
"save_task_details":
{ Args: { "details": Json,"expected_version": number,"target_task": string }; Returns: Json
                           },
"search_tasks":
{ Args: { "page_number"?: number,"search_query": string }; Returns: {
              "board_id": string,"board_name": string,"description": string,"due_date": string,"id": string,"is_done": boolean,"priority": Database["public"]['Enums']["task_priority"],"title": string,"workspace_id": string,"workspace_name": string
            }[]
                           },
"workspace_summaries":
{ Args: Record<PropertyKey, never>; Returns: {
              "board_count": number,"member_count": number,"recent_boards": Json,"task_count": number,"workspace_id": string
            }[]
                           }
          }
          Enums: {
            "task_priority": "low"|"medium"|"high"|"urgent","workspace_role": "owner"|"member"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "task_priority": ["low", "medium", "high", "urgent"],"workspace_role": ["owner", "member"]
          }
        }
} as const
