import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/router";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandShortcut, CommandSeparator } from "@/components/ui/command";
import DatabaseEngineIcon from "@/components/databaseEngineIcon";
import { Check, CodeXml, Database, History, LayoutDashboard, Plus, Search, Settings2, Table } from "lucide-react";
import { setDatabase, setDatabases, setQuery, setQueryResults, setQueryTabs } from "@/redux/actions/main";
import { useNavigationVisibility } from "@/components/navigationBar/navigationVisibility";

export default function GlobalCommandSearch() {
    const { navigationHidden } = useNavigationVisibility();
    const router = useRouter();
    const dispatch = useDispatch();
    const databases = useSelector((state) => state.databases || []);
    const database = useSelector((state) => state.database);
    const tables = useSelector((state) => state.tables);
    const queryTabs = useSelector((state) => state.queryTabs || []);
    const [open, setOpen] = useState(false);
    const [searchPosition, setSearchPosition] = useState(null);
    const hasFetchedDatabases = useRef(false);
    const isAppRoute = router.pathname.startsWith("/app");

    useEffect(() => {
        if (!router.isReady || !isAppRoute || hasFetchedDatabases.current) return;
        hasFetchedDatabases.current = true;
        axios.get("/api/database").then(({ data }) => dispatch(setDatabases(data))).catch((error) => {
            console.error("Unable to load databases for command search", error);
            hasFetchedDatabases.current = false;
        });
    }, [dispatch, isAppRoute, router.isReady]);

    useEffect(() => {
        if (!isAppRoute) return undefined;
        const handleShortcut = (event) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
                event.preventDefault();
                setOpen((current) => !current);
            }
        };
        window.addEventListener("keydown", handleShortcut);
        return () => window.removeEventListener("keydown", handleShortcut);
    }, [isAppRoute]);

    useEffect(() => {
        if (!isAppRoute) return undefined;
        const updateCenter = () => {
            const leftGroup = document.querySelector("[data-command-search-left]");
            const rightGroup = document.querySelector("[data-command-search-right]");
            if (leftGroup && rightGroup) {
                const leftRect = leftGroup.getBoundingClientRect();
                const rightRect = rightGroup.getBoundingClientRect();
                const nextPosition = {
                    x: (leftRect.right + rightRect.left) / 2,
                    y: (leftRect.top + leftRect.bottom + rightRect.top + rightRect.bottom) / 4,
                };
                setSearchPosition((current) => current?.x === nextPosition.x && current?.y === nextPosition.y ? current : nextPosition);
                return;
            }
            const sidebarWidth = navigationHidden ? 0 : Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--electron-sidebar-width")) || 0;
            const topBar = document.querySelector(".electron-main-with-sidebar > div > div");
            const topBarRect = topBar?.getBoundingClientRect();
            const nextPosition = {
                x: (window.innerWidth + sidebarWidth) / 2,
                y: topBarRect ? (topBarRect.top + topBarRect.bottom) / 2 : 26.5,
            };
            setSearchPosition((current) => current?.x === nextPosition.x && current?.y === nextPosition.y ? current : nextPosition);
        };

        updateCenter();
        const transitionEnd = performance.now() + 260;
        let frame = 0;
        const followToolbarTransition = () => {
            updateCenter();
            if (performance.now() < transitionEnd) frame = window.requestAnimationFrame(followToolbarTransition);
        };
        frame = window.requestAnimationFrame(followToolbarTransition);
        window.addEventListener("resize", updateCenter);
        const observer = new ResizeObserver(updateCenter);
        document.querySelectorAll("[data-command-search-left], [data-command-search-right], .electron-sidebar").forEach((element) => observer.observe(element));
        const mutationObserver = new MutationObserver(updateCenter);
        mutationObserver.observe(document.body, { childList: true, subtree: true });
        return () => {
            window.cancelAnimationFrame(frame);
            window.removeEventListener("resize", updateCenter);
            observer.disconnect();
            mutationObserver.disconnect();
        };
    }, [isAppRoute, navigationHidden, router.asPath]);

    if (!router.isReady || !isAppRoute) return null;

    const selectDatabase = (item) => {
        dispatch(setDatabase({ db_id: item.id, db_name: item.db_name, dialect: item.dialect }));
        dispatch(setQuery(""));
        dispatch(setQueryResults(null));
        dispatch(setQueryTabs([]));
        router.push(`/app/playground/play/${encodeURIComponent(item.id)}`);
    };

    const selectTable = async (table) => {
        if (!database?.db_id) return;
        const databaseId = database.db_id;
        const dialect = tables?._dialect || database.dialect;
        const quotedTable = dialect === "postgres" || dialect === "sqlite"
            ? `"${String(table.tableName).replace(/"/g, '""')}"`
            : dialect === "mssql"
                ? `[${String(table.tableName).replace(/]/g, "]]" )}]`
                : `\`${String(table.tableName).replace(/`/g, "``")}\``;
        const columns = table.details?.columns || [];
        const primaryKeys = columns.filter((column) => column.key === "PRI");

        setOpen(false);
        try {
            const { data } = await axios.get("/api/playground/db/table/rows", {
                params: { db_id: databaseId, table: table.tableName, page: 0, pageSize: 50 },
            });
            const nextTab = {
                id: databaseId,
                name: table.tableName,
                type: "table",
                primaryKeyField: primaryKeys.length === 1 ? primaryKeys[0].field : undefined,
                schema: columns,
                query: `SELECT * FROM ${quotedTable}`,
                data: { data: data.data, count: null },
                count: null,
                countPending: true,
                countError: false,
                hasNext: data.hasNext,
                hasPrevious: data.hasPrevious,
                cursorSupported: data.cursorSupported,
                nextCursor: data.nextCursor,
                previousCursor: data.previousCursor,
                requestCursor: null,
                requestDirection: "next",
                pageIndex: 0,
                pageSize: data.pageSize || 50,
                sensitiveColumns: data.sensitiveColumns || [],
                serverPaginated: true,
                filterSignature: "[]",
            };
            const remainingTabs = queryTabs.filter((tab) => !(tab.type === "table" && tab.id === databaseId && tab.name === table.tableName));
            dispatch(setQueryTabs([...remainingTabs, nextTab]));
            dispatch(setQueryResults(data.data));
            router.push(`/app/playground/play/${encodeURIComponent(databaseId)}`);
        } catch (error) {
            console.error("Unable to open table from command search", error);
            router.push(`/app/playground/play/${encodeURIComponent(databaseId)}`);
        }
    };

    const go = (path) => {
        setOpen(false);
        router.push(path);
    };

    return <>
        <Button
            type="button"
            variant="outline"
            aria-label="Search or run commands"
            onClick={() => setOpen(true)}
            style={{
                left: searchPosition ? `${searchPosition.x}px` : (navigationHidden ? "50%" : "calc((100vw + var(--electron-sidebar-width)) / 2)"),
                top: searchPosition ? `${searchPosition.y}px` : "26.5px",
                transition: "none",
            }}
            className="electron-titlebar-no-drag fixed z-40 flex h-8 w-[min(26vw,320px)] max-sm:w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-start gap-3 rounded-lg border-zinc-300 bg-transparent px-1.5 text-xs font-semibold text-muted-foreground shadow-none hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900 max-sm:justify-center max-sm:gap-0 max-sm:px-0"
        >
            <Search className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate text-left max-sm:hidden">Search or run commands...</span>
            <kbd className="pointer-events-none ml-auto inline-flex h-5 select-none items-center gap-1 rounded border border-zinc-300 px-1.5 font-mono text-[10px] font-medium text-muted-foreground dark:border-zinc-700 max-sm:hidden">⌘ K</kbd>
        </Button>
        <CommandDialog open={open} onOpenChange={setOpen}>
            <CommandInput placeholder="Search databases or commands..." className="!ring-0 !border-0"/>
            <CommandList className="rounded-t-xl">
                <CommandEmpty>No results found.</CommandEmpty>
                {databases.length > 0 && <CommandGroup heading="Databases">
                    {databases.map((item) => <CommandItem
                        key={item.id}
                        value={`database ${item.db_name}`}
                        onSelect={() => {
                            setOpen(false);
                            selectDatabase(item);
                        }}
                    >
                        <DatabaseEngineIcon dialect={item.dialect} size={14} />
                        <span className="truncate">{item.db_name}</span>
                        {item.id === database?.db_id && <Check className="ml-auto h-2 w-2" />}
                    </CommandItem>)}
                </CommandGroup>}
                {database?.db_id && tables?._databaseId === database.db_id && Array.isArray(tables?.data) && tables.data.length > 0 && <>
                    <CommandSeparator />
                    <CommandGroup heading="Tables">
                        {tables.data.map((item) => <CommandItem
                            key={item.tableName}
                            value={`table ${item.tableName}`}
                            onSelect={() => selectTable(item)}
                        >
                            <Table />
                            <span className="truncate">{item.tableName}</span>
                        </CommandItem>)}
                    </CommandGroup>
                </>}
                <CommandSeparator />
                <CommandGroup heading="Navigation">
                    <CommandItem onSelect={() => go("/app/add/dataset")}>
                        <Plus /><span>Add database</span>
                    </CommandItem>
                    <CommandItem onSelect={() => go("/app/settings")}>
                        <Settings2 /><span>Open settings</span>
                    </CommandItem>
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup heading="Current database">
                    <CommandItem disabled={!database?.db_id} onSelect={() => go(`/app/playground/play/${encodeURIComponent(database?.db_id || "")}`)}>
                        <CodeXml /><span>Open SQL workspace</span><CommandShortcut>↵</CommandShortcut>
                    </CommandItem>
                    <CommandItem disabled={!database?.db_id} onSelect={() => go(`/app/playground/play/${encodeURIComponent(database?.db_id || "")}/activity`)}>
                        <History /><span>Open activity history</span>
                    </CommandItem>
                    <CommandItem disabled={!database?.db_id} onSelect={() => go(`/app/playground/play/${encodeURIComponent(database?.db_id || "")}/settings`)}>
                        <Settings2 /><span>Open database settings</span>
                    </CommandItem>
                </CommandGroup>
            </CommandList>
        </CommandDialog>
    </>;
}
