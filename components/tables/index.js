import React, { useEffect, useState, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import axios from "axios";
import { CgSpinnerAlt } from "react-icons/cg";
import { IoIosArrowForward } from "react-icons/io";
import { BiPlus, BiMinus } from "react-icons/bi";
import { setQuery, setTables } from "@/redux/actions/main";
import { Button } from "@/components/ui/button";
import { RiCollapseVerticalLine, RiExpandVerticalLine } from "react-icons/ri";
import { Input } from "@/components/ui/input";
import {Separator} from "@/components/ui/separator";

export default function DbTables() {
    const dispatch = useDispatch();
    const dbId = useSelector((state) => state.database.db_id);
    const tablesState = useSelector((state) => state.tables);
    const tables = Array.isArray(tablesState)
        ? tablesState
        : Array.isArray(tablesState?.data)
            ? tablesState.data
            : [];

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [expandedTables, setExpandedTables] = useState(new Set());
    const prevDbIdRef = useRef();

    const processApiResponse = (data) => {
        if (!Array.isArray(data)) return [];

        const processed = data.map((item) => {
            const key = Object.keys(item).find(
                (k) => k.startsWith("Tables_in_") || k.toLowerCase().includes("table")
            ) || Object.keys(item)[0];

            return { tableName: item[key], originalObject: item };
        });

        setExpandedTables(new Set());
        return processed;
    };

    useEffect(() => {
        if (!dbId) return;

        if (prevDbIdRef.current == null && tables.length > 0) {
            prevDbIdRef.current = dbId;
            return;
        }

        if (prevDbIdRef.current === dbId) return;

        prevDbIdRef.current = dbId;
        setLoading(true);
        setError(null);

        axios
            .get(`/api/playground/db/table?db_id=${dbId}`)
            .then(({ data }) => {
                const list = processApiResponse(data.data);
                dispatch(setTables(list));
            })
            .catch((err) => {
                console.error("Error fetching tables:", err);
                setError("Errore nel caricamento delle tabelle");
            })
            .finally(() => setLoading(false));
    }, [dbId, dispatch, tables.length]);

    const toggleTable = (name, e) => {
        e.stopPropagation();
        setExpandedTables((prev) => {
            const next = new Set(prev);
            next.has(name) ? next.delete(name) : next.add(name);
            return next;
        });
    };

    const toggleAll = () => {
        const names = tables.map((t) => t.tableName);
        const allExpanded = names.every((n) => expandedTables.has(n));
        setExpandedTables(allExpanded ? new Set() : new Set(names));
    };

    const handleRowClick = (name) => {
        dispatch(setQuery(`SELECT * FROM \`${name}\``));
    };

    const allExpanded = tables.length > 0 && tables.every((t) => expandedTables.has(t.tableName));

    const filteredTables = tables.filter((t) =>
        t.tableName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex items-center gap-3">
                <CgSpinnerAlt size={18} className="animate-spin" />
                <p className="!text-sm font-semibold">Loading tables...</p>
            </div>
        );
    }

    if (error) {
        return <div className="text-red-500">{error}</div>;
    }

    return (
        <>
            {tables.length === 0 ? (
                <p className="w-full text-center text-sm text-neutral-500 font-semibold py-2">
                    No dataset selected
                </p>
            ) : (
                <div className="flex gap-2 mb-2">
                    <Button
                        disabled={!tables.length}
                        onClick={toggleAll}
                        variant="outline"
                        size="sm"
                        className="shadow-none rounded-lg h-9 w-fit border-0 !font-semibold bg-neutral-100 hover:bg-neutral-200/70 dark:bg-neutral-800 dark:hover:bg-neutral-700"
                    >
                        {allExpanded ? <RiCollapseVerticalLine /> : <RiExpandVerticalLine />}
                    </Button>
                    <Input
                        placeholder="Search table..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="!text-xs shadow-none rounded-lg !font-semibold h-9 !ring-0 border-0 bg-neutral-100 hover:bg-neutral-200/70 dark:bg-neutral-800 dark:hover:bg-neutral-700"
                    />
                </div>
            )}

            <ul className="flex flex-col gap-1">
                {filteredTables.map((table, idx) => {
                    const isExpanded = expandedTables.has(table.tableName);
                    const cols = table.originalObject?.details?.columns || table.details?.columns;

                    return (
                        <li
                            key={table.tableName || idx}
                            onClick={() => handleRowClick(table.tableName)}
                            className={`p-2 py-1 !text-sm rounded-lg cursor-pointer transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                                isExpanded ? "" : ""
                            }`}
                        >
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    {cols && (
                                        <button
                                            onClick={(e) => toggleTable(table.tableName, e)}
                                            className="hover:bg-neutral-200/70 dark:hover:bg-neutral-600 p-1 rounded transition-colors"
                                        >
                                            {isExpanded ? (
                                                <BiMinus size={14} className="dark:text-neutral-300" />
                                            ) : (
                                                <BiPlus size={14} className="dark:text-neutral-300" />
                                            )}
                                        </button>
                                    )}
                                    <p className="font-semibold truncate text-primary">{table.tableName}</p>
                                </div>
                                <IoIosArrowForward size={14} className="text-neutral-500" />
                            </div>

                            {isExpanded && cols && (
                                <div className="mt-3 ml-2 pl-4 border-l border-neutral-200 !text-sm">
                                    <div className="flex flex-col gap-2">
                                        {cols.map((col, cidx) => (
                                            <div
                                                key={col.field + cidx}
                                                className="flex items-center justify-between text-sm"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="font-mono font-semibold text-primary !text-sm truncate">
                                                        {col.field}
                                                    </span>
                                                    {col.key === "PRI" && (
                                                        <span className="bg-yellow-100 text-yellow-800 px-1 py-0.5 rounded text-xs">
                                                            PK
                                                        </span>
                                                    )}
                                                    {col.null === "NO" && (
                                                        <span className="text-red-500 text-xs">*</span>
                                                    )}
                                                </div>
                                                <span className="text-neutral-500 text-xs font-mono font-semibold">
                                                    {col.type}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
        </>
    );
}
