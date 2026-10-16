import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { connect } from "react-redux";
import axios from "axios";
import LeftBar from "@/components/navigationBar/leftBar";
import QueryResultsTable from "@/components/queryResults/table";
import TableFilters from "@/components/queryResults/table/filters";
import TableGrouping from "@/components/queryResults/table/grouping";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ChevronDown, ChevronsLeft, ChevronsRight, Download, History } from "lucide-react";
import { setQueryTabs } from "@/redux/actions/main";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ShowNavigationButton, useNavigationVisibility } from "@/components/navigationBar/navigationVisibility";

const ACTIVITY_FILTER_COLUMNS = Object.freeze(["Database", "Action", "Query", "Table", "Status", "Error code"]);
const ACTIVITY_GROUP_COLUMNS = Object.freeze(["Date and time", "Database", "Action", "Query", "Table", "Rows", "Status", "Error code", "Finished at", "Duration"]);

function ActivityHistoryPage({ database, setQueryTabs }) {
    const router = useRouter();
    const { navigationHidden } = useNavigationVisibility();
    const databaseId = router.query.id;
    const [events, setEvents] = useState([]);
    const [activityFilter, setActivityFilter] = useState("all");
    const [activityFilterRules, setActivityFilterRules] = useState([]);
    const [activityGrouping, setActivityGrouping] = useState([]);
    const [pageIndex, setPageIndex] = useState(0);
    const [pageSize, setPageSize] = useState(50);
    const [totalCount, setTotalCount] = useState(0);
    const [countLoaded, setCountLoaded] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const hasLoadedRef = useRef(false);

    useEffect(() => {
        if (!router.isReady || typeof databaseId !== "string") return;
        let cancelled = false;
        setLoading(!hasLoadedRef.current);
        setError("");
        axios.get(`/api/database/${encodeURIComponent(databaseId)}/audit`, {
            params: {
                limit: pageSize,
                offset: pageIndex * pageSize,
                category: activityFilter,
                ...(activityFilterRules.length ? { filters: JSON.stringify(activityFilterRules) } : {}),
            },
        })
            .then(({ data }) => {
                if (!cancelled) {
                    setHasMore(Boolean(data.hasMore));
                    setEvents((data.data || []).map((event) => ({
                        "Date and time": new Date(event.createdAt).toLocaleString(),
                        Database: event.database_name,
                        Action: event.action,
                        Query: event.query || "—",
                        Table: event.table_name || "—",
                        Rows: event.affected_rows ?? "—",
                        Status: event.status,
                        "Error code": event.error_code || "—",
                        "Finished at": event.status === "started" ? "—" : new Date(event.updatedAt).toLocaleString(),
                        Duration: event.status === "started"
                            ? "—"
                            : `${Math.max(0, new Date(event.updatedAt).getTime() - new Date(event.createdAt).getTime())} ms`,
                    })));
                    hasLoadedRef.current = true;
                }
            })
            .catch((requestError) => {
                if (!cancelled) setError(requestError.response?.data?.error || "Unable to load activity history.");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [router.isReady, databaseId, pageIndex, pageSize, activityFilter, activityFilterRules]);

    useEffect(() => {
        if (!router.isReady || typeof databaseId !== "string") return;
        let cancelled = false;
        setCountLoaded(false);
        axios.get(`/api/database/${encodeURIComponent(databaseId)}/audit`, {
            params: {
                countOnly: true,
                category: activityFilter,
                ...(activityFilterRules.length ? { filters: JSON.stringify(activityFilterRules) } : {}),
            },
        }).then(({ data }) => {
            if (!cancelled) {
                setTotalCount(data.count || 0);
                setCountLoaded(true);
            }
        }).catch(() => {
            // The rows remain usable if the optional exact count fails.
        });
        return () => { cancelled = true; };
    }, [router.isReady, databaseId, activityFilter, activityFilterRules]);

    const openTable = (tab) => {
        setQueryTabs([tab]);
        router.push(`/app/playground/play/${encodeURIComponent(databaseId)}`);
    };

    const openSql = (sql) => {
        setQueryTabs([{ id: `sql-${Date.now()}`, name: "SQL", type: "sql", query: sql, data: { data: [] }, count: 0 }]);
        router.push(`/app/playground/play/${encodeURIComponent(databaseId)}`);
    };

    const exportActivity = (format) => {
        if (events.length === 0) return;
        const columns = [...new Set(events.flatMap((event) => Object.keys(event)))];
        const escapeCsv = (value) => {
            const text = value == null ? "" : String(value);
            return `"${text.replace(/"/g, '""')}"`;
        };
        const contents = format === "json"
            ? JSON.stringify(events, null, 2)
            : [columns.map(escapeCsv).join(","), ...events.map((event) => columns.map((column) => escapeCsv(event[column])).join(","))].join("\r\n");
        const mimeType = format === "json" ? "application/json;charset=utf-8" : "text/csv;charset=utf-8";
        const url = URL.createObjectURL(new Blob([contents], { type: mimeType }));
        const link = document.createElement("a");
        link.href = url;
        link.download = `activity-history-${activityFilter}.${format}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
    };

    const filteredEvents = events;
    return (
        <>
            <LeftBar openTab={openTable} openSqlTab={openSql} />
            <main className={`${navigationHidden ? "ml-0" : "ml-[240px]"} min-h-screen transition-[margin] duration-200`}>
                <div className="sticky top-0 z-40 flex h-[53px] items-center justify-between border-b bg-zinc-50 px-4 dark:bg-zinc-950">
                    <div className="flex items-center gap-2">
                        <ShowNavigationButton />
                        <Button
                            onClick={() => router.push(`/app/playground/play/${encodeURIComponent(databaseId)}`)}
                            className="h-6 border-0 bg-white p-1 px-2 text-black shadow-none ring-1 ring-zinc-300 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-900 !text-xs !font-semibold"
                        >
                            <ArrowLeft size={12} className="mr-1" /> Back to database
                        </Button>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                        <History size={13} /> Activity history
                    </div>
                </div>
                <section className="px-0">
                    <div className="mt-3 mb-3 flex items-center justify-between px-4">
                        <div className="flex items-center gap-2">
                            <Tabs value={activityFilter} onValueChange={(value) => {
                                setPageIndex(0);
                                setActivityFilter(value);
                            }}>
                                <TabsList className="h-7 p-0.5">
                                    {[ ["all", "All"], ["system", "System"], ["user", "User"] ].map(([value, label]) => (
                                        <TabsTrigger
                                            key={value}
                                            value={value}
                                            className="h-6 px-2 py-0 !text-xs !font-semibold"
                                        >
                                            {label}
                                        </TabsTrigger>
                                    ))}
                                </TabsList>
                            </Tabs>
                            <TableFilters
                                columns={ACTIVITY_FILTER_COLUMNS}
                                rules={activityFilterRules}
                                onChange={(rules) => {
                                    setPageIndex(0);
                                    setActivityFilterRules(rules);
                                }}
                            />
                            <TableGrouping
                                columns={ACTIVITY_GROUP_COLUMNS}
                                grouping={activityGrouping}
                                onChange={setActivityGrouping}
                            />
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button disabled={events.length === 0 || loading} className="flex h-6 items-center gap-1 border-0 bg-white p-1 px-2 text-black shadow-none ring-0 hover:bg-zinc-100 disabled:opacity-50 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900 !text-xs !font-semibold">
                                        <Download size={12} /> Export <ChevronDown size={12} />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                    <DropdownMenuItem className="!text-xs !font-semibold" onSelect={() => exportActivity("json")}>JSON</DropdownMenuItem>
                                    <DropdownMenuItem className="!text-xs !font-semibold" onSelect={() => exportActivity("csv")}>CSV</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                        <div className="flex items-center gap-3">
                            {(totalCount > 0 || events.length > 0) && (() => {
                                const totalPages = Math.ceil(totalCount / pageSize);
                                return (
                                    <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400 dark:text-zinc-500">
                                        <span>{countLoaded ? `Page ${pageIndex + 1} of ${totalPages}` : `Page ${pageIndex + 1}`}</span>
                                        <Select
                                            value={String(pageSize)}
                                            onValueChange={(value) => {
                                                setPageIndex(0);
                                                setPageSize(Number(value));
                                            }}
                                        >
                                            <SelectTrigger aria-label="Rows per page" className="h-6 w-[92px] border-0 bg-white px-2 py-0 text-xs font-semibold text-zinc-900 shadow-none ring-1 ring-zinc-300 focus:ring-1 focus:ring-zinc-400 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-700 dark:focus:ring-zinc-500 [&>span]:text-xs [&>span]:font-semibold [&>svg]:h-3 [&>svg]:w-3">
                                                <SelectValue className="text-xs font-semibold" />
                                            </SelectTrigger>
                                            <SelectContent align="end" className="min-w-[92px] text-xs font-semibold">
                                                {[10, 25, 50, 100].map((size) => <SelectItem key={size} value={String(size)} className="py-1.5 text-xs font-semibold">{size} rows</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <Button
                                            onClick={() => setPageIndex(0)}
                                            disabled={pageIndex === 0 || loading}
                                            aria-label="First page"
                                            title="First page"
                                            className="h-6 w-6 border-0 bg-white p-1 text-black shadow-none ring-1 ring-zinc-300 hover:bg-zinc-100 disabled:opacity-50 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-900"
                                        ><ChevronsLeft size={14} /></Button>
                                        <Button
                                            onClick={() => setPageIndex((page) => Math.max(0, page - 1))}
                                            disabled={pageIndex === 0 || loading}
                                            className="h-6 border-0 bg-white p-1 px-2 text-black shadow-none ring-1 ring-zinc-300 hover:bg-zinc-100 disabled:opacity-50 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-900 !text-xs !font-semibold"
                                        >Previous</Button>
                                        <Button
                                            onClick={() => setPageIndex((page) => Math.min(totalPages - 1, page + 1))}
                                            disabled={(countLoaded ? pageIndex + 1 >= totalPages : !hasMore) || loading}
                                            className="h-6 border-0 bg-white p-1 px-2 text-black shadow-none ring-1 ring-zinc-300 hover:bg-zinc-100 disabled:opacity-50 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-900 !text-xs !font-semibold"
                                        >Next</Button>
                                        <Button
                                            onClick={() => setPageIndex(Math.max(0, totalPages - 1))}
                                            disabled={!countLoaded || totalPages === 0 || pageIndex >= totalPages - 1 || loading}
                                            aria-label="Last page"
                                            title="Last page"
                                            className="h-6 w-6 border-0 bg-white p-1 text-black shadow-none ring-1 ring-zinc-300 hover:bg-zinc-100 disabled:opacity-50 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-900"
                                        ><ChevronsRight size={14} /></Button>
                                    </div>
                                );
                            })()}
                            <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500">{database?.db_name || ""}</p>
                        </div>
                    </div>
                    {loading ? (
                        <p className="px-4 text-xs font-semibold text-zinc-500">Loading activity...</p>
                    ) : error ? (
                        <p role="alert" className="px-4 text-xs font-semibold text-red-600 dark:text-red-400">{error}</p>
                    ) : filteredEvents.length === 0 ? (
                        <p className="px-4 text-xs font-semibold text-zinc-500">No activity recorded yet.</p>
                    ) : (
                        <div className="border-t border-zinc-200 dark:border-zinc-800">
                            <QueryResultsTable
                                response={filteredEvents}
                                databaseId={databaseId}
                                editable={false}
                                showSelection={false}
                                grouping={activityGrouping}
                            />
                        </div>
                    )}
                </section>
            </main>
        </>
    );
}

const mapStateToProps = (state) => ({ database: state.database });
export default connect(mapStateToProps, { setQueryTabs })(ActivityHistoryPage);
