export const previewColumns = ["id", "title", "group", "content", "created_at", "updated_at"];
export const previewSchema = previewColumns.map((field) => ({ field, key: field === "id" ? "PRI" : "" }));
export const previewRows = [
    { id: 1, title: "Meeting notes", group: "Work", content: "Discussed the next product release", created_at: "2026-10-19 09:30", updated_at: "2026-10-19 10:12" },
    { id: 2, title: "Ideas", group: "Work", content: "Explore a simpler onboarding flow", created_at: "2026-10-18 16:42", updated_at: "2026-10-18 17:05" },
    { id: 3, title: "Shopping list", group: "Personal", content: "Coffee, bread, olive oil", created_at: "2026-10-17 12:08", updated_at: "2026-10-17 12:08" },
    { id: 4, title: "Reading list", group: "Personal", content: "Articles to review this week", created_at: "2026-10-16 08:21", updated_at: "2026-10-16 08:21" },
    { id: 5, title: "Project outline", group: "Work", content: "Initial structure and milestones", created_at: "2026-10-15 14:54", updated_at: "2026-10-15 15:20" },
    { id: 6, title: "Weekly review", group: "Work", content: "Review priorities and open tasks", created_at: "2026-10-14 10:05", updated_at: "2026-10-14 10:40" },
    { id: 7, title: "Design feedback", group: "Work", content: "Notes from the latest design review", created_at: "2026-10-13 15:18", updated_at: "2026-10-13 16:02" },
    { id: 8, title: "Travel plans", group: "Personal", content: "Check train times and accommodation", created_at: "2026-10-12 11:36", updated_at: "2026-10-12 11:36" },
    { id: 9, title: "Release checklist", group: "Work", content: "Final checks before deployment", created_at: "2026-10-11 09:22", updated_at: "2026-10-11 10:01" },
    { id: 10, title: "Quick reminder", group: "Personal", content: "Send the updated document", created_at: "2026-10-10 17:44", updated_at: "2026-10-10 17:44" },
    { id: 11, title: "Research", group: "Work", content: "Collect sources for the next article", created_at: "2026-10-09 13:11", updated_at: "2026-10-09 14:27" },
    { id: 12, title: "Ideas for later", group: "Personal", content: "Small improvements to revisit", created_at: "2026-10-08 08:55", updated_at: "2026-10-08 08:55" },
    { id: 13, title: "Sprint planning", group: "Work", content: "Prepare priorities for the next sprint", created_at: "2026-10-07 10:16", updated_at: "2026-10-07 11:03" },
    { id: 14, title: "Weekend plans", group: "Personal", content: "Check the weather and book a table", created_at: "2026-10-06 18:24", updated_at: "2026-10-06 18:24" },
    { id: 15, title: "Customer feedback", group: "Work", content: "Summarize the latest support requests", created_at: "2026-10-05 09:42", updated_at: "2026-10-05 10:30" },
    { id: 16, title: "Home projects", group: "Personal", content: "Measure the shelves for the study", created_at: "2026-10-04 14:05", updated_at: "2026-10-04 14:05" },
    { id: 17, title: "Launch checklist", group: "Work", content: "Confirm documentation and release notes", created_at: "2026-10-03 11:28", updated_at: "2026-10-03 12:10" },
    { id: 18, title: "Books to read", group: "Personal", content: "Add two titles to the reading list", created_at: "2026-10-02 08:34", updated_at: "2026-10-02 08:34" },
    { id: 19, title: "Team retro", group: "Work", content: "Capture action items from the retrospective", created_at: "2026-10-01 16:20", updated_at: "2026-10-01 17:02" },
    { id: 20, title: "Recipe ideas", group: "Personal", content: "Try the pasta recipe saved last week", created_at: "2026-09-30 19:12", updated_at: "2026-09-30 19:12" },
];
