import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import axios from "axios";
import { ChevronDown, Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/base-toast";

function DatabasePreferences({ databaseId, database, setDatabase }) {
    const storedPreferences = useSelector((state) => state.database.db_id === databaseId ? state.database.preferences : null);
    const preferences = storedPreferences || { pageSize: 50, sensitiveColumns: [] };
    const [columns, setColumns] = useState([]);
    const [schemaError, setSchemaError] = useState("");
    const [columnSearch, setColumnSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const preferencesRef = useRef(preferences);
    const databaseRef = useRef(databaseId);
    const databaseStateRef = useRef(database);
    databaseRef.current = databaseId;
    databaseStateRef.current = database;
    preferencesRef.current = preferences;

    useEffect(() => {
        let cancelled = false;
        if (!databaseId) {
            setColumns([]);
            return () => { cancelled = true; };
        }
        setLoading(true);
        setSchemaError("");
        Promise.allSettled([
            axios.get(`/api/database/${encodeURIComponent(databaseId)}/preferences`),
            axios.get(`/api/playground/db/table?db_id=${encodeURIComponent(databaseId)}`),
        ]).then(([preferencesResult, schemaResult]) => {
            if (cancelled || databaseRef.current !== databaseId) return;
            if (preferencesResult.status === "fulfilled") {
                const nextPreferences = preferencesResult.value.data;
                preferencesRef.current = nextPreferences;
                setDatabase({ ...databaseStateRef.current, db_id: databaseId, preferences: nextPreferences });
            } else {
                toast.add({ title: "Unable to load database preferences", description: preferencesResult.reason.response?.data?.error || "Unable to load database preferences.", type: "error" });
            }
            if (schemaResult.status === "fulfilled") {
                const tableList = Array.isArray(schemaResult.value.data?.data) ? schemaResult.value.data.data : [];
                setColumns([...new Set(tableList.flatMap((table) =>
                    (table.details?.columns || []).map((column) => column.field).filter(Boolean)
                ))].sort((a, b) => a.localeCompare(b)));
            } else {
                setColumns([]);
                setSchemaError(schemaResult.reason.response?.data?.error || schemaResult.reason.response?.data?.message || "Unable to load database schema.");
            }
        }).finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [databaseId, setDatabase]);

    const updatePreferences = (updates) => {
        if (!databaseId) return;
        const previous = preferencesRef.current;
        const next = { ...previous, ...updates };
        preferencesRef.current = next;
        setDatabase({ ...databaseStateRef.current, db_id: databaseId, preferences: next });
        axios.patch(`/api/database/${encodeURIComponent(databaseId)}/preferences`, next)
            .then(({ data }) => {
                if (databaseRef.current !== databaseId) return;
                preferencesRef.current = data;
                setDatabase({ ...databaseStateRef.current, db_id: databaseId, preferences: data });
            })
            .catch((error) => {
                if (databaseRef.current !== databaseId) return;
                preferencesRef.current = previous;
                setDatabase({ ...databaseStateRef.current, db_id: databaseId, preferences: previous });
                toast.add({ title: "Unable to save database preferences", description: error.response?.data?.error || "Unable to save database preferences.", type: "error" });
            });
    };

    const filteredColumns = columns.filter((column) => column.toLowerCase().includes(columnSearch.trim().toLowerCase()));

    return (
        <section className="space-y-4 text-left">
            <div className="space-y-1">
                <h2 className="text-sm font-semibold">Data preferences</h2>
                <p className="text-xs font-semibold text-muted-foreground">Configure how this database is displayed and how sensitive columns are handled.</p>
            </div>
            <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                    <p className="text-xs font-semibold">Rows per page</p>
                    <p className="text-xs font-semibold text-muted-foreground">Default size when opening a table.</p>
                </div>
                <Select disabled={loading || !databaseId} value={String(preferences.pageSize)} onValueChange={(value) => updatePreferences({ pageSize: Number(value) })}>
                    <SelectTrigger className="h-7 w-[100px] text-xs font-semibold [&>span]:text-xs [&>span]:font-semibold"><SelectValue /></SelectTrigger>
                    <SelectContent align="end">
                        {[10, 25, 50, 100].map((size) => <SelectItem key={size} value={String(size)} className="text-xs font-semibold">{size} rows</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 space-y-1">
                    <p className="text-xs font-semibold">Sensitive columns</p>
                    <p className="text-xs font-semibold text-muted-foreground">Selected columns are masked in table views and exports.</p>
                </div>
                {columns.length ? (
                    <DropdownMenu onOpenChange={(isOpen) => { if (!isOpen) setColumnSearch(""); }}>
                        <DropdownMenuTrigger asChild>
                            <Button type="button" variant="outline" disabled={loading || !databaseId} className="flex h-7 w-[260px] items-center justify-between gap-2 px-2 !text-xs !font-semibold">
                                <span className="truncate">{preferences.sensitiveColumns.length ? `${preferences.sensitiveColumns.length} columns selected` : "Select columns"}</span>
                                <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[320px] p-1">
                            <div className="relative p-1">
                                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <Input value={columnSearch} onChange={(event) => setColumnSearch(event.target.value)} onKeyDown={(event) => event.stopPropagation()} placeholder="Search columns..." aria-label="Search sensitive columns" className="h-7 rounded-md pl-7 pr-2 !text-xs !font-semibold" />
                            </div>
                            <div className="max-h-56 overflow-y-auto">
                                {filteredColumns.length ? filteredColumns.map((column) => (
                                    <DropdownMenuCheckboxItem key={column} checked={preferences.sensitiveColumns.includes(column)} onCheckedChange={(checked) => updatePreferences({
                                        sensitiveColumns: checked ? [...new Set([...preferences.sensitiveColumns, column])] : preferences.sensitiveColumns.filter((item) => item !== column),
                                    })} onSelect={(event) => event.preventDefault()} className="!py-1.5 !font-mono !text-xs !font-semibold">
                                        {column}
                                    </DropdownMenuCheckboxItem>
                                )) : <p className="px-2 py-4 text-center text-xs font-semibold text-muted-foreground">No columns match.</p>}
                            </div>
                            <DropdownMenuSeparator />
                            <p className="px-2 py-1 text-right text-xs font-semibold text-muted-foreground">{preferences.sensitiveColumns.length} selected</p>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : <p className="shrink-0 text-xs font-semibold text-muted-foreground">{loading ? "Loading database schema..." : schemaError || "No columns found in this database schema."}</p>}
            </div>
        </section>
    );
}

export default DatabasePreferences;
