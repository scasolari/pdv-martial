import LeftBar from "@/components/navigationBar/leftBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { connect } from "react-redux";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import QueryResultsTable from "@/components/queryResults/table";
import TableFilters from "@/components/queryResults/table/filters";
import TableGrouping from "@/components/queryResults/table/grouping";
import { Check, ChevronDown, ChevronsLeft, ChevronsRight, ChevronsUpDown, Clock, CodeXml, Columns3, Download, History, Info, Play, Plus, RefreshCcw, Search, Settings2, Table, Trash2, X} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setDatabase, setQuery, setQueryResults, setQueryTabs, setTables } from "@/redux/actions/main";
import axios from "axios";
import { useTheme } from "next-themes";
import { useRouter } from "next/router";
import { ShowNavigationButton, useNavigationVisibility } from "@/components/navigationBar/navigationVisibility";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import AddDatabase from "@/components/addDatabase";
import DatabaseEngineIcon from "@/components/databaseEngineIcon";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/base-toast";
import { startRefreshIconAnimation, stopRefreshIconAnimation } from "@/lib/refreshIconAnimation";

const EMPTY_FILTER_RULES = Object.freeze([])
const EMPTY_GROUPING = Object.freeze([])
const EMPTY_COLUMNS = Object.freeze([])
const EMPTY_COLUMN_VISIBILITY = Object.freeze({})

const MinimalEditor = dynamic(() => import("@/components/codeEditor"), {
    ssr: false,
    loading: () => <Skeleton className="h-[200px] w-full" />,
});

function PlaygroundPlayId(props) {
    const { queryTabs, setQueryTabs, database, setDatabase, databases, query, setQuery, setQueryResults, tables } = props;
    const { theme } = useTheme();
    const router = useRouter();
    const [activeTabIndex, setActiveTabIndex] = useState(0);
    const prevLengthRef = useRef(0);
    const queryTabsRef = useRef(queryTabs || []);
    const activeDatabaseIdRef = useRef(database?.db_id);
    activeDatabaseIdRef.current = database?.db_id;
    const tableSchemaRequestRef = useRef(0);
    const pendingTableSchemaDatabaseRef = useRef(null);
    const [queryTiming, setQueryTiming] = useState(null)
    const [, setQueryCount] = useState(null)
    const [queryError, setQueryError] = useState(false)
    const [loading, setLoading] = useState(false)
    const refreshIconRef = useRef(null)
    const refreshIconAnimationRef = useRef(null)
    const schemaRefreshIconRef = useRef(null)
    const schemaRefreshIconAnimationRef = useRef(null)
    const [isSheetOpen, setIsSheetOpen] = useState(false)
    const [modifiedRowsCount, setModifiedRowsCount] = useState(0)
    const [paginationLoading, setPaginationLoading] = useState(false)
    const [, setPaginationError] = useState("")
    const [exportingTable, setExportingTable] = useState(false)
    const [, setExportError] = useState("")
    const [selectedRowsCount, setSelectedRowsCount] = useState(0)
    const [selectedRowsForExport, setSelectedRowsForExport] = useState([])
    const [insertRowRequest, setInsertRowRequest] = useState(0)
    const [deleteRowsRequest, setDeleteRowsRequest] = useState(0)
    const [columnVisibilityByTab, setColumnVisibilityByTab] = useState({})
    const [filterRulesByTab, setFilterRulesByTab] = useState({})
    const [groupingByTab, setGroupingByTab] = useState({})
    const [columnSearch, setColumnSearch] = useState("")
    const [tableMenuOpen, setTableMenuOpen] = useState(false)
    const [tableMenuLoading, setTableMenuLoading] = useState(false)
    const [schemaRefreshing, setSchemaRefreshing] = useState(false)
    const [tableMenuSearch, setTableMenuSearch] = useState("")
    const [hiddenNavigationSchema, setHiddenNavigationSchema] = useState({ databaseId: null, data: [] })
    const [tableMenuError, setTableMenuError] = useState("")
    const [databaseMenuOpen, setDatabaseMenuOpen] = useState(false)
    const [databaseMenuSearch, setDatabaseMenuSearch] = useState("")
    const [addDatasetOpen, setAddDatasetOpen] = useState(false)
    const { navigationHidden, navigationWidth } = useNavigationVisibility()
    const showToolbarSkeleton = navigationHidden && !router.isReady

    const openOrFocusTab = (newTab) => {
        const currentTabs = queryTabs || [];

        const existingIndex = currentTabs.findIndex(
            (tab) => tab.name === newTab.name
        );

        if (existingIndex !== -1) {
            setQueryTabs(currentTabs.map((tab, index) => index === existingIndex ? { ...tab, ...newTab } : tab));
            setActiveTabIndex(existingIndex);
            return;
        }

        const updated = [...currentTabs, newTab];
        setQueryTabs(updated);
        setActiveTabIndex(updated.length - 1);
    };

    const openTableFromHiddenNavigation = async (tableName) => {
        const table = tables?.data?.find((item) => item.tableName === tableName)
        const columns = table?.details?.columns || []
        const primaryKeys = columns.filter((column) => column.key === "PRI")
        try {
            const { data } = await axios.get("/api/playground/db/table/rows", {
                params: { db_id: database?.db_id, table: tableName, page: 0, pageSize: 50 },
            })
            openOrFocusTab({
                id: database?.db_id,
                name: tableName,
                type: "table",
                primaryKeyField: primaryKeys.length === 1 ? primaryKeys[0].field : undefined,
                schema: columns,
                query: `SELECT * FROM \`${String(tableName).replace(/`/g, "``")}\``,
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
            })
            setTableMenuOpen(false)
            router.push(`/app/playground/play/${encodeURIComponent(database.db_id)}`)

            axios.get("/api/playground/db/table/rows", {
                params: { db_id: database?.db_id, table: tableName, count_only: "true", pageSize: data.pageSize || 50 },
            }).then(({ data: countData }) => {
                const updatedTabs = (queryTabsRef.current || []).map((tab) => (
                    tab.type === "table" && tab.id === database?.db_id && tab.name === tableName
                        ? { ...tab, data: { ...tab.data, count: countData.count }, count: countData.count, countPending: false, countError: false }
                        : tab
                ))
                queryTabsRef.current = updatedTabs
                setQueryTabs(updatedTabs)
            }).catch(() => {
                const updatedTabs = (queryTabsRef.current || []).map((tab) => (
                    tab.type === "table" && tab.id === database?.db_id && tab.name === tableName
                        ? { ...tab, countPending: false, countError: true }
                        : tab
                ))
                queryTabsRef.current = updatedTabs
                setQueryTabs(updatedTabs)
            })
        } catch (error) {
            console.error("Unable to load table", error)
        }
    }

    const loadHiddenNavigationTables = useCallback((databaseId, { force = false, showRefreshLoading = false } = {}) => {
        if (!databaseId) return Promise.resolve()
        if (!force && String(pendingTableSchemaDatabaseRef.current ?? "") === String(databaseId)) return Promise.resolve()

        const requestId = ++tableSchemaRequestRef.current
        pendingTableSchemaDatabaseRef.current = databaseId
        setTableMenuLoading(true)
        if (showRefreshLoading) {
            setSchemaRefreshing(true)
            startRefreshIconAnimation(schemaRefreshIconRef.current, schemaRefreshIconAnimationRef)
        } else {
            setSchemaRefreshing(false)
        }
        setTableMenuError("")
        setHiddenNavigationSchema({ databaseId, data: [] })
        setTables({ _databaseId: databaseId, data: [] })

        return axios.get(`/api/playground/db/table?db_id=${encodeURIComponent(databaseId)}`)
            .then(({ data }) => {
                if (String(activeDatabaseIdRef.current) !== String(databaseId) || requestId !== tableSchemaRequestRef.current) return
                const schema = Array.isArray(data?.data) ? data.data : []
                setHiddenNavigationSchema({ databaseId, data: schema })
                setTables({ ...data, data: schema, _databaseId: databaseId, _dialect: data.dialect })
            })
            .catch((error) => {
                if (requestId === tableSchemaRequestRef.current && String(activeDatabaseIdRef.current) === String(databaseId)) {
                    console.error("Unable to load database tables", error)
                    setTableMenuError(error.response?.data?.error || error.response?.data?.message || "Unable to load tables")
                    setHiddenNavigationSchema({ databaseId, data: [] })
                    setTables({ _databaseId: databaseId, data: [] })
                }
            })
            .finally(() => {
                if (requestId === tableSchemaRequestRef.current) {
                    pendingTableSchemaDatabaseRef.current = null
                    setTableMenuLoading(false)
                    setSchemaRefreshing(false)
                    stopRefreshIconAnimation(schemaRefreshIconRef.current, schemaRefreshIconAnimationRef)
                }
            })
    }, [])

    useEffect(() => {
        if (!navigationHidden || !database?.db_id) return
        if (String(hiddenNavigationSchema.databaseId ?? "") !== String(database.db_id)) {
            loadHiddenNavigationTables(database.db_id)
        }
    }, [database?.db_id, navigationHidden, hiddenNavigationSchema.databaseId, loadHiddenNavigationTables])

    const selectDatabaseFromHiddenNavigation = (selectedDatabase) => {
        activeDatabaseIdRef.current = selectedDatabase.id
        tableSchemaRequestRef.current += 1
        pendingTableSchemaDatabaseRef.current = null
        setTableMenuLoading(true)
        setSchemaRefreshing(false)
        setHiddenNavigationSchema({ databaseId: selectedDatabase.id, data: [] })
        setDatabase({ db_id: selectedDatabase.id, db_name: selectedDatabase.db_name, dialect: selectedDatabase.dialect })
        setQuery("")
        setQueryResults(null)
        setQueryTabs([])
        setActiveTabIndex(0)
        setDatabaseMenuOpen(false)
        setDatabaseMenuSearch("")
        setTableMenuSearch("")
        router.push(`/app/playground/play/${encodeURIComponent(selectedDatabase.id)}`)

        loadHiddenNavigationTables(selectedDatabase.id, { force: true })
    }

    const openSqlTab = (sql, runImmediately = false) => {
        const currentTabs = queryTabs || [];
        let sqlTabNumber = 1;
        while (currentTabs.some((tab) => tab.name === (sqlTabNumber === 1 ? "SQL" : `SQL ${sqlTabNumber}`))) {
            sqlTabNumber += 1;
        }
        const name = sqlTabNumber === 1 ? "SQL" : `SQL ${sqlTabNumber}`;
        const newSqlTab = {
            id: `sql-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name,
            type: "sql",
            query: sql,
            data: { data: [] },
            count: 0,
        };
        setQuery(sql);
        const nextTabs = [...currentTabs, newSqlTab];
        queryTabsRef.current = nextTabs;
        setQueryTabs(nextTabs);
        setActiveTabIndex(currentTabs.length);
        if (runImmediately) {
            setLoading(true);
            setQueryError(false);
            axios.post("/api/playground/query", { db_id: database?.db_id, query: sql })
                .then(({ data }) => {
                    const updatedTabs = queryTabsRef.current.map((tab) => tab.id === newSqlTab.id
                        ? { ...tab, data, count: data.count, sensitiveColumns: data.sensitiveColumns || [], executedQuery: sql }
                        : tab);
                    queryTabsRef.current = updatedTabs;
                    setQueryTabs(updatedTabs);
                    setQueryTiming(data.duration_ms);
                    setQueryCount(data.count);
                    toast.add({ title: "Query completed", description: `${data.count} rows returned.`, type: "success" });
                })
                .catch((error) => {
                    setQueryError(true);
                    const message = error.response?.data?.error || "Unable to load table schema.";
                    toast.add({ title: "Query failed", description: message, type: "error" });
                })
                .finally(() => setLoading(false));
        }
    };

    // Pulsante SQL:
    // - se esiste già una tab type === 'sql' → focus su quella
    // - altrimenti crea UNA sola tab sql vuota
    const handleSqlClick = () => {
        const currentTabs = queryTabs || [];

        const existingIndex = currentTabs.findIndex((tab) => tab.type === "sql");

        if (existingIndex !== -1) {
            setActiveTabIndex(existingIndex);
            return;
        }

        const newSqlTab = {
            id: `sql-${Date.now()}`,
            name: "SQL",
            type: "sql",
            query: "",
            data: {
                data: [], // per coerenza con struttura table (data.data)
            },
            count: 0,
        };

        const updated = [...currentTabs, newSqlTab];
        setQueryTabs(updated);
        setActiveTabIndex(updated.length - 1);
    };

    useEffect(() => {
        const tabs = queryTabs || [];
        queryTabsRef.current = tabs;

        const seen = new Set();
        const deduped = tabs.filter((t) => {
            if (seen.has(t.name)) return false;
            seen.add(t.name);
            return true;
        });

        if (deduped.length !== tabs.length) {
            setQueryTabs(deduped);

            if (activeTabIndex > deduped.length - 1) {
                setActiveTabIndex(deduped.length === 0 ? 0 : deduped.length - 1);
            }

            prevLengthRef.current = deduped.length;
            return;
        }

        const length = deduped.length;
        const prev = prevLengthRef.current;

        if (length === 0) {
            setActiveTabIndex(0);
            prevLengthRef.current = 0;
            return;
        }

        if (length > prev) {
            setActiveTabIndex(length - 1);
        } else if (activeTabIndex > length - 1) {
            setActiveTabIndex(length - 1);
        }

        prevLengthRef.current = length;
    }, [queryTabs, activeTabIndex, setQueryTabs]);

    const activeTab =
        queryTabs && queryTabs.length > 0 ? queryTabs[activeTabIndex] : null;
    const sqlEditorTables = useMemo(() => (tables?.data || [])
        .map((table) => table.tableName)
        .filter(Boolean), [tables?.data]);
    const sqlEditorSchema = useMemo(() => Object.fromEntries((tables?.data || [])
        .filter((table) => table.tableName)
        .map((table) => [
            table.tableName.toLowerCase(),
            (table.details?.columns || []).map((column) => ({
                label: column.field,
                type: column.key === "PRI"
                    ? "keyword"
                    : column.key === "UNI"
                        ? "enum"
                        : "property",
            })),
        ])), [tables?.data]);
    const activeSqlQuery = activeTab?.query ?? query;
    const executedSqlQuery = activeTab?.executedQuery || activeTab?.query || "";
    const activeTableSchema = useMemo(() => activeTab?.schema?.length
        ? activeTab.schema
        : tables?.data?.find((table) => table.tableName === activeTab?.name)?.details?.columns || EMPTY_COLUMNS,
    [activeTab?.name, activeTab?.schema, tables?.data]);
    const primaryKeyColumns = useMemo(() => activeTableSchema.filter((column) => column.key === "PRI"), [activeTableSchema]);
    const activePrimaryKey = activeTab?.primaryKeyField || (primaryKeyColumns.length === 1 ? primaryKeyColumns[0].field : undefined);
    const activeColumnVisibilityKey = activeTab?.type === "table"
        ? `${activeTab.id || database?.db_id}:${activeTab.name}`
        : activeTab?.id || activeTab?.name || String(activeTabIndex)
    const activeColumnVisibility = columnVisibilityByTab[activeColumnVisibilityKey] || EMPTY_COLUMN_VISIBILITY
    const activeResultColumns = useMemo(() => activeTab?.type === "table" && activeTableSchema.length > 0
        ? activeTableSchema.map((column) => column.field)
        : Object.keys(activeTab?.data?.data?.[0] || {}),
    [activeTab?.data?.data, activeTab?.type, activeTableSchema]);
    const activeFilterColumns = useMemo(() => {
        const schemaColumns = activeTab?.type === "table"
            ? activeTableSchema.map((column) => column.field)
            : [];
        const resultColumns = Object.keys(activeTab?.data?.data?.[0] || {});
        return [...new Set([...schemaColumns, ...activeResultColumns, ...resultColumns].filter((column) => typeof column === "string" && column.length > 0))];
    }, [activeResultColumns, activeTab?.data?.data, activeTab?.type, activeTableSchema]);
    const activeFilterRules = filterRulesByTab[activeColumnVisibilityKey] || EMPTY_FILTER_RULES
    const updateActiveFilterRules = (rules) => {
        setFilterRulesByTab((current) => ({ ...current, [activeColumnVisibilityKey]: rules }))
        if (activeTab?.type === "table" && activeTab.serverPaginated) requestFilteredTablePage(rules)
    }
    const activeGrouping = groupingByTab[activeColumnVisibilityKey] || EMPTY_GROUPING
    const updateActiveGrouping = (grouping) => setGroupingByTab((current) => ({ ...current, [activeColumnVisibilityKey]: grouping }))
    const filteredResultColumns = useMemo(() => activeResultColumns.filter((column) => column.toLowerCase().includes(columnSearch.trim().toLowerCase())), [activeResultColumns, columnSearch])
    const toggleColumnVisibility = (column) => setColumnVisibilityByTab((current) => {
        const visibility = current[activeColumnVisibilityKey] || {}
        return {
            ...current,
            [activeColumnVisibilityKey]: {
                ...visibility,
                [column]: visibility[column] === false,
            },
        }
    })
    const hideAllColumns = () => setColumnVisibilityByTab((current) => ({
        ...current,
        [activeColumnVisibilityKey]: {
            ...activeColumnVisibility,
            ...Object.fromEntries(activeResultColumns.map((column) => [column, false])),
        },
    }))
    const renderColumnSelector = () => (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button className="flex h-6 items-center gap-1 border-0 bg-white p-1 px-2 text-black shadow-none ring-0 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900 !text-xs !font-semibold">
                    <Columns3 size={12} />
                    Columns <ChevronDown size={12} />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 p-1">
                <div className="relative p-1">
                    <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <Input value={columnSearch} onChange={(event) => setColumnSearch(event.target.value)} onKeyDown={(event) => event.stopPropagation()} placeholder="Search..." aria-label="Search columns" className="h-7 rounded-md pl-7 pr-2 !text-xs !font-semibold" />
                </div>
                <div className="max-h-56 overflow-y-auto">
                    {filteredResultColumns.length > 0
                        ? filteredResultColumns.map((column) => (
                            <DropdownMenuItem
                                key={column}
                                onSelect={(event) => event.preventDefault()}
                                onClick={() => toggleColumnVisibility(column)}
                                className="gap-2 !py-1.5 !font-mono !text-xs !font-semibold"
                            >
                                <Checkbox
                                    checked={activeColumnVisibility[column] !== false}
                                    onCheckedChange={() => toggleColumnVisibility(column)}
                                    onClick={(event) => event.stopPropagation()}
                                    aria-label={`${activeColumnVisibility[column] !== false ? "Hide" : "Show"} ${column} column`}
                                    className="h-4 w-4 border-zinc-400 bg-transparent text-zinc-900 data-[state=checked]:border-zinc-300 data-[state=checked]:bg-zinc-300 data-[state=checked]:text-zinc-950 dark:border-zinc-500 dark:data-[state=checked]:border-zinc-300 dark:data-[state=checked]:bg-zinc-300 dark:data-[state=checked]:text-zinc-950"
                                />
                                <span>{column}</span>
                            </DropdownMenuItem>
                        ))
                        : <p className="px-2 py-4 text-center text-xs font-semibold text-zinc-500">No columns match.</p>}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={hideAllColumns} className="justify-end !text-xs !font-semibold">Hide all</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
    const renderTableFilters = () => (
        <TableFilters
            columns={activeFilterColumns}
            rules={activeFilterRules}
            onChange={updateActiveFilterRules}
            sensitiveColumns={database?.preferences?.sensitiveColumns || activeTab?.sensitiveColumns || []}
            disabled={activeTab?.type === "table" && (paginationLoading || modifiedRowsCount > 0 || selectedRowsCount > 0)}
        />
    )
    const renderTableGrouping = () => (
        <TableGrouping columns={activeResultColumns} grouping={activeGrouping} onChange={updateActiveGrouping} />
    )
    const directSelectMatch = activeTab?.type === "sql"
        ? String(executedSqlQuery).match(/^\s*SELECT\s+\*\s+FROM\s+(`(?:``|[^`])+`|[A-Za-z_][A-Za-z0-9_$]*)\s*;?\s*$/i)
        : null;
    const querySourceTable = directSelectMatch
        ? directSelectMatch[1].startsWith("`")
            ? directSelectMatch[1].slice(1, -1).replace(/``/g, "`")
            : directSelectMatch[1]
        : null;
    const querySourceSchema = useMemo(() => tables?.data?.find((table) => table.tableName === querySourceTable)?.details?.columns || EMPTY_COLUMNS, [querySourceTable, tables?.data]);
    const querySourcePrimaryKeys = useMemo(() => querySourceSchema.filter((column) => column.key === "PRI"), [querySourceSchema]);
    const canEditQueryResults = Boolean(querySourceTable && querySourceSchema.length > 0);
    const sqlResultPageData = useMemo(() => {
        const rows = activeTab?.data?.data || EMPTY_COLUMNS;
        const pageSize = activeTab?.resultPageSize || 50;
        const pageIndex = activeTab?.resultPageIndex || 0;
        return rows.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize);
    }, [activeTab?.data?.data, activeTab?.resultPageIndex, activeTab?.resultPageSize]);

    const updateSavedTable = (updatedData) => {
        setQueryTabs((queryTabs || []).map((tab, index) => index === activeTabIndex
            ? {
                ...tab,
                data: { data: updatedData.data, count: updatedData.count ?? tab.count ?? null },
                count: updatedData.count ?? tab.count ?? null,
                ...(updatedData.sensitiveColumns ? { sensitiveColumns: updatedData.sensitiveColumns } : {}),
                ...(updatedData.pageIndex !== undefined ? { pageIndex: updatedData.pageIndex } : {}),
                ...(updatedData.pageSize !== undefined ? { pageSize: updatedData.pageSize } : {}),
                ...(updatedData.hasNext !== undefined ? { hasNext: updatedData.hasNext } : {}),
                ...(updatedData.hasPrevious !== undefined ? { hasPrevious: updatedData.hasPrevious } : {}),
                ...(updatedData.cursorSupported !== undefined ? { cursorSupported: updatedData.cursorSupported } : {}),
                ...(updatedData.nextCursor !== undefined ? { nextCursor: updatedData.nextCursor } : {}),
                ...(updatedData.previousCursor !== undefined ? { previousCursor: updatedData.previousCursor } : {}),
                ...(updatedData.requestCursor !== undefined ? { requestCursor: updatedData.requestCursor } : {}),
                ...(updatedData.requestDirection !== undefined ? { requestDirection: updatedData.requestDirection } : {}),
            }
            : tab));

        if (activeTab?.type === "table" && database?.db_id) {
            axios.get("/api/playground/db/table/rows", {
                params: {
                    db_id: database.db_id,
                    table: activeTab.name,
                    count_only: "true",
                    pageSize: updatedData.pageSize || activeTab.pageSize || 50,
                    ...(activeFilterRules.length ? { filters: JSON.stringify(activeFilterRules) } : {}),
                },
            }).then(({ data }) => {
                const currentTabs = queryTabsRef.current || queryTabs || [];
                const updatedTabs = currentTabs.map((tab) => tab.type === "table" && tab.id === database.db_id && tab.name === activeTab.name
                    ? {
                        ...tab,
                        data: { ...tab.data, count: data.count },
                        count: data.count,
                        countPending: false,
                        countError: false,
                    }
                    : tab);
                queryTabsRef.current = updatedTabs;
                setQueryTabs(updatedTabs);
            }).catch(() => {});
        }
    };

    const updateTablePage = ({ data, count, pageIndex, pageSize, sensitiveColumns, hasNext, hasPrevious, cursorSupported, nextCursor, previousCursor, requestCursor, requestDirection }) => {
        setQueryTabs((queryTabs || []).map((tab, index) => index === activeTabIndex
            ? {
                ...tab,
                data: { data, count: count ?? tab.count ?? null },
                count: count ?? tab.count ?? null,
                countPending: count == null ? Boolean(tab.countPending) : false,
                hasNext,
                hasPrevious,
                cursorSupported,
                nextCursor,
                previousCursor,
                requestCursor,
                requestDirection,
                pageIndex,
                pageSize,
                ...(sensitiveColumns ? { sensitiveColumns } : {}),
            }
            : tab));
    };

    const requestFilteredTablePage = async (rules) => {
        const targetTab = activeTab;
        if (!targetTab || paginationLoading || modifiedRowsCount > 0 || selectedRowsCount > 0) return;
        const filterSignature = JSON.stringify(rules);
        const currentTabs = queryTabsRef.current || queryTabs || [];
        const markedTabs = currentTabs.map((tab) => tab.id === targetTab.id && tab.name === targetTab.name
            ? { ...tab, data: { ...tab.data, count: null }, filterSignature, count: null, countPending: true, countError: false }
            : tab);
        queryTabsRef.current = markedTabs;
        setQueryTabs(markedTabs);
        setPaginationLoading(true);
        setPaginationError("");
        const filterParams = rules.length ? { filters: JSON.stringify(rules) } : {};
        try {
            const response = await axios.get("/api/playground/db/table/rows", {
                params: { db_id: database?.db_id, table: targetTab.name, page: 0, pageSize: targetTab.pageSize || 50, ...filterParams },
            });
            const updatedTabs = (queryTabsRef.current || queryTabs || []).map((tab) =>
                tab.id === targetTab.id && tab.name === targetTab.name
                    ? {
                        ...tab,
                        data: { data: response.data.data, count: null },
                        count: null,
                        countPending: true,
                        countError: false,
                        hasNext: response.data.hasNext,
                        hasPrevious: response.data.hasPrevious,
                        cursorSupported: response.data.cursorSupported,
                        nextCursor: response.data.nextCursor,
                        previousCursor: response.data.previousCursor,
                        requestCursor: null,
                        requestDirection: "next",
                        pageIndex: 0,
                        pageSize: response.data.pageSize,
                        sensitiveColumns: response.data.sensitiveColumns || [],
                        filterSignature,
                    }
                    : tab
            );
            queryTabsRef.current = updatedTabs;
            setQueryTabs(updatedTabs);
            axios.get("/api/playground/db/table/rows", {
                params: {
                    db_id: database?.db_id,
                    table: targetTab.name,
                    count_only: "true",
                    pageSize: response.data.pageSize,
                    ...filterParams,
                },
            }).then(({ data }) => {
                const currentTabs = queryTabsRef.current || [];
                const countedTabs = currentTabs.map((tab) => tab.id === targetTab.id && tab.name === targetTab.name && tab.filterSignature === filterSignature
                    ? { ...tab, data: { ...tab.data, count: data.count }, count: data.count, countPending: false, countError: false }
                    : tab);
                queryTabsRef.current = countedTabs;
                setQueryTabs(countedTabs);
            }).catch(() => {
                const currentTabs = queryTabsRef.current || [];
                const failedTabs = currentTabs.map((tab) => tab.id === targetTab.id && tab.name === targetTab.name && tab.filterSignature === filterSignature
                    ? { ...tab, countPending: false, countError: true }
                    : tab);
                queryTabsRef.current = failedTabs;
                setQueryTabs(failedTabs);
            });
        } catch (error) {
            const message = error.response?.data?.error || "Unable to apply table filters.";
            setPaginationError(message);
            toast.add({ title: "Unable to apply table filters", description: message, type: "error" });
        } finally {
            setPaginationLoading(false);
        }
    };

    const changeActiveTablePage = async (pageIndex, pageSize = activeTab?.pageSize || 50) => {
        if (!activeTab?.serverPaginated || paginationLoading || modifiedRowsCount > 0 || selectedRowsCount > 0) return;
        setPaginationLoading(true);
        setPaginationError("");
        try {
            const changingPageSize = pageSize !== (activeTab.pageSize || 50);
            const currentPage = activeTab.pageIndex || 0;
            const movingPrevious = pageIndex < currentPage;
            const isAdjacentPage = Math.abs(pageIndex - currentPage) === 1;
            const requestDirection = movingPrevious ? "previous" : "next";
            // Cursors only describe the immediately adjacent page. For direct
            // jumps (first/last), use the API's indexed offset pagination.
            const requestCursor = changingPageSize || !isAdjacentPage
                ? null
                : activeTab.cursorSupported
                    ? movingPrevious ? activeTab.previousCursor : activeTab.nextCursor
                    : null;
            const params = {
                db_id: database?.db_id,
                table: activeTab.name,
                page: pageIndex,
                pageSize,
                ...(activeFilterRules.length ? { filters: JSON.stringify(activeFilterRules) } : {}),
            };
            if (activeTab.cursorSupported && requestCursor) {
                params.cursor = requestCursor;
                params.direction = requestDirection;
            }
            const response = await axios.get("/api/playground/db/table/rows", {
                params,
            });
            updateTablePage({
                data: response.data.data,
                count: response.data.count,
                hasNext: response.data.hasNext,
                hasPrevious: response.data.hasPrevious,
                cursorSupported: response.data.cursorSupported,
                nextCursor: response.data.nextCursor,
                previousCursor: response.data.previousCursor,
                requestCursor,
                requestDirection,
                pageIndex: response.data.page,
                pageSize: response.data.pageSize,
                sensitiveColumns: response.data.sensitiveColumns || [],
            });
        } catch (error) {
            const message = error.response?.data?.error || "Unable to load table page.";
            setPaginationError(message);
            toast.add({ title: "Unable to load table page", description: message, type: "error" });
        } finally {
            setPaginationLoading(false);
        }
    };

    const changeSqlResultPage = (pageIndex, pageSize = activeTab?.resultPageSize || 50) => {
        if (activeTab?.type !== "sql" || modifiedRowsCount > 0 || selectedRowsCount > 0) return;
        const rowCount = activeTab.data?.data?.length || 0;
        const totalPages = Math.ceil(rowCount / pageSize);
        const boundedPage = Math.max(0, Math.min(pageIndex, Math.max(0, totalPages - 1)));
        const updatedTabs = (queryTabsRef.current || queryTabs || []).map((tab, index) => index === activeTabIndex
            ? { ...tab, resultPageIndex: boundedPage, resultPageSize: pageSize }
            : tab);
        queryTabsRef.current = updatedTabs;
        setQueryTabs(updatedTabs);
    };

    const removeTab = (index) => {
        const newTabs = queryTabs.filter((_, i) => i !== index);
        setQueryTabs(newTabs);

        if (newTabs.length === 0) {
            setActiveTabIndex(0);
            prevLengthRef.current = 0;
            return;
        }

        if (index === activeTabIndex) {
            setActiveTabIndex(index === 0 ? 0 : index - 1);
        } else if (index < activeTabIndex) {
            setActiveTabIndex((prev) => prev - 1);
        }

        prevLengthRef.current = newTabs.length;
    };

    const hasTabs = queryTabs && queryTabs.length > 0;
    const hiddenSchemaBelongsToActiveDatabase = String(hiddenNavigationSchema.databaseId ?? "") === String(database?.db_id ?? "")
    const filteredHiddenNavigationTables = (hiddenSchemaBelongsToActiveDatabase ? hiddenNavigationSchema.data : []).filter((table) =>
        String(table.tableName || "").toLowerCase().includes(tableMenuSearch.trim().toLowerCase())
    )

    const fetchQuery = () => {
        setLoading(true)
        if (!database?.db_id) {
            console.warn("Missing database.db_id");
            return;
        }

        axios
            .post("/api/playground/query", {
                db_id: database.db_id,
                query: activeTab?.query ?? query,
            })
            .then((res) => {
                setLoading(false)
                setQueryError(false)
                // Aggiorna SOLO la tab attiva (SQL) con i risultati
                const updatedTabs = queryTabs.map((tab, index) => {
                    if (index !== activeTabIndex) return tab;
                    setQueryTiming(res.data.duration_ms)
                    setQueryCount(res.data.count)
                    return {
                        ...tab,
                        data: res.data, // es: { data: [...] , count: ... }
                        sensitiveColumns: res.data.sensitiveColumns || [],
                        resultPageIndex: 0,
                        executedQuery: activeTab?.query ?? query,
                    };
                });

                setQueryTabs(updatedTabs);
            })
            .catch((error) => {
                setLoading(false)
                console.error(error.response.data.error || error.response.data.original?.sqlMessage);
                setQueryError(true)
                const message = error.response?.data?.error || error.response?.data?.original?.sqlMessage || "Unable to run query.";
                toast.add({ title: "Query failed", description: message, type: "error" });
            });
    };

    const refreshActiveTable = async () => {
        if (activeTab?.type !== "table" || !database?.db_id || loading) return;
        const tableName = activeTab.name;
        startRefreshIconAnimation(refreshIconRef.current, refreshIconAnimationRef)
        setLoading(true);
        setQueryError(false);
        try {
            const response = await axios.get("/api/playground/db/table/rows", {
                params: {
                    db_id: database.db_id,
                    table: tableName,
                    page: activeTab.pageIndex || 0,
                    pageSize: activeTab.pageSize || 50,
                    ...(activeTab.cursorSupported && activeTab.requestCursor ? {
                        cursor: activeTab.requestCursor,
                        direction: activeTab.requestDirection || "next",
                    } : {}),
                },
            });
            setQueryTabs((queryTabs || []).map((tab) =>
                tab.type === "table" && tab.name === tableName
                    ? {
                        ...tab,
                        data: { data: response.data.data, count: response.data.count ?? tab.count ?? null },
                        count: response.data.count ?? tab.count ?? null,
                        hasNext: response.data.hasNext,
                        hasPrevious: response.data.hasPrevious,
                        cursorSupported: response.data.cursorSupported,
                        nextCursor: response.data.nextCursor,
                        previousCursor: response.data.previousCursor,
                        pageIndex: response.data.page,
                        pageSize: response.data.pageSize,
                        sensitiveColumns: response.data.sensitiveColumns || [],
                    }
                    : tab
            ));
            setQueryCount(response.data.count);
            setQueryTiming(response.data.duration_ms);
        } catch (error) {
            setQueryError(true);
            const message = error.response?.data?.error || error.response?.data?.original?.sqlMessage || "Unable to refresh table";
            toast.add({ title: "Unable to refresh table", description: message, type: "error" });
        } finally {
            setLoading(false);
            stopRefreshIconAnimation(refreshIconRef.current, refreshIconAnimationRef)
        }
    };

    const exportActiveTable = async (format) => {
        const sourceRows = activeTab?.data?.data;
        if (!Array.isArray(sourceRows)) return;

        const activeRules = activeFilterRules.filter((rule) =>
            rule && (['isEmpty', 'isNotEmpty'].includes(rule.operator) || String(rule.value ?? '').trim() !== '')
        );
        const exportingSelection = selectedRowsCount > 0;
        let rows = exportingSelection ? selectedRowsForExport : sourceRows;
        if (!exportingSelection && activeTab?.type === "table" && activeTab.serverPaginated) {
            setExportingTable(true);
            setExportError("");
            try {
                rows = [];
                let page = 0;
                let hasNext = true;
                while (hasNext) {
                    const response = await axios.get("/api/playground/db/table/rows", {
                        params: {
                            db_id: database?.db_id,
                            table: activeTab.name,
                            page,
                            pageSize: 5_000,
                            export: "true",
                            ...(activeRules.length ? { filters: JSON.stringify(activeRules) } : {}),
                        },
                    });
                    const pageRows = response.data?.data;
                    if (!Array.isArray(pageRows)) throw new Error("Invalid table export response.");
                    rows.push(...pageRows);
                    hasNext = response.data.hasNext === true;
                    page += 1;
                }
            } catch (error) {
                console.error("Unable to export all table rows", error);
                const message = error.response?.data?.error || "Unable to export all table rows.";
                setExportError(message);
                toast.add({ title: "Unable to export table", description: message, type: "error" });
                return;
            } finally {
                setExportingTable(false);
            }
        }
        rows = rows.filter((row) => {
            if (row?.__insertDraft || activeRules.length === 0) return true;
            const matchesRule = (rule) => {
                const rawValue = row?.[rule.column];
                const value = rawValue == null ? '' : typeof rawValue === 'object' ? JSON.stringify(rawValue) : String(rawValue);
                const normalized = value.toLowerCase();
                const target = String(rule.value ?? '').toLowerCase();
                switch (rule.operator) {
                    case 'equals': return normalized === target;
                    case 'notEquals': return normalized !== target;
                    case 'startsWith': return normalized.startsWith(target);
                    case 'endsWith': return normalized.endsWith(target);
                    case 'isEmpty': return value.trim() === '';
                    case 'isNotEmpty': return value.trim() !== '';
                    case 'contains':
                    default: return normalized.includes(target);
                }
            };
            const groups = [[]];
            activeRules.forEach((rule, index) => {
                if (index > 0 && rule.conjunction === 'or') groups.push([]);
                groups[groups.length - 1].push(rule);
            });
            return groups.some((group) => group.every(matchesRule));
        });
        const sensitiveColumns = database?.preferences?.sensitiveColumns || activeTab?.sensitiveColumns || [];
        const exportRows = rows.map((row) => sensitiveColumns.reduce((maskedRow, column) => (
            Object.prototype.hasOwnProperty.call(maskedRow, column)
                ? { ...maskedRow, [column]: "••••••••" }
                : maskedRow
        ), { ...row }));

        let contents;
        let mimeType;
        if (format === "json") {
            contents = JSON.stringify(exportRows.map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => key !== "__rowToken"))), null, 2);
            mimeType = "application/json;charset=utf-8";
        } else {
            const columns = [...new Set(rows.flatMap((row) => Object.keys(row).filter((key) => !key.startsWith("__"))))];
            const escapeCsv = (value) => {
                const text = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
                return `"${text.replace(/"/g, '""')}"`;
            };
            contents = [columns.map(escapeCsv).join(","), ...exportRows.map((row) => columns.map((column) => escapeCsv(row[column])).join(","))].join("\r\n");
            mimeType = "text/csv;charset=utf-8";
        }

        const blob = new Blob([contents], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const safeTableName = String(activeTab?.name || "table").replace(/[\\/:*?"<>|]/g, "_");
        link.href = url;
        link.download = `${safeTableName}.${format}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
    };

    return (
        <div>
            {/* passiamo anche activeTabName */}
            <LeftBar openTab={openOrFocusTab} openSqlTab={openSqlTab} activeTabName={activeTab?.name ?? null} />
            <div className="z-40 flex h-screen min-h-0 flex-col overflow-hidden transition-[margin] duration-200" style={{ marginLeft: navigationHidden ? 0 : navigationWidth }}>
                <div className="sticky top-0 z-40 bg-zinc-50 dark:bg-zinc-950">
                    <div className="border-b h-[53px] flex items-center w-full justify-between bg-zinc-50 dark:bg-zinc-900/30">
                        <div className="flex items-center gap-2 p-3 px-4">
                            <ShowNavigationButton />
                            {showToolbarSkeleton && <div className="flex items-center gap-2" aria-label="Loading database toolbar" aria-busy="true">
                                <Skeleton className="h-7 w-32" />
                                <Skeleton className="h-6 w-6" />
                                <Skeleton className="h-6 w-6" />
                                <Skeleton className="h-6 w-10" />
                            </div>}
                            {navigationHidden && !showToolbarSkeleton && <DropdownMenu open={databaseMenuOpen} onOpenChange={setDatabaseMenuOpen}>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    aria-label="Select database"
                                                    title={database?.db_name || "Select database"}
                                                    className="flex h-7 max-w-[220px] items-center gap-2 border-0 bg-transparent px-2 py-1 text-zinc-700 shadow-none hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                                >
                                                    <DatabaseEngineIcon dialect={database?.dialect || databases?.find((item) => item.id === database?.db_id)?.dialect} size={14} />
                                                    {database?.db_name && <span className="truncate text-xs font-semibold">{database.db_name}</span>}
                                                    <ChevronsUpDown size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                        </TooltipTrigger>
                                        <TooltipContent className="mt-2 font-semibold border bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-100">
                                            <p>Select database</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                                <DropdownMenuContent align="start" className="w-56 overflow-hidden p-1">
                                    <div className="sticky top-0 z-10 bg-popover pb-1">
                                        <Input
                                            value={databaseMenuSearch}
                                            onChange={(event) => setDatabaseMenuSearch(event.target.value)}
                                            onKeyDown={(event) => event.stopPropagation()}
                                            onClick={(event) => event.stopPropagation()}
                                            placeholder="Search databases..."
                                            aria-label="Search databases"
                                            className="h-7 !text-xs !font-semibold"
                                        />
                                    </div>
                                    <div className="max-h-[min(70vh,400px)] overflow-y-auto">
                                        {(databases || [])
                                            .filter((item) => String(item.db_name || "").toLowerCase().includes(databaseMenuSearch.trim().toLowerCase()))
                                            .map((item) => <DropdownMenuItem
                                                key={item.id}
                                                onSelect={() => selectDatabaseFromHiddenNavigation(item)}
                                                className="flex items-center gap-2 !text-xs !font-semibold"
                                            >
                                                <DatabaseEngineIcon dialect={item.dialect} size={12} />
                                                <span className="min-w-0 flex-1 truncate">{item.db_name}</span>
                                                {item.id === database?.db_id && <Check size={12} className="shrink-0" />}
                                            </DropdownMenuItem>)}
                                        {!(databases || []).some((item) => String(item.db_name || "").toLowerCase().includes(databaseMenuSearch.trim().toLowerCase())) && (
                                            <DropdownMenuItem disabled className="!text-xs !font-semibold">{databaseMenuSearch.trim() ? "No databases match your search" : "No databases found"}</DropdownMenuItem>
                                        )}
                                    </div>
                                    <DropdownMenuSeparator className="my-1" />
                                    <DropdownMenuItem
                                        onSelect={() => {
                                            setDatabaseMenuOpen(false)
                                            setAddDatasetOpen(true)
                                        }}
                                        className="flex items-center gap-2 !text-xs !font-semibold"
                                    >
                                        <Plus size={12} />
                                        Add dataset
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>}
                            {navigationHidden && !showToolbarSkeleton && <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            aria-label="Refresh schema"
                                            disabled={!database?.db_id || schemaRefreshing}
                                            onClick={() => loadHiddenNavigationTables(database?.db_id, { force: true, showRefreshLoading: true })}
                                            className="h-6 w-6 border-0 bg-transparent p-1 text-zinc-700 shadow-none hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                        >
                                            <RefreshCcw ref={schemaRefreshIconRef} size={14} />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent className="mt-2 border bg-white font-semibold text-zinc-950 dark:bg-zinc-950 dark:text-zinc-100">
                                        <p>Refresh schema</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>}
                            {navigationHidden && !showToolbarSkeleton && <DropdownMenu open={tableMenuOpen} onOpenChange={(open) => {
                                setTableMenuOpen(open)
                                if (open && database?.db_id && tableMenuError) {
                                    loadHiddenNavigationTables(database.db_id, { force: true })
                                }
                            }}>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    aria-label="Show database tables"
                                                    disabled={!database?.db_id}
                                                    className="h-6 w-6 border-0 bg-transparent p-1 text-zinc-700 shadow-none hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                                >
                                                    <Columns3 size={14} />
                                                </Button>
                                            </DropdownMenuTrigger>
                                        </TooltipTrigger>
                                        <TooltipContent className="mt-2 font-semibold border bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-100">
                                            <p>Show database tables</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                                <DropdownMenuContent align="start" className="w-56 overflow-hidden p-1">
                                    <div className="sticky top-0 z-10 bg-popover pb-1">
                                        <Input
                                            value={tableMenuSearch}
                                            onChange={(event) => setTableMenuSearch(event.target.value)}
                                            onKeyDown={(event) => event.stopPropagation()}
                                            onClick={(event) => event.stopPropagation()}
                                            placeholder="Search tables..."
                                            aria-label="Search database tables"
                                            className="h-7 !text-xs !font-semibold"
                                        />
                                    </div>
                                    <div className="max-h-[min(70vh,400px)] overflow-y-auto">
                                        {tableMenuLoading ? <DropdownMenuItem disabled className="!text-xs !font-semibold">Loading tables...</DropdownMenuItem>
                                            : filteredHiddenNavigationTables.length > 0
                                                ? filteredHiddenNavigationTables.map((table) => <DropdownMenuItem
                                                    key={table.tableName}
                                                    onSelect={() => openTableFromHiddenNavigation(table.tableName)}
                                                    className="flex items-center gap-2 !text-xs !font-semibold"
                                                >
                                                    <Table size={12} />
                                                    <span className="min-w-0 flex-1 truncate">{table.tableName}</span>
                                                    {activeTab?.type === "table" && activeTab.name === table.tableName && <Check size={12} className="shrink-0" />}
                                                </DropdownMenuItem>)
                                                : <DropdownMenuItem disabled className="!text-xs !font-semibold">{tableMenuError || (tableMenuSearch.trim() ? "No tables match your search" : "No tables found")}</DropdownMenuItem>}
                                    </div>
                                </DropdownMenuContent>
                            </DropdownMenu>}
                            {showToolbarSkeleton ? null : <Button
                                onClick={handleSqlClick}
                                className="bg-white dark:bg-zinc-950 hover:bg-zinc-100 hover:dark:bg-zinc-800 border-0 ring-1 ring-zinc-300 dark:ring-zinc-700 p-1 px-2 h-6 shadow-none text-black dark:text-zinc-100 !text-xs !font-semibold"
                            >
                                SQL
                            </Button>}
                        </div>
                        <AlertDialog open={addDatasetOpen} onOpenChange={setAddDatasetOpen}>
                            <AlertDialogContent className="z-[1000] bg-white text-zinc-900 outline-none focus:outline-none focus-visible:ring-0 dark:bg-zinc-950 dark:text-zinc-100">
                                <AlertDialogHeader>
                                    <AlertDialogTitle className="text-sm font-semibold">Add new dataset</AlertDialogTitle>
                                    <p className="text-xs font-semibold text-muted-foreground">
                                        Connect a MySQL, MariaDB, PostgreSQL, or SQL Server database, or upload a SQLite file to browse tables and run queries.
                                    </p>
                                    <AddDatabase onClose={() => setAddDatasetOpen(false)} onSuccess={() => setAddDatasetOpen(false)} />
                                </AlertDialogHeader>
                            </AlertDialogContent>
                        </AlertDialog>
                        <div className="flex items-center gap-2 p-3 px-4">
                            {showToolbarSkeleton ? <div className="flex items-center gap-2" aria-hidden="true"><Skeleton className="h-6 w-16" /><Skeleton className="h-6 w-16" /><Skeleton className="h-6 w-20" /></div> : <>
                            {database?.db_id && <Button onClick={() => router.push(`/app/playground/play/${encodeURIComponent(database.db_id)}/activity`)} className="flex items-center gap-1 bg-white dark:bg-zinc-950 hover:bg-zinc-100 hover:dark:bg-zinc-800 border-0 ring-1 ring-zinc-300 dark:ring-zinc-700 p-1 px-2 h-6 shadow-none text-black dark:text-zinc-100 !text-xs !font-semibold"><History size={12} />History</Button>}
                            {database?.db_id && <Button onClick={() => router.push(`/app/playground/play/${encodeURIComponent(database.db_id)}/settings`)} className="flex items-center gap-1 bg-white dark:bg-zinc-950 hover:bg-zinc-100 hover:dark:bg-zinc-800 border-0 ring-1 ring-zinc-300 dark:ring-zinc-700 p-1 px-2 h-6 shadow-none text-black dark:text-zinc-100 !text-xs !font-semibold"><Settings2 size={12} />Settings</Button>}
                            <Button
                                disabled={modifiedRowsCount === 0}
                                className={`flex flex-row gap-3 bg-white dark:bg-zinc-950 hover:bg-zinc-100 hover:dark:bg-zinc-800 border-0 p-1 px-2 h-6 shadow-none text-black dark:text-zinc-100 !text-xs !font-semibold ring-1 ${modifiedRowsCount > 0 ? 'ring-orange-500 dark:ring-orange-500' : 'ring-zinc-300 dark:ring-zinc-700'}`}
                                onClick={() => setIsSheetOpen(!isSheetOpen)}>
                                <span>Changes</span>
                                <span>{modifiedRowsCount > 0 ? modifiedRowsCount : 0}</span>
                            </Button>
                            </>}
                        </div>
                    </div>

                    {hasTabs && (
                        <div className="border-b flex items-center bg-white dark:bg-zinc-950 overflow-x-scroll">
                            {queryTabs.map((tab, i) => (
                                <div
                                    key={tab.name || i}
                                    role="tab"
                                    tabIndex={0}
                                    aria-selected={activeTabIndex === i}
                                    onKeyDown={(event) => {
                                        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                                            event.preventDefault();
                                            setActiveTabIndex(i);
                                        }
                                    }}
                                    className={`${
                                        activeTabIndex === i
                                            ? "!bg-zinc-100 dark:!bg-zinc-900"
                                            : ""
                                    } p-3 px-4 cursor-pointer border-r flex items-center justify-between gap-3 bg-zinc-50 dark:bg-zinc-800/30 hover:dark:!bg-zinc-900 hover:!bg-zinc-100`}
                                    onClick={() => setActiveTabIndex(i)}
                                >
                                    <div>{tab.type === "table" ? <Table size={12} /> : <CodeXml size={12}/>}</div>
                                    <p className="text-xs font-semibold">{tab.name}</p>

                                    <button
                                        type="button"
                                        aria-label={`Close ${tab.name || "tab"}`}
                                        className="hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-sm p-0.5"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            removeTab(i);
                                        }}
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab?.type === "sql" ? (
                        <div className="bg-white dark:bg-zinc-950 border-b">
                            <div className="p-3 px-4 flex items-center justify-between gap-3">
                                <Button
                                    disabled={!database?.db_id || !activeSqlQuery?.trim() || loading}
                                    onClick={fetchQuery}
                                    className="flex items-center gap-1 ring-1 ring-blue-500 bg-blue-600 hover:bg-blue-700 border-0  p-1 px-2 h-6 shadow-none text-white dark:text-zinc-100 !text-xs !font-semibold"
                                >
                                    <Play size={12} />
                                    {loading === true
                                        ? "Running..."
                                        : <>
                                            Run Query
                                            <span className="text-[10px] text-blue-300">⌘↵</span>
                                        </>
                                    }

                                </Button>
                                {activeTab.data?.data?.length === 0
                                    ? null
                                    : <div className="flex items-center gap-1 text-xs font-semibold text-zinc-400 dark:text-zinc-500">
                                        <Clock size={12}/>
                                        {queryError ? "0" : queryTiming} ms
                                    </div>
                                }
                            </div>
                        </div>
                    ) : (
                        activeTab && (
                            <div className="bg-white dark:bg-zinc-950 border-b">
                                <div className="p-3 px-4 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-1">
                                        {selectedRowsCount > 0 ? (
                                            <div className="flex items-center gap-3">
                                                <Button onClick={() => setDeleteRowsRequest((count) => count + 1)} className="flex items-center gap-1 ring-1 ring-red-500 bg-red-600 hover:bg-red-700 border-0 p-1 px-2 h-6 shadow-none text-white dark:text-zinc-100 !text-xs !font-semibold">
                                                    <Trash2 size={12} />
                                                    Delete
                                                </Button>
                                                <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500">
                                                    {selectedRowsCount} {selectedRowsCount === 1 ? "row" : "rows"} selected for deletion
                                                </span>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button disabled={exportingTable} className="flex h-6 items-center gap-1 border-0 bg-white p-1 px-2 text-black shadow-none ring-0 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900 !text-xs !font-semibold">
                                                            <Download size={12} />
                                                            {exportingTable ? "Exporting..." : "Export"}
                                                            <ChevronDown size={12} />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="start">
                                                        <DropdownMenuItem className="!text-xs !font-semibold" onSelect={() => exportActiveTable("json")}>JSON</DropdownMenuItem>
                                                        <DropdownMenuItem className="!text-xs !font-semibold" onSelect={() => exportActiveTable("csv")}>CSV</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        ) : (
                                            <>
                                                <Button onClick={() => setInsertRowRequest((count) => count + 1)} className="flex items-center gap-1 ring-1 ring-blue-500 bg-blue-600 hover:bg-blue-700 border-0 p-1 px-2 h-6 shadow-none text-white dark:text-zinc-100 !text-xs !font-semibold">
                                                    <Plus size={12} />
                                                    Insert
                                                </Button>
                                                <Button disabled={loading} onClick={refreshActiveTable} className="flex items-center gap-1 bg-white dark:bg-zinc-950 hover:bg-zinc-100 hover:dark:bg-zinc-900 border-0 ring-0 ring-zinc-300 dark:ring-zinc-700 p-1 px-2 h-6 shadow-none text-black dark:text-zinc-100 !text-xs !font-semibold">
                                                    <RefreshCcw ref={refreshIconRef} size={12} />
                                                    Refresh
                                                </Button>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button disabled={exportingTable} className="flex items-center gap-1 bg-white dark:bg-zinc-950 hover:bg-zinc-100 hover:dark:bg-zinc-900 border-0 ring-0 ring-zinc-300 dark:ring-zinc-700 p-1 px-2 h-6 shadow-none text-black dark:text-zinc-100 !text-xs !font-semibold">
                                                            <Download size={12} />
                                                            {exportingTable ? "Exporting..." : "Export"}
                                                            <ChevronDown size={12} />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="start">
                                                        <DropdownMenuItem className="!text-xs !font-semibold" onSelect={() => exportActiveTable("json")}>
                                                            JSON
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem className="!text-xs !font-semibold" onSelect={() => exportActiveTable("csv")}>
                                                            CSV
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                                {renderTableFilters()}
                                                {renderTableGrouping()}
                                                {renderColumnSelector()}
                                            </>
                                        )}
                                    </div>
                                    {activeTab.data?.data?.length === 0 && activeTab.data?.affectedRows === undefined
                                        ? null
                                        : <div className="flex items-center gap-3">
                                            {activeTab.type === "table" && activeTab.serverPaginated && (() => {
                                                const pageSize = activeTab.pageSize || 50;
                                                const pageIndex = activeTab.pageIndex || 0;
                                                const countIsReady = Number.isFinite(activeTab.data?.count);
                                                const totalPages = countIsReady ? Math.ceil(activeTab.data.count / pageSize) : null;
                                                const paginationDisabled = paginationLoading || modifiedRowsCount > 0 || selectedRowsCount > 0;
                                                return (
                                                    <div aria-busy={paginationLoading} className="flex items-center gap-2 text-xs font-semibold text-zinc-400 dark:text-zinc-500">
                                                        <span>Page {pageIndex + 1} of {countIsReady ? totalPages : activeTab.countError ? "—" : "…"}</span>
                                                        <Select
                                                            value={String(pageSize)}
                                                            onValueChange={(value) => changeActiveTablePage(0, Number(value))}
                                                            disabled={paginationDisabled}
                                                        >
                                                            <SelectTrigger aria-label="Rows per page" className="h-6 w-[92px] border-0 bg-white px-2 py-0 text-xs font-semibold text-zinc-900 shadow-none ring-1 ring-zinc-300 focus:ring-1 focus:ring-zinc-400 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-700 dark:focus:ring-zinc-500 [&>span]:text-xs [&>span]:font-semibold [&>svg]:h-3 [&>svg]:w-3">
                                                                <SelectValue className="text-xs font-semibold" />
                                                            </SelectTrigger>
                                                            <SelectContent align="end" className="min-w-[92px] text-xs font-semibold">
                                                                {[10, 25, 50, 100].map((size) => (
                                                                    <SelectItem key={size} value={String(size)} className="py-1.5 text-xs font-semibold">{size} rows</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <Button
                                                            onClick={() => changeActiveTablePage(0)}
                                                            disabled={pageIndex === 0 || paginationDisabled}
                                                            aria-label="First page"
                                                            title="First page"
                                                            className="h-6 w-6 border-0 bg-white p-1 text-black shadow-none ring-1 ring-zinc-300 hover:bg-zinc-100 disabled:opacity-50 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-900"
                                                        ><ChevronsLeft size={14} /></Button>
                                                        <Button
                                                            onClick={() => changeActiveTablePage(pageIndex - 1)}
                                                            disabled={pageIndex === 0 || paginationDisabled}
                                                            className="h-6 border-0 bg-white p-1 px-2 text-black shadow-none ring-1 ring-zinc-300 hover:bg-zinc-100 disabled:opacity-50 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-900 !text-xs !font-semibold"
                                                        >Previous</Button>
                                                        <Button
                                                            onClick={() => changeActiveTablePage(pageIndex + 1)}
                                                            disabled={(countIsReady ? pageIndex + 1 >= totalPages : !activeTab.hasNext) || paginationDisabled}
                                                            className="h-6 border-0 bg-white p-1 px-2 text-black shadow-none ring-1 ring-zinc-300 hover:bg-zinc-100 disabled:opacity-50 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-900 !text-xs !font-semibold"
                                                        >Next</Button>
                                                        <Button
                                                            onClick={() => changeActiveTablePage(Math.max(0, totalPages - 1))}
                                                            disabled={!countIsReady || totalPages === 0 || pageIndex >= totalPages - 1 || paginationDisabled}
                                                            aria-label="Last page"
                                                            title="Last page"
                                                            className="h-6 w-6 border-0 bg-white p-1 text-black shadow-none ring-1 ring-zinc-300 hover:bg-zinc-100 disabled:opacity-50 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-900"
                                                        ><ChevronsRight size={14} /></Button>
                                                    </div>
                                                );
                                            })()}
                                            <div className="flex items-center gap-1 text-xs font-semibold text-zinc-400 dark:text-zinc-500">
                                                <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500">
                                                    {activeTab.countPending
                                                        ? `${activeTab.data?.data?.length || 0} loaded · total loading`
                                                        : activeTab.countError
                                                            ? `${activeTab.data?.data?.length || 0} loaded · total unavailable`
                                                            : `${activeTab.data?.count ?? activeTab.data?.data?.length ?? 0}${activeTab.data?.count === 1 ? " row" : " rows"}`}
                                                </p>
                                            </div>
                                        </div>
                                    }
                                </div>
                            </div>
                        )
                    )}
                </div>
                {hasTabs ? (
                    activeTab?.type === "table" ? (
                        <div className="flex min-h-0 flex-1 flex-col">
                        <QueryResultsTable
                            response={activeTab.data?.data}
                            rowCount={activeTab.data?.count}
                            tableName={activeTab.name}
                            schema={activeTableSchema}
                            databaseId={database?.db_id}
                            primaryKeyField={activePrimaryKey}
                            canSave={activeTab.type === "table"}
                            editable={activeTab.type === "table"}
                            showSelection
                            onSaved={updateSavedTable}
                            serverPaginated={activeTab.serverPaginated}
                            pageIndex={activeTab.pageIndex || 0}
                            pageSize={activeTab.pageSize || 50}
                            cursorSupported={activeTab.cursorSupported}
                            requestCursor={activeTab.requestCursor}
                            requestDirection={activeTab.requestDirection}
                            sensitiveColumns={database?.preferences?.sensitiveColumns || activeTab.sensitiveColumns || []}
                            columnVisibility={activeColumnVisibility}
                            filterRules={activeFilterRules}
                            grouping={activeGrouping}
                            openSheet={isSheetOpen}
                            onOpenChange={setIsSheetOpen}
                            onChangesCountChange={setModifiedRowsCount}
                            onSelectionCountChange={setSelectedRowsCount}
                            onSelectedRowsChange={setSelectedRowsForExport}
                            insertRowRequest={insertRowRequest}
                            onInsertRowRequestHandled={() => setInsertRowRequest(0)}
                            deleteRowsRequest={deleteRowsRequest}
                            onDeleteRowsRequestHandled={() => setDeleteRowsRequest(0)}
                        />
                        </div>
                    ) : activeTab?.type === "sql" ? (
                        <div>
                            <div className="border-b">
                                <MinimalEditor
                                    onChange={(value) => {
                                        setQuery(value);
                                        setQueryTabs((queryTabs || []).map((tab, index) => index === activeTabIndex
                                            ? { ...tab, query: value }
                                            : tab));
                                    }}
                                    schema={sqlEditorSchema}
                                    tables={sqlEditorTables}
                                    theme={theme}
                                    initialValue={activeSqlQuery}
                                />
                            </div>
                            {queryError === true ? null : loading === true ? <div className="h-[calc(100vh-54px)] flex items-center justify-center">
                                <p className="text-xs font-semibold">No rows for this table</p>
                            </div> : (
                                <div>
                                    {activeTab.data?.data?.length === 0
                                            ? null
                                        : <div className="p-3 px-4 border-b flex items-center justify-between gap-1 text-xs font-semibold text-zinc-400 dark:text-zinc-500">
                                            <div className="flex items-center gap-2">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button className="flex items-center gap-1 bg-white dark:bg-zinc-950 hover:bg-zinc-100 hover:dark:bg-zinc-900 border-0 ring-0 ring-zinc-300 dark:ring-zinc-700 p-1 px-2 h-6 shadow-none text-black dark:text-zinc-100 !text-xs !font-semibold">
                                                            <Download size={12} />
                                                            Export
                                                            <ChevronDown size={12} />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="start">
                                                        <DropdownMenuItem className="!text-xs !font-semibold" onSelect={() => exportActiveTable("json")}>JSON</DropdownMenuItem>
                                                        <DropdownMenuItem className="!text-xs !font-semibold" onSelect={() => exportActiveTable("csv")}>CSV</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                                {renderTableFilters()}
                                                {renderTableGrouping()}
                                                {renderColumnSelector()}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {(() => {
                                                    const rowCount = activeTab.data?.data?.length || 0;
                                                    const pageSize = activeTab.resultPageSize || 50;
                                                    const pageIndex = activeTab.resultPageIndex || 0;
                                                    const totalPages = Math.ceil(rowCount / pageSize);
                                                    return <>
                                                        {rowCount > 0 && <>
                                                        <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500">Page {pageIndex + 1} of {totalPages}</span>
                                                        <Select
                                                            value={String(pageSize)}
                                                            onValueChange={(value) => changeSqlResultPage(0, Number(value))}
                                                            disabled={modifiedRowsCount > 0 || selectedRowsCount > 0}
                                                        >
                                                            <SelectTrigger aria-label="Rows per page" className="h-6 w-[92px] border-0 bg-white px-2 py-0 text-xs font-semibold text-zinc-900 shadow-none ring-1 ring-zinc-300 focus:ring-1 focus:ring-zinc-400 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-700 dark:focus:ring-zinc-500 [&>span]:text-xs [&>span]:font-semibold [&>svg]:h-3 [&>svg]:w-3">
                                                                <SelectValue className="text-xs font-semibold" />
                                                            </SelectTrigger>
                                                            <SelectContent align="end" className="min-w-[92px] text-xs font-semibold">
                                                                {[10, 25, 50, 100].map((size) => <SelectItem key={size} value={String(size)} className="py-1.5 text-xs font-semibold">{size} rows</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                        <Button onClick={() => changeSqlResultPage(0)} disabled={pageIndex === 0 || modifiedRowsCount > 0 || selectedRowsCount > 0} aria-label="First page" title="First page" className="h-6 w-6 border-0 bg-white p-1 text-black shadow-none ring-1 ring-zinc-300 hover:bg-zinc-100 disabled:opacity-50 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-900"><ChevronsLeft size={14} /></Button>
                                                        <Button onClick={() => changeSqlResultPage(pageIndex - 1)} disabled={pageIndex === 0 || modifiedRowsCount > 0 || selectedRowsCount > 0} className="h-6 border-0 bg-white p-1 px-2 text-black shadow-none ring-1 ring-zinc-300 hover:bg-zinc-100 disabled:opacity-50 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-900 !text-xs !font-semibold">Previous</Button>
                                                        <Button onClick={() => changeSqlResultPage(pageIndex + 1)} disabled={pageIndex + 1 >= totalPages || modifiedRowsCount > 0 || selectedRowsCount > 0} className="h-6 border-0 bg-white p-1 px-2 text-black shadow-none ring-1 ring-zinc-300 hover:bg-zinc-100 disabled:opacity-50 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-900 !text-xs !font-semibold">Next</Button>
                                                        <Button onClick={() => changeSqlResultPage(totalPages - 1)} disabled={pageIndex >= totalPages - 1 || modifiedRowsCount > 0 || selectedRowsCount > 0} aria-label="Last page" title="Last page" className="h-6 w-6 border-0 bg-white p-1 text-black shadow-none ring-1 ring-zinc-300 hover:bg-zinc-100 disabled:opacity-50 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-900"><ChevronsRight size={14} /></Button>
                                                        </>}
                                                </>;
                                                })()}
                                                <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500">
                                                    {activeTab.data?.affectedRows !== undefined
                                                        ? `${activeTab.data.affectedRows} ${activeTab.data.affectedRows === 1 ? "row" : "rows"} affected`
                                                        : `${activeTab.data?.count}${activeTab.data?.count === 1 ? " row" : " rows"}`}
                                                </p>
                                                {activeTab.data?.truncated && (
                                                    <div className="flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                                                        <span>First 1,000 rows shown</span>
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <button type="button" aria-label="Why are only 1,000 rows shown?" className="rounded-full p-0.5 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500 dark:hover:bg-amber-950">
                                                                        <Info size={12} />
                                                                    </button>
                                                                </TooltipTrigger>
                                                                <TooltipContent side="top" className="max-w-[280px] text-xs font-semibold leading-4">
                                                                    SQL results and their exports are capped at 1,000 rows to keep queries responsive. Open a table from the database navigation to browse all its rows in pages.
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    }
                                    <QueryResultsTable
                                        response={sqlResultPageData}
                                        tableName={canEditQueryResults ? querySourceTable : activeTab.name}
                                        schema={canEditQueryResults ? querySourceSchema : []}
                                        databaseId={database?.db_id}
                                        sensitiveColumns={database?.preferences?.sensitiveColumns || activeTab.sensitiveColumns || []}
                                        primaryKeyField={canEditQueryResults && querySourcePrimaryKeys.length === 1 ? querySourcePrimaryKeys[0].field : undefined}
                                        canSave={canEditQueryResults}
                                        editable={canEditQueryResults}
                                        showSelection={/^\s*(SELECT|WITH)\b/i.test(executedSqlQuery)}
                                        columnVisibility={activeColumnVisibility}
                                        filterRules={activeFilterRules}
                                        grouping={activeGrouping}
                                        insertRowRequest={insertRowRequest}
                                        onInsertRowRequestHandled={() => setInsertRowRequest(0)}
                                        openSheet={isSheetOpen}
                                        onOpenChange={setIsSheetOpen}
                                        onChangesCountChange={setModifiedRowsCount}
                                    />
                                </div>
                            )}
                        </div>
                    ) : null
                ) : (
                    <div className="h-[calc(100vh-54px)] flex items-center justify-center">
                        <p className="text-xs font-semibold">
                            Select a table to view its data
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

const mapStateToProps = (state) => ({
    queryTabs: state.queryTabs,
    database: state.database,
    databases: state.databases,
    query: state.query,
    tables: state.tables,
});

const mapDispatchToProps = {
    setDatabase,
    setQuery,
    setQueryResults,
    setQueryTabs,
    setTables,
};

export default connect(mapStateToProps, mapDispatchToProps)(PlaygroundPlayId);
