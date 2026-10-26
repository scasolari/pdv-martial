import { useState } from "react";
import Avatar, { genConfig } from "react-nice-avatar";
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
import {
    ChevronsLeft,
    ChevronsRight,
    ChevronsUpDown,
    ChevronDown,
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
import { previewColumns, previewRows, previewSchema } from "./previewData";

const iconButtonClass = "h-6 w-6 border-0 bg-transparent p-1 text-zinc-700 shadow-none hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800";
const actionButtonClass = "flex h-6 items-center gap-1 border-0 bg-white p-1 px-2 text-black shadow-none ring-1 ring-zinc-300 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-800 !text-xs !font-semibold";
const previewAvatar = genConfig("placedv-query-preview");

function DashboardTopbar() {
    return <div className="bg-zinc-50 dark:bg-zinc-950">
        <div className="flex h-[53px] w-full items-center justify-between border-b bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/30">
            <div className="flex items-center gap-2 px-4 py-3">
                <div className="flex items-center gap-2">
                    <Button aria-label="Show navigation" className={iconButtonClass}><PanelLeftOpen size={14} /></Button>
                    <Button aria-label="Open account menu" className="h-7 w-7 rounded-full border-0 bg-transparent p-0 text-zinc-700 shadow-none hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"><Avatar aria-hidden="true" style={{ width: 20, height: 20 }} {...previewAvatar} /></Button>
                </div>
                <Button aria-label="Select database" title="Placedv Note v6" className="flex h-7 max-w-[220px] items-center gap-2 border-0 bg-transparent px-2 py-1 text-zinc-700 shadow-none hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">
                    <DatabaseEngineIcon dialect="sqlite" size={14} />
                    <span className="truncate text-xs font-semibold">Placedv Note v6</span>
                    <ChevronsUpDown size={14} className="shrink-0 text-muted-foreground" />
                </Button>
                <Button aria-label="Refresh schema" className={iconButtonClass}><RefreshCcw size={14} /></Button>
                <Button aria-label="Show database tables" className={iconButtonClass}><Columns3 size={14} /></Button>
                <Button className="h-6 border-0 bg-white p-1 px-2 text-black shadow-none ring-1 ring-zinc-300 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-800 !text-xs !font-semibold">SQL</Button>
            </div>
            <div className="flex items-center gap-2 px-4 py-3">
                <Button className={actionButtonClass}><History size={12} />History</Button>
                <Button className={actionButtonClass}><Settings2 size={12} />Settings</Button>
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

export default function DashboardPreview() {
    return (
        <section aria-label="Playground dashboard preview" className="flex h-[620px] w-full flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white text-zinc-900 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
            <div className="shrink-0"><DashboardTopbar /></div>
            <DatabaseTablePreview />
        </section>
    );
}
