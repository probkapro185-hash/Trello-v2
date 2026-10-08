import type { Enums, Tables, TablesInsert, TablesUpdate } from "@/types/database";

export type Profile = Tables<"profiles">;
export type Workspace = Tables<"workspaces">;
export type WorkspaceMember = Tables<"workspace_members">;
export type WorkspaceRole = Enums<"workspace_role">;
export type Board = Tables<"boards">;
export type BoardColumn = Tables<"columns">;
export type Task = Tables<"tasks">;
export type TaskCard = Pick<Task, "id" | "workspace_id" | "board_id" | "column_id" | "title" | "priority" | "due_date" | "position" | "version">;
export type TaskAssignee = Tables<"task_assignees">;
export type TaskPriority = Enums<"task_priority">;
export type Label = Tables<"labels">;
export type TaskLabel = Tables<"task_labels">;
export type Checklist = Tables<"checklists">;
export type ChecklistItem = Tables<"checklist_items">;
export type Comment = Tables<"comments">;
export type Attachment = Tables<"attachments">;
export type Activity = Tables<"activities">;
export type Invite = Tables<"invites">;

// API input types exclude server-owned metadata, even when generated DB types
// include it. Runtime validation and authorization still happen independently.
export type CreateTaskInput = Pick<
  TablesInsert<"tasks">,
  "id" | "workspace_id" | "board_id" | "column_id" | "title" | "position"
>;
export type UpdateTaskInput = Pick<
  TablesUpdate<"tasks">,
  "title" | "description" | "priority" | "due_date" | "column_id" | "position"
>;

export type TaskSummary = Task & {
  assignees: Pick<Profile, "id" | "name" | "avatar_path">[];
  labels: Label[];
  checklistProgress: { completed: number; total: number };
};

export type BoardSnapshot = {
  board: Board;
  columns: BoardColumn[];
  tasks: TaskSummary[];
};

export type BoardPresence = {
  userId: Profile["id"];
  onlineAt: string;
};

export type MutationResult<T> =
  | { data: T; error: null }
  | { data: null; error: { code: string; message: string } };
