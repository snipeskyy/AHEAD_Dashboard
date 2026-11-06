import { ListTodo } from "lucide-react";
import type { AccModule } from "../types";

const tasks: AccModule = {
  id: "tasks",
  title: "Tasks",
  description: "Follow-ups linked to accounts, opportunities, signals and contacts. Recurring tasks reschedule themselves.",
  icon: ListTodo,
  category: "pipeline",
  order: 25,
  status: "stable",
  routes: [{ path: "tasks", title: "Tasks", nav: true, load: () => import("./pages/tasks-page") }],
  widgets: [
    {
      id: "tasks.due",
      title: "Tasks due",
      description: "Overdue and due this week",
      defaultSize: "md",
      sizes: ["sm", "md", "lg"],
      load: () => import("./widgets/tasks-due"),
    },
  ],
  exportSections: [],
  commands: [
    { id: "nav.tasks", label: "Go to Tasks", group: "Navigate", href: "/tasks", shortcut: "G T" },
    { id: "create.task", label: "New task", group: "Create", action: "task.create", keywords: ["todo", "follow up", "task"] },
    { id: "create.capture", label: "Quick capture meeting notes", group: "Create", action: "capture.open", keywords: ["notes", "capture", "meeting"] },
    { id: "help.shortcuts", label: "Keyboard shortcuts", group: "Actions", action: "help.open", keywords: ["help", "keys", "?"] },
  ],
};

export default tasks;
