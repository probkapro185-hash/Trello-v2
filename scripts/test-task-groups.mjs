import { strict as assert } from "node:assert";
import { deadlineGroup, localToday, taskHref } from "../src/features/tasks/task-groups.ts";
import { safeNext } from "../src/lib/navigation.ts";

// Calendar dates must not drift to the previous day when interpreted in a timezone.
assert.equal(localToday(new Date(2026, 9, 8, 0, 1)), "2026-10-08");
assert.equal(deadlineGroup("2026-10-08", "2026-10-08"), "Сегодня");
assert.equal(deadlineGroup("2026-10-07", "2026-10-08"), "Просрочены");
assert.equal(deadlineGroup("2027-01-01", "2026-12-31"), "Предстоящие");
assert.equal(deadlineGroup(null, "2026-10-08"), "Без срока");
assert.equal(taskHref({ id: "task", workspace_id: "workspace", board_id: "board" }), "/workspaces/workspace/boards/board?task=task");
assert.equal(safeNext("/my-tasks"), "/my-tasks");
for (const unsafe of ["//example.com", "https://example.com", "/my-tasks/../../elsewhere", "/my-tasks?next=https://example.com"]) assert.equal(safeNext(unsafe), "/workspaces");
console.log("PASS: local calendar grouping, task links and redirect allowlist (11 assertions)");
