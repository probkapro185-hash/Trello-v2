export const attachmentTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf", "text/plain", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation"];
export const maxAttachmentSize = 10 * 1024 * 1024;
export const activityNames: Record<string, string> = {
  "task.created": "создал(а) задачу", "task.deleted": "удалил(а) задачу", "task.updated": "изменил(а) задачу", "task.moved": "переместил(а) задачу",
  "task.assigned": "назначил(а) исполнителя", "task.unassigned": "снял(а) исполнителя",
  "comment.created": "добавил(а) комментарий", "comment.updated": "изменил(а) комментарий", "comment.deleted": "удалил(а) комментарий",
  "attachment.added": "прикрепил(а) файл", "attachment.deleted": "удалил(а) файл",
  "label.added": "добавил(а) метку", "label.removed": "убрал(а) метку",
  "checklist.created": "создал(а) чеклист", "checklist.updated": "изменил(а) чеклист", "checklist.deleted": "удалил(а) чеклист",
  "checklist_item.created": "добавил(а) пункт", "checklist_item.updated": "изменил(а) пункт", "checklist_item.deleted": "удалил(а) пункт",
  "checklist_item.completed": "выполнил(а) пункт", "checklist_item.reopened": "вернул(а) пункт в работу",
};
export const activityFields: Record<string, string> = { title: "название", description: "описание", priority: "приоритет", due_date: "срок", column_id: "колонка" };
export const formatTimestamp = (value: string) => new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
