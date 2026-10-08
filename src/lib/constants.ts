export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
export const POSITION_STEP = 1024;
export const TASK_ATTACHMENTS_BUCKET = "task-attachments";
export const AVATARS_BUCKET = "avatars";
export const ATTACHMENT_MIME_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf", "text/plain",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
] as const;
