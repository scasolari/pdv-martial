import { useEffect, useMemo, useState } from "react";
import { connect } from "react-redux";
import axios from "axios";
import { useRouter } from "next/router";
import LeftBar from "@/components/navigationBar/leftBar";
import ElectronTitlebarSpacer from "@/components/electronTitlebarSpacer";
import { ShowNavigationButton, useNavigationVisibility } from "@/components/navigationBar/navigationVisibility";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import AddDatabase from "@/components/addDatabase";
import DatabaseEngineIcon from "@/components/databaseEngineIcon";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Columns3, History, Plus, RefreshCcw, Settings2, Table } from "lucide-react";
import { setDatabase, setDatabases, setQuery, setQueryResults, setQueryTabs, setTables } from "@/redux/actions/main";

function PlaygroundPlay({ database, databases, setDatabase, setDatabases, setQuery, setQueryResults, setQueryTabs, setTables }) {
    const router = useRouter();
    const { navigationHidden } = useNavigationVisibility();
    const [databaseMenuOpen, setDatabaseMenuOpen] = useState(false);
    const [databaseSearch, setDatabaseSearch] = useState("");
    const [tableMenuOpen, setTableMenuOpen] = useState(false);
    const [tableSearch, setTableSearch] = useState("");
    const [schema, setSchema] = useState([]);
    const [schemaLoading, setSchemaLoading] = useState(false);
    const [schemaError, setSchemaError] = useState("");
    const [addDatasetOpen, setAddDatasetOpen] = useState(false);
    const [routeLoading, setRouteLoading] = useState(false);

    useEffect(() => {
        const handleStart = () => setRouteLoading(true);
        const handleComplete = () => setRouteLoading(false);
        router.events.on("routeChangeStart", handleStart);
        router.events.on("routeChangeComplete", handleComplete);
        router.events.on("routeChangeError", handleComplete);
        return () => {
            router.events.off("routeChangeStart", handleStart);
            router.events.off("routeChangeComplete", handleComplete);
            router.events.off("routeChangeError", handleComplete);
        };
    }, [router.events]);

    useEffect(() => {
        axios.get("/api/database").then(({ data }) => setDatabases(data)).catch((error) => {
            console.error("Unable to load databases", error);
        });
    }, [setDatabases]);

    const loadSchema = async (databaseId = database?.db_id) => {
        if (!databaseId) {
            setSchema([]);
            return;
        }
        setSchemaLoading(true);
        setSchemaError("");
        try {
            const { data } = await axios.get(`/api/playground/db/table?db_id=${encodeURIComponent(databaseId)}`);
            const nextSchema = Array.isArray(data?.data) ? data.data : [];
            setSchema(nextSchema);
            setTables({ ...data, _databaseId: databaseId });
        } catch (error) {
            setSchema([]);
            setSchemaError(error.response?.data?.error || error.response?.data?.message || "Unable to load tables");
        } finally {
            setSchemaLoading(false);
        }
    };

    useEffect(() => {
        if (navigationHidden && database?.db_id) loadSchema(database.db_id);
        else setSchema([]);
        // Load the schema when this empty playground is opened with a database already selected.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navigationHidden, database?.db_id]);

    const filteredDatabases = useMemo(() => (databases || []).filter((item) => (
        String(item.db_name || "").toLowerCase().includes(databaseSearch.trim().toLowerCase())
    )), [databases, databaseSearch]);
    const filteredTables = useMemo(() => schema.filter((item) => (
        String(item.tableName || "").toLowerCase().includes(tableSearch.trim().toLowerCase())
    )), [schema, tableSearch]);
    const toolbarLoading = !router.isReady || routeLoading || schemaLoading;

    const selectDatabase = (item) => {
        setDatabase({ db_id: item.id, db_name: item.db_name, dialect: item.dialect });
        setQuery("");
        setQueryResults(null);
        setQueryTabs([]);
        setTables({ _databaseId: item.id, data: [] });
        router.push(`/app/playground/play/${encodeURIComponent(item.id)}`);
    };

    return <>
        <LeftBar />
        {navigationHidden && <div className="sticky top-0 z-40 bg-zinc-50 dark:bg-zinc-950">
            <div className="flex h-[53px] w-full items-center justify-between border-b bg-zinc-50 dark:bg-zinc-900/30">
            <div className="electron-titlebar-safe-left electron-titlebar-safe-left-controls flex items-center gap-2 px-4 py-3">
            <ShowNavigationButton />
            {toolbarLoading ? <div className="flex items-center gap-2" aria-label="Loading database toolbar" aria-busy="true">
                <Skeleton className="h-7 w-32" />
                <Skeleton className="h-6 w-6" />
                <Skeleton className="h-6 w-6" />
                <Skeleton className="h-6 w-10" />
            </div> : <>
            <DropdownMenu open={databaseMenuOpen} onOpenChange={setDatabaseMenuOpen}>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                                <Button aria-label="Select database" title={database?.db_name || "Select database"} className="flex h-7 max-w-[220px] items-center gap-2 border-0 bg-transparent px-2 py-1 text-zinc-700 shadow-none hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">
                                    <DatabaseEngineIcon dialect={database?.dialect || databases?.find((item) => item.id === database?.db_id)?.dialect} size={14} />
                                    <span className={`truncate text-xs font-semibold ${database?.db_name ? "" : "text-zinc-500 dark:text-zinc-400"}`}>
                                        {database?.db_name || "Select database"}
                                    </span>
                                </Button>
                            </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent className="font-semibold"><p>Select database</p></TooltipContent>
                    </Tooltip>
                </TooltipProvider>
                <DropdownMenuContent align="start" className="w-56 overflow-hidden p-1">
                    <div className="sticky top-0 z-10 bg-popover pb-1">
                        <Input value={databaseSearch} onChange={(event) => setDatabaseSearch(event.target.value)} onKeyDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} placeholder="Search databases..." aria-label="Search databases" className="h-7 !text-xs !font-semibold" />
                    </div>
                    <div className="max-h-[min(70vh,400px)] overflow-y-auto">
                        {filteredDatabases.map((item) => <DropdownMenuItem key={item.id} onSelect={() => selectDatabase(item)} className="flex items-center gap-2 !text-xs !font-semibold">
                            <DatabaseEngineIcon dialect={item.dialect} size={12} />
                            <span className="min-w-0 flex-1 truncate">{item.db_name}</span>
                            {item.id === database?.db_id && <Check size={12} className="shrink-0" />}
                        </DropdownMenuItem>)}
                        {filteredDatabases.length === 0 && <DropdownMenuItem disabled className="!text-xs !font-semibold">{databaseSearch.trim() ? "No databases match your search" : "No databases found"}</DropdownMenuItem>}
                    </div>
                    <DropdownMenuSeparator className="my-1" />
                    <DropdownMenuItem onSelect={() => setAddDatasetOpen(true)} className="flex items-center gap-2 !text-xs !font-semibold"><Plus size={12} />Add dataset</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button aria-label="Refresh schema" disabled={!database?.db_id || schemaLoading} onClick={() => loadSchema()} className="h-6 w-6 border-0 bg-transparent p-1 text-zinc-700 shadow-none hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800">
                            <RefreshCcw size={14} className={schemaLoading ? "animate-spin" : ""} />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent className="font-semibold"><p>Refresh schema</p></TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <DropdownMenu open={tableMenuOpen} onOpenChange={setTableMenuOpen}>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                                <Button aria-label="Show database tables" disabled={!database?.db_id} className="h-6 w-6 border-0 bg-transparent p-1 text-zinc-700 shadow-none hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800">
                                    <Columns3 size={14} />
                                </Button>
                            </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent className="font-semibold"><p>Show database tables</p></TooltipContent>
                    </Tooltip>
                </TooltipProvider>
                <DropdownMenuContent align="start" className="w-56 overflow-hidden p-1">
                    <div className="sticky top-0 z-10 bg-popover pb-1">
                        <Input value={tableSearch} onChange={(event) => setTableSearch(event.target.value)} onKeyDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} placeholder="Search tables..." aria-label="Search database tables" className="h-7 !text-xs !font-semibold" />
                    </div>
                    <div className="max-h-[min(70vh,400px)] overflow-y-auto">
                        {!database?.db_id ? <DropdownMenuItem disabled className="!text-xs !font-semibold">Select a database first</DropdownMenuItem>
                            : schemaLoading ? <DropdownMenuItem disabled className="!text-xs !font-semibold">Loading tables...</DropdownMenuItem>
                                : filteredTables.length > 0 ? filteredTables.map((item) => <DropdownMenuItem key={item.tableName} onSelect={() => router.push(`/app/playground/play/${encodeURIComponent(database.db_id)}`)} className="flex items-center gap-2 !text-xs !font-semibold">
                                    <Table size={12} /><span className="min-w-0 flex-1 truncate">{item.tableName}</span>
                                </DropdownMenuItem>)
                                    : <DropdownMenuItem disabled className="!text-xs !font-semibold">{schemaError || (tableSearch.trim() ? "No tables match your search" : "No tables found")}</DropdownMenuItem>}
                    </div>
                </DropdownMenuContent>
            </DropdownMenu>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button aria-label="Open SQL editor" disabled={!database?.db_id} onClick={() => database?.db_id && router.push(`/app/playground/play/${encodeURIComponent(database.db_id)}`)} className="h-6 border-0 bg-white p-1 px-2 text-black shadow-none ring-1 ring-zinc-300 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-800 !text-xs !font-semibold">SQL</Button>
                    </TooltipTrigger>
                    <TooltipContent className="font-semibold"><p>Open SQL editor</p></TooltipContent>
                </Tooltip>
            </TooltipProvider>
            </>}
            </div>
            <ElectronTitlebarSpacer />
            <div className="flex items-center gap-2 px-4 py-3">
                {toolbarLoading ? <div className="flex items-center gap-2" aria-hidden="true"><Skeleton className="h-6 w-16" /><Skeleton className="h-6 w-16" /></div> : <>
                    {database?.db_id && <Button onClick={() => router.push(`/app/playground/play/${encodeURIComponent(database.db_id)}/activity`)} className="flex h-6 items-center gap-1 border-0 bg-white p-1 px-2 text-black shadow-none ring-1 ring-zinc-300 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-800 !text-xs !font-semibold"><History size={12} />History</Button>}
                    {database?.db_id && <Button onClick={() => router.push(`/app/playground/play/${encodeURIComponent(database.db_id)}/settings`)} className="flex h-6 items-center gap-1 border-0 bg-white p-1 px-2 text-black shadow-none ring-1 ring-zinc-300 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-800 !text-xs !font-semibold"><Settings2 size={12} />Settings</Button>}
                </>}
            </div>
            </div>
        </div>}
        {!database?.db_id && <main
            aria-label="Workspace"
            className="electron-initial-empty-state fixed bottom-0 right-0 top-[53px] z-0 flex items-center justify-center px-6 text-center transition-[left] duration-200"
            style={{ left: navigationHidden ? 0 : "var(--electron-sidebar-width)" }}
        >
            <p className="text-sm font-semibold text-muted-foreground">Select a database from the sidebar to start working.</p>
        </main>}
        <AlertDialog open={addDatasetOpen} onOpenChange={setAddDatasetOpen}>
            <AlertDialogContent className="z-[1000] bg-white text-zinc-900 outline-none focus:outline-none focus-visible:ring-0 dark:bg-zinc-950 dark:text-zinc-100">
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-sm font-semibold">Add new dataset</AlertDialogTitle>
                    <p className="text-xs font-semibold text-muted-foreground">Connect a MySQL, MariaDB, PostgreSQL, or SQL Server database, or upload a SQLite file to browse tables and run queries.</p>
                    <AddDatabase onClose={() => setAddDatasetOpen(false)} onSuccess={() => setAddDatasetOpen(false)} />
                </AlertDialogHeader>
            </AlertDialogContent>
        </AlertDialog>
    </>;
}

const mapStateToProps = (state) => ({ database: state.database, databases: state.databases });
const mapDispatchToProps = { setDatabase, setDatabases, setQuery, setQueryResults, setQueryTabs, setTables };

export default connect(mapStateToProps, mapDispatchToProps)(PlaygroundPlay);
