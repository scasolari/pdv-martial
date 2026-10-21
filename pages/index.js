import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DatabaseEngineIcon from "@/components/databaseEngineIcon";
import QueryResultsTable from "@/components/queryResults/table";
import TableFilters from "@/components/queryResults/table/filters";
import TableGrouping from "@/components/queryResults/table/grouping";
import { PiGithubLogoBold } from "react-icons/pi";
import { FaMicrosoft } from "react-icons/fa6";
import { SiMariadb, SiMysql, SiPostgresql, SiSqlite } from "react-icons/si";
import {
    ChevronsLeft,
    ChevronsRight,
    ChevronsUpDown,
    ChevronDown,
    Code2,
    CircleUserRound,
    Columns3,
    Download,
    History,
    PanelLeftOpen,
    Plus,
    RefreshCcw,
    Search,
    Settings2,
    Table as TableIcon,
    Trash2,
    X,
} from "lucide-react";

const previewColumns = ["id", "title", "group", "content", "created_at", "updated_at"];
const previewSchema = previewColumns.map((field) => ({ field, key: field === "id" ? "PRI" : "" }));
const previewRows = [
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

function DashboardTopbar() {
    const iconButton = "h-6 w-6 border-0 bg-transparent p-1 text-zinc-700 shadow-none hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800";
    const actionButton = "flex h-6 items-center gap-1 border-0 bg-white p-1 px-2 text-black shadow-none ring-1 ring-zinc-300 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-800 !text-xs !font-semibold";

    return <div className="bg-zinc-50 dark:bg-zinc-950">
        <div className="flex h-[53px] w-full items-center justify-between border-b bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/30">
            <div className="flex items-center gap-2 px-4 py-3">
                <div className="flex items-center gap-2">
                    <Button aria-label="Show navigation" className={iconButton}><PanelLeftOpen size={14} /></Button>
                    <Button aria-label="Open account menu" className="h-7 w-7 rounded-full border-0 bg-transparent p-0 text-zinc-700 shadow-none hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"><CircleUserRound size={20} /></Button>
                </div>
                <Button aria-label="Select database" title="Placedv Note v6" className="flex h-7 max-w-[220px] items-center gap-2 border-0 bg-transparent px-2 py-1 text-zinc-700 shadow-none hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">
                    <DatabaseEngineIcon dialect="sqlite" size={14} />
                    <span className="truncate text-xs font-semibold">Placedv Note v6</span>
                    <ChevronsUpDown size={14} className="shrink-0 text-muted-foreground" />
                </Button>
                <Button aria-label="Refresh schema" className={iconButton}><RefreshCcw size={14} /></Button>
                <Button aria-label="Show database tables" className={iconButton}><Columns3 size={14} /></Button>
                <Button className="h-6 border-0 bg-white p-1 px-2 text-black shadow-none ring-1 ring-zinc-300 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-800 !text-xs !font-semibold">SQL</Button>
            </div>
            <div className="flex items-center gap-2 px-4 py-3">
                <Button className={actionButton}><History size={12} />History</Button>
                <Button className={actionButton}><Settings2 size={12} />Settings</Button>
                <Button disabled className="flex flex-row gap-3 bg-white dark:bg-zinc-950 hover:bg-zinc-100 hover:dark:bg-zinc-800 border-0 p-1 px-2 h-6 shadow-none text-black dark:text-zinc-100 !text-xs !font-semibold ring-1 ring-zinc-300 dark:ring-zinc-700">
                    <span>Changes</span><span>0</span>
                </Button>
            </div>
        </div>
    </div>;
}

function DatabaseTablePreview() {
    const [filterRules, setFilterRules] = useState([]);
    const [grouping, setGrouping] = useState([]);
    const [columnVisibility, setColumnVisibility] = useState({});
    const [columnSearch, setColumnSearch] = useState("");
    const [selectedRowsCount, setSelectedRowsCount] = useState(0);

    const toggleColumn = (column) => setColumnVisibility((current) => ({
        ...current,
        [column]: current[column] === false,
    }));

    return <div className="flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 items-center overflow-x-auto border-b bg-white dark:bg-zinc-950">
            <div className="flex cursor-pointer items-center justify-between gap-3 border-r bg-zinc-100 p-3 px-4 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-900">
                <div><TableIcon size={12} /></div>
                <p className="whitespace-nowrap text-xs font-semibold">notes</p>
                <div className="rounded-sm p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-800">
                    <X size={14} />
                </div>
            </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-b bg-white p-3 px-4 dark:bg-zinc-950">
            <div className="flex min-w-0 flex-wrap items-center gap-1">
                {selectedRowsCount > 0 ? <>
                    <Button className="flex h-6 items-center gap-1 border-0 bg-red-600 p-1 px-2 text-white shadow-none ring-1 ring-red-500 hover:bg-red-700 !text-xs !font-semibold"><Trash2 size={12} />Delete</Button>
                    <span className="px-2 text-xs font-semibold text-zinc-400">{selectedRowsCount} {selectedRowsCount === 1 ? "row" : "rows"} selected for deletion</span>
                </> : <>
                    <Button className="flex h-6 items-center gap-1 border-0 bg-blue-600 p-1 px-2 text-white shadow-none ring-1 ring-blue-500 hover:bg-blue-700 !text-xs !font-semibold"><Plus size={12} />Insert</Button>
                    <Button className="flex h-6 items-center gap-1 border-0 bg-white p-1 px-2 text-black shadow-none hover:bg-zinc-100 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900 !text-xs !font-semibold"><RefreshCcw size={12} />Refresh</Button>
                </>}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button className="flex h-6 items-center gap-1 border-0 bg-white p-1 px-2 text-black shadow-none hover:bg-zinc-100 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900 !text-xs !font-semibold"><Download size={12} />Export<ChevronDown size={12} /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                        <DropdownMenuItem className="!text-xs !font-semibold">JSON</DropdownMenuItem>
                        <DropdownMenuItem className="!text-xs !font-semibold">CSV</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                {selectedRowsCount === 0 && <>
                    <TableFilters columns={previewColumns} rules={filterRules} onChange={setFilterRules} disabled={selectedRowsCount > 0} />
                    <TableGrouping columns={previewColumns} grouping={grouping} onChange={setGrouping} />
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button className="flex h-6 items-center gap-1 border-0 bg-white p-1 px-2 text-black shadow-none hover:bg-zinc-100 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900 !text-xs !font-semibold"><Columns3 size={12} />Columns<ChevronDown size={12} /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56 p-1">
                            <div className="relative p-1"><Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" /><Input value={columnSearch} onChange={(event) => setColumnSearch(event.target.value)} onKeyDown={(event) => event.stopPropagation()} aria-label="Search columns" placeholder="Search..." className="h-7 rounded-md pl-7 pr-2 !text-xs !font-semibold" /></div>
                            {previewColumns.filter((column) => column.toLowerCase().includes(columnSearch.trim().toLowerCase())).map((column) => <DropdownMenuItem key={column} onSelect={(event) => event.preventDefault()} onClick={() => toggleColumn(column)} className="gap-2 !py-1.5 !font-mono !text-xs !font-semibold">
                                <Checkbox checked={columnVisibility[column] !== false} onCheckedChange={() => toggleColumn(column)} onClick={(event) => event.stopPropagation()} aria-label={`Toggle ${column} column`} className="h-4 w-4" />{column}
                            </DropdownMenuItem>)}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => setColumnVisibility(Object.fromEntries(previewColumns.map((column) => [column, false])))} className="justify-end !text-xs !font-semibold">Hide all</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </>}
            </div>
            <div className="flex shrink-0 items-center gap-2 text-xs font-semibold text-zinc-400 dark:text-zinc-500">
                <span>Page 1 of 1</span>
                <Select defaultValue="50">
                    <SelectTrigger aria-label="Rows per page" className="h-6 w-[92px] border-0 bg-white px-2 py-0 text-xs font-semibold text-zinc-900 shadow-none ring-1 ring-zinc-300 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-700 [&>span]:text-xs [&>span]:font-semibold [&>svg]:h-3 [&>svg]:w-3"><SelectValue /></SelectTrigger>
                    <SelectContent align="end" className="min-w-[92px] text-xs font-semibold">{[10, 25, 50, 100].map((size) => <SelectItem key={size} value={String(size)} className="py-1.5 text-xs font-semibold">{size} rows</SelectItem>)}</SelectContent>
                </Select>
                <Button aria-label="First page" disabled className="h-6 w-6 border-0 bg-white p-1 text-black shadow-none ring-1 ring-zinc-300 disabled:opacity-50 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-700"><ChevronsLeft size={14} /></Button>
                <Button disabled className="h-6 border-0 bg-white p-1 px-2 text-black shadow-none ring-1 ring-zinc-300 disabled:opacity-50 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-700 !text-xs !font-semibold">Previous</Button>
                <Button disabled className="h-6 border-0 bg-white p-1 px-2 text-black shadow-none ring-1 ring-zinc-300 disabled:opacity-50 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-700 !text-xs !font-semibold">Next</Button>
                <Button aria-label="Last page" disabled className="h-6 w-6 border-0 bg-white p-1 text-black shadow-none ring-1 ring-zinc-300 disabled:opacity-50 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-700"><ChevronsRight size={14} /></Button>
                <span>{previewRows.length} rows</span>
            </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
            <QueryResultsTable
                response={previewRows}
                rowCount={previewRows.length}
                tableName="notes"
                schema={previewSchema}
                databaseId="placedv-preview"
                primaryKeyField="id"
                canSave={false}
                editable={false}
                showSelection
                columnVisibility={columnVisibility}
                filterRules={filterRules}
                grouping={grouping}
                onSelectionCountChange={setSelectedRowsCount}
            />
        </div>
    </div>;
}

function CollapsedNavigationDashboard() {
    return <div className="w-full">
        <section aria-label="Playground dashboard preview" className="flex h-[620px] w-full flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white text-zinc-900 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
            <div className="shrink-0"><DashboardTopbar /></div>
            <DatabaseTablePreview />
        </section>
    </div>;
}

function ProductOverview() {
    const databaseEngines = [
        { name: "MySQL", icon: SiMysql, color: "#00758F" },
        { name: "MariaDB", icon: SiMariadb, color: "#003545" },
        { name: "PostgreSQL", icon: SiPostgresql, color: "#336791" },
        { name: "SQL Server", icon: FaMicrosoft, color: "#737373" },
        { name: "SQLite", icon: SiSqlite, color: "#0F80CC" },
    ];

    return <section id="features" className="mx-auto w-full max-w-[1280px] px-4 pb-20 pt-8 sm:px-6 lg:px-8">
        <div className="pt-2">
            <div className="text-center">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Works with your database</p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
                    {databaseEngines.map(({ name, icon: Icon, color }) => <div key={name} className="flex items-center gap-2 text-sm font-semibold tracking-tight text-zinc-700">
                        <Icon aria-hidden="true" size={22} color={color} />
                        <span>{name}</span>
                    </div>)}
                </div>
            </div>

            <div className="mx-auto mt-16 max-w-3xl text-center">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">A workspace for database work</p>
                <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
                    From a database connection to the data you need
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-zinc-600">
                    Placedv Query brings connections, table exploration, and SQL into one interface, with tools to
                    filter records, review edits, and keep track of database activity.
                </p>
            </div>

            <div className="mx-auto mt-12 grid max-w-[1100px] grid-cols-1 items-center gap-6 lg:grid-cols-[1fr_1.35fr_1fr] lg:gap-8">
                <div className="space-y-3">
                    <p className="mb-4 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 lg:text-left">Database connections</p>
                    {[
                        { name: "MySQL & MariaDB", detail: "Connect to popular relational databases.", engines: ["mysql", "mariadb"] },
                        { name: "PostgreSQL & SQL Server", detail: "Use your existing database connections.", engines: ["postgres", "mssql"] },
                        { name: "SQLite", detail: "Upload a local database file.", engines: ["sqlite"] },
                    ].map(({ name, detail, engines }) => <div key={name} className="flex flex-col items-start rounded-2xl bg-zinc-100 p-3 text-left transition-colors hover:bg-zinc-200/70">
                        <div className="flex h-5 shrink-0 items-center justify-start gap-1">
                            {engines.map((engine) => <DatabaseEngineIcon key={engine} dialect={engine} size={15} />)}
                        </div>
                        <div className="mt-1 min-w-0 w-full">
                            <p className="truncate text-xs font-semibold">{name}</p>
                            <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-zinc-500">{detail}</p>
                        </div>
                    </div>)}
                </div>

                <div className="rounded-2xl bg-zinc-900 p-6 text-white sm:p-8">
                    <p className="text-center text-sm font-semibold">Placedv Query</p>
                    <div className="relative mx-auto my-12 flex h-48 w-48 items-center justify-center rounded-full border-[5px] border-zinc-700 sm:h-52 sm:w-52">
                        <span className="max-w-[100px] text-center text-sm font-semibold leading-tight text-zinc-200">Your database workspace</span>
                        <span className="absolute left-1/2 top-0 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-violet-200 text-xs font-bold text-zinc-900">1</span>
                        <span className="absolute right-0 top-1/2 flex h-8 w-8 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full bg-violet-200 text-xs font-bold text-zinc-900">2</span>
                        <span className="absolute bottom-0 left-1/2 flex h-8 w-8 -translate-x-1/2 translate-y-1/2 items-center justify-center rounded-full bg-violet-200 text-xs font-bold text-zinc-900">3</span>
                        <span className="absolute left-0 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-violet-200 text-xs font-bold text-zinc-900">4</span>
                        <span className="absolute -top-9 left-1/2 w-36 -translate-x-1/2 text-center text-[10px] font-semibold text-zinc-300">Connect database</span>
                        <span className="absolute -right-[112px] top-1/2 w-20 -translate-y-1/2 text-left text-[10px] font-semibold leading-tight text-zinc-300">Explore<br />tables</span>
                        <span className="absolute -bottom-9 left-1/2 w-32 -translate-x-1/2 text-center text-[10px] font-semibold text-zinc-300">Run SQL</span>
                        <span className="absolute -left-[112px] top-1/2 w-20 -translate-y-1/2 text-right text-[10px] font-semibold leading-tight text-zinc-300">Review<br />changes</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-semibold leading-tight">
                        <div className="rounded-lg bg-white px-2 py-3 text-zinc-900">Connect</div>
                        <div className="rounded-lg bg-white px-2 py-3 text-zinc-900">Explore</div>
                        <div className="rounded-lg bg-white px-2 py-3 text-zinc-900">Query &amp; review</div>
                    </div>
                </div>

                <div className="space-y-3">
                    <p className="mb-4 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 lg:text-left">Tools in one place</p>
                    <div className="flex flex-col items-start rounded-2xl bg-zinc-100 p-3 text-left transition-colors hover:bg-zinc-200/70">
                        <div className="flex h-5 shrink-0 items-center justify-start"><TableIcon size={20} className="text-zinc-800" /></div>
                        <div className="mt-1 min-w-0 w-full"><p className="truncate text-xs font-semibold">Table exploration</p><p className="mt-0.5 line-clamp-2 text-xs leading-4 text-zinc-500">Browse, filter, group, and sort records.</p></div>
                    </div>
                    <div className="flex flex-col items-start rounded-2xl bg-zinc-100 p-3 text-left transition-colors hover:bg-zinc-200/70">
                        <div className="flex h-5 shrink-0 items-center justify-start"><Code2 size={20} className="text-zinc-800" /></div>
                        <div className="mt-1 min-w-0 w-full"><p className="truncate text-xs font-semibold">SQL workspace</p><p className="mt-0.5 line-clamp-2 text-xs leading-4 text-zinc-500">Run queries and inspect the results.</p></div>
                    </div>
                    <div className="flex flex-col items-start rounded-2xl bg-zinc-100 p-3 text-left transition-colors hover:bg-zinc-200/70">
                        <div className="flex h-5 shrink-0 items-center justify-start"><History size={20} className="text-zinc-800" /></div>
                        <div className="mt-1 min-w-0 w-full"><p className="truncate text-xs font-semibold">Change history</p><p className="mt-0.5 line-clamp-2 text-xs leading-4 text-zinc-500">Review edits and database activity.</p></div>
                    </div>
                </div>
            </div>
        </div>
    </section>;
}

export default function Home() {
    const login = () => signIn("github", { callbackUrl: "/app/playground/play" });

    return <main className="min-h-screen bg-white text-zinc-950">
        <header className="mx-auto flex h-[72px] w-full max-w-[1280px] items-center justify-between px-4 sm:px-6 lg:px-8">
            <a href="#top" className="flex items-center text-sm font-semibold tracking-tight" aria-label="Placedv Query home">
                <span>Placedv Query</span>
            </a>
            <div className="flex items-center gap-4">
                <button onClick={login} className="inline-flex h-8 items-center justify-center rounded-md bg-zinc-950 px-3 !text-xs !font-semibold text-white transition-colors hover:bg-zinc-700">
                    Get started
                </button>
            </div>
        </header>

        <section id="top" className="mx-auto grid w-full max-w-[1280px] grid-cols-1 items-start gap-8 px-4 pb-10 pt-12 sm:px-6 md:grid-cols-2 md:gap-12 md:pt-16 lg:px-8">
            <div>
                <h1 className="max-w-2xl text-4xl font-medium leading-[1.08] tracking-tight sm:text-5xl">
                    Your databases, in one focused workspace
                </h1>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                    <button onClick={login} className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 !text-xs !font-semibold text-white transition-colors hover:bg-zinc-700">
                        <PiGithubLogoBold aria-hidden="true" size={14} />
                        Get started
                    </button>
                    <a href="#product" className="inline-flex h-9 items-center justify-center rounded-md border border-zinc-300 px-4 text-xs font-semibold text-zinc-900 transition-colors hover:bg-zinc-50">
                        Explore the product
                    </a>
                </div>
            </div>
            <p className="max-w-xl pt-1 text-base leading-7 text-zinc-600 md:pt-2">
                Placedv Query brings database connections, table browsing, SQL queries, and record management into
                one clear interface, so your data work stays organized in one place.
            </p>
        </section>

        <section id="product" aria-label="Product preview" className="mx-auto w-full max-w-[1320px] px-4 sm:px-6 lg:px-8">
            <div className="overflow-hidden rounded-xl">
                <CollapsedNavigationDashboard />
            </div>
        </section>

        <ProductOverview />
    </main>;
}
