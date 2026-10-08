export function localToday(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function deadlineGroup(due: string | null, today: string) {
  if (!due) return "Без срока";
  if (due < today) return "Просрочены";
  if (due === today) return "Сегодня";
  return "Предстоящие";
}

export function taskHref(task: { id: string; workspace_id: string; board_id: string }) {
  return `/workspaces/${task.workspace_id}/boards/${task.board_id}?task=${task.id}`;
}
