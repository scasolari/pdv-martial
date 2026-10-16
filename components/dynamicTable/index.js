import React, { useMemo, useState, useReducer } from "react";
import {
    useReactTable,
    getCoreRowModel,
    getFilteredRowModel,
    flexRender,
} from "@tanstack/react-table";
import { Input } from "@/components/ui/input";

function DynamicTable({ response }) {
    const rawData = response;

    const data = useMemo(() => {
        if (!rawData) return [];
        return Array.isArray(rawData) ? rawData : [rawData];
    }, [rawData]);

    const columns = useMemo(() => {
        if (!data.length) return [];

        const sample = data[0];
        if (typeof sample === "object" && sample !== null) {
            return Object.keys(sample).map((key) => ({
                accessorKey: key,
                header: key,
                enableResizing: true,
            }));
        }
        return [];
    }, [data]);

    const [globalFilter, setGlobalFilter] = useState("");
    const [columnResizeMode, setColumnResizeMode] = useState("onChange");
    const [columnResizeDirection, setColumnResizeDirection] = useState("ltr");

    const rerender = useReducer(() => ({}), {})[1];

    const table = useReactTable({
        data,
        columns,
        state: {
            globalFilter,
        },
        onGlobalFilterChange: setGlobalFilter,
        globalFilterFn: (row, columnId, filterValue) => {
            const value = row.getValue(columnId);
            return String(value ?? "").toLowerCase().includes(filterValue.toLowerCase());
        },
        columnResizeMode,
        columnResizeDirection,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
    });

    return (
        <div className="relative overflow-auto">

            {data.length === 0
                ? null
                : <div className="sticky top-0 left-0 z-20">
                    <Input
                        type="text"
                        placeholder="Search..."
                        value={globalFilter}
                        onChange={(e) => setGlobalFilter(e.target.value)}
                        className="shadow-none border-0 focus-visible:ring-0 !font-semibold !text-xs border-b border-b-neutral-100 dark:border-b-neutral-800  rounded-none"
                    />
                </div>
            }
            <div className="overflow-x-auto" style={{ direction: columnResizeDirection }}>
                <table
                    style={{ width: table.getCenterTotalSize() }}
                    className="min-w-full !mt-0"
                >
                    <thead className="sticky top-0 z-10 bg-neutral-50 dark:bg-neutral-900">
                    {table.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id}>
                            {headerGroup.headers.map((header) => (
                                <th
                                    key={header.id}
                                    colSpan={header.colSpan}
                                    style={{ width: header.getSize(), position: "relative" }}
                                    className="text-left text-sm font-semibold px-4 py-2 border-b border-neutral-100 dark:border-neutral-800 whitespace-nowrap"
                                >
                                    {header.isPlaceholder
                                        ? null
                                        : flexRender(header.column.columnDef.header, header.getContext())}
                                    {header.column.getCanResize() && (
                                        <div
                                            onDoubleClick={() => header.column.resetSize()}
                                            onMouseDown={header.getResizeHandler()}
                                            onTouchStart={header.getResizeHandler()}
                                            className={`bg-neutral-100 hover:bg-blue-600 dark:bg-neutral-800 hover:dark:bg-blue-700 ${columnResizeDirection} ${
                                                header.column.getIsResizing() ? "isResizing" : ""
                                            }`}
                                            style={{
                                                position: "absolute",
                                                right: 0,
                                                top: 0,
                                                height: "100%",
                                                width: "2px",
                                                cursor: "col-resize",
                                                zIndex: 1,
                                                userSelect: "none",
                                                transform:
                                                    columnResizeMode === "onEnd" &&
                                                    header.column.getIsResizing()
                                                        ? `translateX(${
                                                            (columnResizeDirection === "rtl" ? -1 : 1) *
                                                            (table.getState().columnSizingInfo.deltaOffset ?? 0)
                                                        }px)`
                                                        : "",
                                            }}
                                        />
                                    )}
                                </th>
                            ))}
                        </tr>
                    ))}
                    </thead>
                    <tbody className="bg-white dark:bg-neutral-950">
                    {table.getRowModel().rows.map((row) => (
                        <tr key={row.id} className="hover:bg-neutral-50 hover:dark:bg-neutral-900">
                            {row.getVisibleCells().map((cell) => (
                                <td
                                    key={cell.id}
                                    style={{ width: cell.column.getSize() }}
                                    className="px-4 py-2 text-sm font-semibold dark:text-neutral-100 border-b border-b-neutral-100 dark:border-b-neutral-800 whitespace-nowrap truncate overflow-hidden text-ellipsis max-w-[200px]"
                                >
                                    {flexRender(cell.column.columnDef.cell || cell.getValue, cell.getContext())}
                                </td>
                            ))}
                        </tr>
                    ))}
                    {table.getRowModel().rows.length === 0 && (
                        <tr>
                            <td
                                colSpan={columns.length || 1}
                                className="py-6 text-center text-sm font-semibold text-neutral-500 dark:text-neutral-400"
                            >
                                No data available
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default DynamicTable;
