import axios from "axios";
import {
    setDatabase,
    setDatabases,
    setProfile,
    setQuery,
    setQueryResults,
    setQueryTabs,
    setTables,
} from "@/redux/actions/main";
import { connect } from "react-redux";
import { useCallback, useEffect, useState } from "react";
import { useStore } from "react-redux";
import { EllipsisVertical, Table } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useRouter } from "next/router";
import {Skeleton} from "@/components/ui/skeleton";

function quoteSqlTable(name, dialect) {
    if (dialect === "postgres" || dialect === "sqlite") return `"${String(name).replace(/"/g, '""')}"`;
    if (dialect === "mssql") return "[" + String(name).replace(/]/g, "]]" ) + "]";
    return `\`${String(name).replace(/`/g, "``")}\``;
}

function TablesV2(props) {
    const {
        database,
        tables,
        setTables,
        setQueryResults,
        queryTabs,
        setQueryTabs,
        openTab,
        openSqlTab,
        activeTabName,   // 👈 qui arriva il nome della tab attiva
    } = props;

    const [loading, setLoading] = useState(false);
    const [openIndex, setOpenIndex] = useState(null);
    const store = useStore();
    const router = useRouter();

    const hasCurrentTables = tables?._databaseId === database?.db_id && Array.isArray(tables?.data);
    const fetchTables = useCallback(async () => {
        if (!database?.db_id) return;
        if (hasCurrentTables) {
            setLoading(false);
            return;
        }
        setLoading(true);
        axios
            .get(`/api/playground/db/table?db_id=${database?.db_id}`)
            .then((response) => {
                setTables({ ...response.data, _databaseId: database.db_id, _dialect: response.data.dialect });
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [database?.db_id, hasCurrentTables, setTables]);

    const fetchQuery = async (tableName) => {
        const table = tables?.data?.find((item) => item.tableName === tableName);
        const quotedTableName = quoteSqlTable(tableName, tables?._dialect);
        const primaryKeys = table?.details?.columns?.filter((column) => column.key === "PRI") || [];
        const primaryKeyField = primaryKeys.length === 1 ? primaryKeys[0].field : undefined;
        axios
            .get(`/api/playground/db/table/rows`, {
                params: { db_id: database?.db_id, table: tableName, page: 0 },
            })
            .then((res) => {
                const tab = {
                    id: database?.db_id,
                    name: tableName,
                    type: "table",
                    primaryKeyField,
                    schema: table?.details?.columns || [],
                    query: `SELECT * FROM ${quotedTableName}`,
                    data: { data: res.data.data, count: null },
                    count: null,
                    countPending: true,
                    hasNext: res.data.hasNext,
                    hasPrevious: res.data.hasPrevious,
                    cursorSupported: res.data.cursorSupported,
                    nextCursor: res.data.nextCursor,
                    previousCursor: res.data.previousCursor,
                    requestCursor: null,
                    requestDirection: "next",
                    pageIndex: res.data.page,
                    pageSize: res.data.pageSize,
                    sensitiveColumns: res.data.sensitiveColumns || [],
                    serverPaginated: true,
                    filterSignature: "[]",
                };

                if (typeof openTab === "function") {
                    openTab(tab);
                } else {
                    const current = queryTabs || [];
                    setQueryTabs([...current, tab]);
                }

                setQueryResults(res.data.data);

                // Load the exact total after the first rows are already visible.
                axios.get("/api/playground/db/table/rows", {
                    params: { db_id: database?.db_id, table: tableName, count_only: "true", pageSize: res.data.pageSize },
                }).then((countResponse) => {
                    const currentTabs = store.getState().queryTabs || [];
                    setQueryTabs(currentTabs.map((currentTab) =>
                        currentTab.type === "table" && currentTab.id === database?.db_id && currentTab.name === tableName && (currentTab.filterSignature || "[]") === "[]"
                            ? {
                                ...currentTab,
                                data: { ...currentTab.data, count: countResponse.data.count },
                                count: countResponse.data.count,
                                countPending: false,
                                countError: false,
                            }
                            : currentTab
                    ));
                }).catch(() => {
                    const currentTabs = store.getState().queryTabs || [];
                    setQueryTabs(currentTabs.map((currentTab) =>
                        currentTab.type === "table" && currentTab.id === database?.db_id && currentTab.name === tableName
                            ? { ...currentTab, countPending: false, countError: true }
                            : currentTab
                    ));
                });
            })
            .catch((error) => {
                console.error("Unable to load table", error);
            });
    };

    useEffect(() => {
        fetchTables();
    }, [fetchTables]);

    if (loading) {
        return <>
            <div className="flex flex-col items-center gap-3 pt-4 px-6 w-full">
                <div className="flex items-center gap-3 w-full">
                    <Skeleton className="h-4 w-4 rounded-sm" />
                    <Skeleton className="h-4 rounded-sm w-full" />
                </div>
                <div className="flex items-center gap-3 w-full">
                    <Skeleton className="h-4 w-4 rounded-sm" />
                    <Skeleton className="h-4 rounded-sm w-full" />
                </div>
                <div className="flex items-center gap-3 w-full">
                    <Skeleton className="h-4 w-4 rounded-sm" />
                    <Skeleton className="h-4 rounded-sm w-full" />
                </div>
                <div className="flex items-center gap-3 w-full">
                    <Skeleton className="h-4 w-4 rounded-sm" />
                    <Skeleton className="h-4 rounded-sm w-full" />
                </div>
                <div className="flex items-center gap-3 w-full">
                    <Skeleton className="h-4 w-4 rounded-sm" />
                    <Skeleton className="h-4 rounded-sm w-full" />
                </div>
                <div className="flex items-center gap-3 w-full">
                    <Skeleton className="h-4 w-4 rounded-sm" />
                    <Skeleton className="h-4 rounded-sm w-full" />
                </div>
            </div>
        </>
    }

    return (
        <>
        <ul className="px-4 py-2 pt-0 flex flex-col gap-1 relative mt-1">
            {tables?.data?.map((data, index) => {
                const isOpen = openIndex === index;

                // 👇 attiva highlight se il nome coincide con la tab attiva
                const isActive =
                    activeTabName && activeTabName === data.tableName;

                return (
                    <div
                        key={index}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                            if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                                event.preventDefault();
                                router.push(`/app/playground/play/${database?.db_id}`);
                                fetchQuery(data.tableName);
                            }
                        }}
                        onClick={() => {
                            router.push(`/app/playground/play/${database?.db_id}`);
                            fetchQuery(data.tableName);
                        }}
                        className={cn(
                            "group flex flex-row items-center justify-between px-2.5 py-1 rounded-md text-xs font-semibold transition hover:cursor-pointer",
                            // stile hover base
                            "hover:bg-zinc-100 dark:hover:bg-zinc-900",
                            // menu aperto
                            isOpen &&
                            "bg-zinc-100 dark:bg-zinc-900",
                            // 🔥 tabella attiva evidenziata
                            isActive &&
                            "bg-blue-50 dark:!bg-blue-950/30 text-blue-700 dark:text-blue-200"
                        )}
                    >
                        <div className="flex flex-row items-center gap-3">
                            <Table size={12} />
                            <p className="!text-xs !font-semibold">{data.tableName}</p>
                        </div>
                        <div>
                            <DropdownMenu
                                open={isOpen}
                                onOpenChange={(open) => {
                                    setOpenIndex(open ? index : null);
                                }}
                            >
                                <DropdownMenuTrigger asChild>
                                    <button
                                        onClick={(event) => event.stopPropagation()}
                                        onPointerDown={(event) => event.stopPropagation()}
                                        className="relative opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 transition-opacity p-1 rounded-md"
                                    >
                                        <EllipsisVertical size={12} />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="start"
                                    side="right"
                                    className="z-[10000] w-[200px] border border-neutral-200 dark:border-neutral-700"
                                >
                                    <DropdownMenuItem
                                        className="text-xs font-semibold hover:cursor-pointer"
                                        onClick={(event) => {
                                            event.stopPropagation()
                                            const quotedTableName = quoteSqlTable(data.tableName, tables?._dialect);
                                            const sql = `SELECT * FROM ${quotedTableName}`
                                            if (typeof openSqlTab === "function") openSqlTab(sql)
                                        }}
                                    >
                                        Run query in SQL editor
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        className="text-xs font-semibold hover:cursor-pointer"
                                        onClick={(event) => {
                                            event.stopPropagation()
                                            const sql = tables?._dialect === "postgres"
                                                ? `SELECT * FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = '${data.tableName.replace(/'/g, "''")}' ORDER BY ordinal_position`
                                                : tables?._dialect === "sqlite"
                                                    ? `PRAGMA table_info(${quoteSqlTable(data.tableName, "sqlite")})`
                                                    : tables?._dialect === "mssql"
                                                        ? `SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${data.tableName.replace(/'/g, "''")}' ORDER BY ORDINAL_POSITION`
                                                        : `DESCRIBE \`${data.tableName.replace(/`/g, "``")}\``
                                            if (typeof openSqlTab === "function") openSqlTab(sql, true)
                                        }}
                                    >
                                        Table schema info
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="text-xs font-semibold hover:cursor-pointer">
                                        Copy table schema
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                );
            })}
        </ul>
        </>
    );
}

const mapStateToProps = (state) => ({
    database: state.database,
    tables: state.tables,
    queryTabs: state.queryTabs,
});

const mapDispatchToProps = {
    setProfile,
    setDatabases,
    setDatabase,
    setQuery,
    setTables,
    setQueryResults,
    setQueryTabs,
};

export default connect(mapStateToProps, mapDispatchToProps)(TablesV2);
