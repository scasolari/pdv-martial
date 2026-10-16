import React, {Profiler, useMemo, useState, useCallback, useEffect, useRef} from 'react'
import {
    flexRender,
    getCoreRowModel,
    getExpandedRowModel,
    getFilteredRowModel,
    getGroupedRowModel,
    getSortedRowModel,
    useReactTable,
} from '@tanstack/react-table'
import { connect } from 'react-redux'
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import {Button} from "@/components/ui/button";
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

const cellInputClassName = 'disabled:opacity-100 disabled:cursor-text p-2 px-3 rounded-none h-fit !border-0 !shadow-none !font-semibold !text-xs focus-visible:ring-blue-500 focus-visible:bg-blue-50 focus-visible:dark:bg-blue-950/20'
const CELL_EDIT_EVENT = 'database-table:edit-cell'
const EMPTY_FILTER_RULES = Object.freeze([])
const EMPTY_GROUPING = Object.freeze([])
const EMPTY_SCHEMA = Object.freeze([])
const EMPTY_COLUMN_VISIBILITY = Object.freeze({})
const TABLE_DEFAULT_COLUMN = Object.freeze({
    minSize: 60,
    maxSize: 800,
    size: 250,
    filterFn: (row, _columnId, filters) => {
        if (row.original?.__insertDraft) return true
        const activeRules = Array.isArray(filters) ? filters : [filters]
        const matchesRule = (rule) => {
            const rawValue = row.original?.[rule.column]
            const value = rawValue == null ? '' : typeof rawValue === 'object' ? JSON.stringify(rawValue) : String(rawValue)
            const normalized = value.toLowerCase()
            const target = String(rule.value ?? '').toLowerCase()
            switch (rule.operator) {
                case 'equals': return normalized === target
                case 'notEquals': return normalized !== target
                case 'startsWith': return normalized.startsWith(target)
                case 'endsWith': return normalized.endsWith(target)
                case 'isEmpty': return value.trim() === ''
                case 'isNotEmpty': return value.trim() !== ''
                case 'contains':
                default: return normalized.includes(target)
            }
        }
        const groups = [[]]
        activeRules.forEach((rule, index) => {
            if (index > 0 && rule.conjunction === 'or') groups.push([])
            groups[groups.length - 1].push(rule)
        })
        return groups.some((group) => group.every(matchesRule))
    },
})

const EditableTableCell = React.memo(function EditableTableCell({ row, colId, value, editable, isDirtyCell, isPinnedLeft, editorId, onStartEdit, onInlineBlur }) {
    const [draft, setDraft] = useState(String(value ?? ''))

    useEffect(() => {
        setDraft(String(value ?? ''))
    }, [value])

    return (
        <Input
            value={editable ? draft : value}
            readOnly={!editable}
            onChange={editable ? (event) => setDraft(event.target.value) : undefined}
            onBlur={editable ? (event) => onInlineBlur(row, colId, event.currentTarget.value) : undefined}
            onDoubleClick={(event) => editable && onStartEdit(editorId, row, colId, event.currentTarget.value, event.currentTarget.getBoundingClientRect())}
            className={`${cellInputClassName} ${isPinnedLeft ? 'focus-visible:!ring-0 focus-visible:outline focus-visible:outline-1 focus-visible:!outline-blue-500 focus-visible:outline-offset-[-1px]' : ''} ${isDirtyCell ? 'focus-visible:!bg-orange-50 focus-visible:!ring-orange-400 dark:!bg-orange-950' : ''}`}
        />
    )
})

const CellEditorOverlay = React.memo(function CellEditorOverlay({ editorId, editable, onCommit }) {
    const [edit, setEdit] = useState(null)
    const [draft, setDraft] = useState('')
    const editorRef = useRef(null)
    const cancelEditRef = useRef(false)

    useEffect(() => {
        const handleEditRequest = (event) => {
            if (event.detail?.editorId !== editorId || !editable) return
            setDraft(String(event.detail.value ?? ''))
            setEdit(event.detail)
        }
        window.addEventListener(CELL_EDIT_EVENT, handleEditRequest)
        return () => window.removeEventListener(CELL_EDIT_EVENT, handleEditRequest)
    }, [editorId, editable])

    useEffect(() => {
        if (!edit || !editorRef.current) return
        const editor = editorRef.current
        editor.style.height = 'auto'
        editor.style.height = `${Math.max(editor.scrollHeight, 40)}px`
        editor.focus()
        editor.select()
    }, [edit])

    useEffect(() => {
        if (!editable) setEdit(null)
    }, [editable])

    const resizeEditor = (event) => {
        const editor = event.currentTarget
        editor.style.height = 'auto'
        editor.style.height = `${Math.max(editor.scrollHeight, 40)}px`
        setDraft(event.target.value)
    }

    if (!edit) return null

    return <textarea
        ref={editorRef}
        value={draft}
        onChange={resizeEditor}
        wrap="soft"
        onBlur={() => {
            if (cancelEditRef.current) {
                cancelEditRef.current = false
                return
            }
            onCommit(edit.row, edit.colId, draft)
            setEdit(null)
        }}
        onKeyDown={(event) => {
            if (event.key === 'Escape') {
                event.preventDefault()
                cancelEditRef.current = true
                setEdit(null)
            } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                editorRef.current?.blur()
            }
        }}
        style={{ position: 'fixed', left: edit.rect.left, top: edit.rect.top, width: '400px', zIndex: 99999, overflowWrap: 'anywhere' }}
        className="!box-border min-h-10 resize-none overflow-hidden whitespace-pre-wrap break-words rounded-none border-0 !px-3 !py-2 !text-xs !font-semibold !leading-normal text-zinc-800 outline-none ring-1 ring-blue-500 dark:bg-zinc-950 dark:text-zinc-100"
    />
})

function QueryResultsTable({ response, rowCount, queryTabs, tableName, schema = EMPTY_SCHEMA, databaseId, sensitiveColumns = [], primaryKeyField, canSave, editable = false, showSelection = false, openSheet, onOpenChange, onChangesCountChange, onSelectionCountChange, onSelectedRowsChange, insertRowRequest = 0, onInsertRowRequestHandled, deleteRowsRequest = 0, onDeleteRowsRequestHandled, onSaved, database, serverPaginated = false, pageIndex: initialPageIndex = 0, pageSize = 50, cursorSupported = false, requestCursor = null, requestDirection = "next", columnVisibility = EMPTY_COLUMN_VISIBILITY, filterRules = EMPTY_FILTER_RULES, grouping = EMPTY_GROUPING }) {
    const activeSensitiveColumns = database?.preferences?.sensitiveColumns || sensitiveColumns
    const rawData = response

    const data = useMemo(() => {
        if (!rawData) return []
        return Array.isArray(rawData) ? rawData : [rawData]
    }, [rawData])
    const [displayData, setDisplayData] = useState(data)
    const caseInsensitiveGroupingColumns = useMemo(() => new Set(
        (Array.isArray(grouping) ? grouping : EMPTY_GROUPING)
            .filter((group) => typeof group !== 'string' && group.mode === 'caseInsensitive')
            .map((group) => group.column)
            .filter(Boolean),
    ), [grouping])

    const columns = useMemo(() => {
        if (!data.length && !schema.length) return []

        const withGroupingValue = (field) => caseInsensitiveGroupingColumns.has(field)
            ? { getGroupingValue: (row) => {
                const value = row?.[field]
                return typeof value === 'string' ? value.toLowerCase() : value
            } }
            : {}

        if (schema.length) {
            return schema.map(({ field }) => ({
                accessorKey: field,
                header: field,
                enableResizing: true,
                ...withGroupingValue(field),
            }))
        }

        const sample = data[0]
        if (typeof sample === 'object' && sample !== null) {
            return Object.keys(sample).map((key) => ({
                accessorKey: key,
                header: key,
                enableResizing: true,
                ...withGroupingValue(key),
            }))
        }
        return []
    }, [caseInsensitiveGroupingColumns, data, schema])

    const [globalFilter, setGlobalFilter] = useState('')
    const [sorting, setSorting] = useState([])
    const groupingColumns = useMemo(() => (Array.isArray(grouping) ? grouping : EMPTY_GROUPING)
        .map((group) => typeof group === 'string' ? group : group.column)
        .filter(Boolean), [grouping])
    const effectiveSorting = useMemo(() => [
        ...(Array.isArray(grouping) ? grouping : EMPTY_GROUPING).map((group) => typeof group === 'string'
            ? { id: group, desc: false }
            : { id: group.column, desc: Boolean(group.desc) }),
        ...sorting.filter((sort) => !groupingColumns.includes(sort.id)),
    ], [grouping, groupingColumns, sorting])
    const columnFilters = useMemo(() => {
        // These rules are applied by the server for paginated table data. Reapplying them
        // locally would filter already-masked sensitive values a second time.
        if (serverPaginated) return []
        const activeRules = (Array.isArray(filterRules) ? filterRules : EMPTY_FILTER_RULES)
            .filter((rule) => rule && (['isEmpty', 'isNotEmpty'].includes(rule.operator) || String(rule.value ?? '').trim() !== ''))
        const filterColumn = columns[0]?.accessorKey
        return activeRules.length > 0 && filterColumn
            ? [{ id: filterColumn, value: activeRules }]
            : []
    }, [columns, filterRules, serverPaginated])
    const [expanded, setExpanded] = useState({})
    const [columnSizing, setColumnSizing] = useState({})
    const [columnResizeDirection] = useState('ltr')

    const firstAccessorKey = columns[0]?.accessorKey
    const pkField = primaryKeyField || firstAccessorKey
    const schemaByField = useMemo(() => new Map(schema.map((column) => [column.field, column])), [schema])

    const [editedCells, setEditedCells] = useState({})
    const [selectedRows, setSelectedRows] = useState({})
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [deletingRows, setDeletingRows] = useState(false)
    const [deleteError, setDeleteError] = useState('')
    const selectedRowsCount = Object.values(selectedRows).filter(Boolean).length
    const selectionColumnWidth = showSelection ? 36 : 0
    const [hasHorizontalScroll, setHasHorizontalScroll] = useState(false)
    const [currentPage, setCurrentPage] = useState(initialPageIndex)
    const [currentPageSize, setCurrentPageSize] = useState(pageSize)
    const editorIdRef = useRef(null)
    if (!editorIdRef.current) editorIdRef.current = `table-cell-editor-${Math.random().toString(36).slice(2)}`
    const suppressedInlineBlurRef = useRef(null)
    const lastInsertRowRequestRef = useRef(0)
    const activeColumnResizeRef = useRef(null)
    const tableElementRef = useRef(null)

    const applyColumnWidthPreview = (resize, width) => {
        const cells = resize.tableElement?.querySelectorAll('[data-column-id]') || []
        cells.forEach((cell) => {
            if (cell.dataset.columnId === resize.columnId) cell.style.width = `${width}px`
        })
    }

    useEffect(() => {
        const handlePointerMove = (event) => {
            const resize = activeColumnResizeRef.current
            if (!resize || event.pointerId !== resize.pointerId) return
            event.preventDefault()
            const direction = columnResizeDirection === 'rtl' ? -1 : 1
            resize.delta = (event.clientX - resize.startX) * direction
            resize.previewSize = Math.min(resize.maxSize, Math.max(resize.minSize, resize.startSize + resize.delta))
            applyColumnWidthPreview(resize, resize.previewSize)
        }

        const finishResize = (event) => {
            const resize = activeColumnResizeRef.current
            if (!resize || (event?.pointerId != null && event.pointerId !== resize.pointerId)) return
            resize.indicator.style.backgroundColor = ''
            document.body.style.cursor = resize.previousCursor
            document.body.style.userSelect = resize.previousUserSelect
            activeColumnResizeRef.current = null

            if (event?.type === 'pointercancel' || resize.delta === 0) {
                applyColumnWidthPreview(resize, resize.startSize)
                return
            }
            setColumnSizing((current) => ({ ...current, [resize.columnId]: resize.previewSize }))
        }

        window.addEventListener('pointermove', handlePointerMove, { passive: false })
        window.addEventListener('pointerup', finishResize)
        window.addEventListener('pointercancel', finishResize)
        return () => {
        window.removeEventListener('pointermove', handlePointerMove)
        window.removeEventListener('pointerup', finishResize)
        window.removeEventListener('pointercancel', finishResize)
        const resize = activeColumnResizeRef.current
        if (resize) {
            document.body.style.cursor = resize.previousCursor
            document.body.style.userSelect = resize.previousUserSelect
            activeColumnResizeRef.current = null
        }
    }
    }, [columnResizeDirection])

    const startColumnResize = (event, column, indicator) => {
        event.preventDefault()
        event.stopPropagation()
        const pointerId = event.pointerId
        activeColumnResizeRef.current = {
            pointerId,
            columnId: column.id,
            startX: event.clientX,
            startSize: column.getSize(),
            minSize: column.columnDef.minSize ?? TABLE_DEFAULT_COLUMN.minSize,
            maxSize: column.columnDef.maxSize ?? TABLE_DEFAULT_COLUMN.maxSize,
            delta: 0,
            previewSize: column.getSize(),
            indicator,
            tableElement: tableElementRef.current,
            previousCursor: document.body.style.cursor,
            previousUserSelect: document.body.style.userSelect,
        }
        indicator.style.backgroundColor = '#3b82f6'
        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'
    }

    const formatCellValue = (value) => {
        if (value === null || value === undefined) return ''
        if (typeof value === 'object') return JSON.stringify(value)
        return value
    }

    const getCellValue = useCallback((row, colId) => {
        const originalValue = row.original?.[colId]
        const diff = editedCells?.[row.id]?.changes?.[colId]
        const value = diff ? diff.after : originalValue
        return formatCellValue(value)
    }, [editedCells])

    const setCellValue = useCallback((row, colId, nextValue) => {
        setSaveSuccess('')
        const rowKey = row.id
        if (row.original?.__insertDraft) {
            setDisplayData((current) => current.map((item, index) => Number(rowKey) === index
                ? {
                    ...item,
                    [colId]: nextValue,
                    __insertDraftValues: { ...(item.__insertDraftValues || {}), [colId]: nextValue },
                }
                : item))
            return
        }
        const originalValue = row.original?.[colId]

        setEditedCells((prev) => {
            const currentChange = prev[rowKey]?.changes?.[colId]
            const currentValue = currentChange ? currentChange.after : originalValue
            if (String(nextValue ?? '') === String(currentValue ?? '')) return prev

            const next = { ...prev }
            const entry = next[rowKey] || { original: row.original, changes: {} }
            const rowChanges = { ...entry.changes }
            const backToOriginal = String(nextValue ?? '') === String(originalValue ?? '')

            if (backToOriginal) {
                delete rowChanges[colId]
            } else {
                rowChanges[colId] = { before: originalValue, after: nextValue }
            }

            if (Object.keys(rowChanges).length === 0) delete next[rowKey]
            else next[rowKey] = { original: entry.original, changes: rowChanges }
            return next
        })
    }, [])

    const startCellEdit = useCallback((editorId, row, colId, value, rect) => {
        suppressedInlineBlurRef.current = `${row.id}:${colId}`
        window.dispatchEvent(new CustomEvent(CELL_EDIT_EVENT, {
            detail: { editorId, row, colId, value, rect },
        }))
    }, [])

    const commitInlineCell = useCallback((row, colId, value) => {
        const key = `${row.id}:${colId}`
        if (suppressedInlineBlurRef.current === key) {
            suppressedInlineBlurRef.current = null
            return
        }
        setCellValue(row, colId, value)
    }, [setCellValue])

    const finishCellEdit = useCallback((row, colId, value) => {
        setCellValue(row, colId, value)
    }, [setCellValue])

    const insertRows = useMemo(() => displayData
        .filter((row) => row.__insertDraft)
        .map((row) => ({
            values: Object.fromEntries(Object.entries(row.__insertDraftValues || {}).map(([field, value]) => [
                field,
                value === '' && schemaByField.get(field)?.null ? null : value,
            ])),
        })), [displayData, schemaByField])

    const payload = useMemo(() => ({
        db_id: databaseId,
        table: tableName || queryTabs?.name,
        pkField,
        inserts: insertRows,
        rows: Object.entries(editedCells).map(([rowIndex, entry]) => ({
            rowIndex: Number(rowIndex),
            original: entry.original,
            changes: entry.changes,
        })),
        meta: {
            totalRows: data.length,
            modifiedRows: Object.keys(editedCells).length + insertRows.length,
        },
    }), [editedCells, insertRows, pkField, data.length, databaseId, tableName, queryTabs?.name])

    const hasChanges = Object.keys(editedCells).length > 0 || insertRows.length > 0
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState('')
    const [saveSuccess, setSaveSuccess] = useState('')

    useEffect(() => {
        setDisplayData(data)
        setEditedCells({})
        setSelectedRows({})
        setSaveError('')
        setSaveSuccess('')
    }, [data])

    useEffect(() => {
        setCurrentPage(initialPageIndex)
    }, [initialPageIndex])

    useEffect(() => {
        if (!showSelection) setSelectedRows({})
    }, [showSelection])

    useEffect(() => {
        if (insertRowRequest === 0) {
            lastInsertRowRequestRef.current = 0
            return
        }
        const newRowsCount = insertRowRequest - lastInsertRowRequestRef.current
        if (newRowsCount <= 0) return
        lastInsertRowRequestRef.current = insertRowRequest
        const fields = (data[0] ? Object.keys(data[0]) : schema.map((column) => column.field))
            .filter((field) => !field.startsWith('__insertDraft'))
        if (fields.length === 0) {
            onInsertRowRequestHandled?.()
            return
        }
        setDisplayData((current) => [
            ...current,
            ...Array.from({ length: newRowsCount }, (_, index) => ({
                ...Object.fromEntries(fields.map((field) => [field, ''])),
                __insertDraft: true,
                __insertDraftId: `${Date.now()}-${index}`,
            })),
        ])
        onInsertRowRequestHandled?.()
    }, [insertRowRequest, data, schema, onInsertRowRequestHandled])

    useEffect(() => {
        if (deleteRowsRequest <= 0) return
        setDeleteError('')
        setDeleteDialogOpen(true)
        onDeleteRowsRequestHandled?.()
    }, [deleteRowsRequest, onDeleteRowsRequestHandled])

    useEffect(() => {
        onChangesCountChange?.(payload.meta.modifiedRows)
    }, [payload.meta.modifiedRows, onChangesCountChange])

    useEffect(() => {
        const selectedIds = Object.entries(selectedRows).filter(([, selected]) => selected).map(([rowId]) => rowId)
        onSelectionCountChange?.(selectedIds.length)
        onSelectedRowsChange?.(selectedIds
            .map((rowId) => table.getCoreRowModel().rowsById[rowId]?.original)
            .filter(Boolean))
    }, [selectedRows, onSelectionCountChange, onSelectedRowsChange])

    useEffect(() => {
        setCurrentPage(initialPageIndex)
        setCurrentPageSize(pageSize)
    }, [initialPageIndex, pageSize])

    const fetchPageData = async (requestedPage = currentPage, requestedPageSize = currentPageSize) => {
        const params = new URLSearchParams({
            db_id: databaseId,
            table: tableName || queryTabs?.name || '',
            page: String(requestedPage),
            pageSize: String(requestedPageSize),
        })
        const activeRules = Array.isArray(filterRules)
            ? filterRules.filter((rule) => rule && (['isEmpty', 'isNotEmpty'].includes(rule.operator) || String(rule.value ?? '').trim() !== ''))
            : []
        if (activeRules.length) params.set('filters', JSON.stringify(activeRules))
        if (cursorSupported && requestCursor) {
            params.set('cursor', requestCursor)
            params.set('direction', requestDirection)
        }
        const response = await fetch(`/api/playground/db/table/rows?${params.toString()}`)
        const result = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(result.error || 'Unable to load table page.')

        const pageData = {
            data: result.data || [],
            count: result.count == null ? undefined : Number(result.count),
            pageIndex: Number(result.page || 0),
            pageSize: Number(result.pageSize || requestedPageSize),
            sensitiveColumns: result.sensitiveColumns || [],
            hasNext: result.hasNext,
            hasPrevious: result.hasPrevious,
            cursorSupported: result.cursorSupported,
            nextCursor: result.nextCursor,
            previousCursor: result.previousCursor,
            requestCursor: cursorSupported ? requestCursor : null,
            requestDirection,
        }
        setCurrentPage(pageData.pageIndex)
        return pageData
    }

    const handleDeleteSelectedRows = async () => {
        const selectedEntries = Object.entries(selectedRows).filter(([, selected]) => selected)
        if (!selectedEntries.length || !databaseId || !tableName) return
        setDeletingRows(true)
        setDeleteError('')
        try {
            const selectedIndexes = new Set(selectedEntries.map(([rowId]) => Number(rowId)))
            const persistedRows = selectedEntries
                .map(([rowId]) => displayData[Number(rowId)])
                .filter((row) => row && !row.__insertDraft)
            if (persistedRows.length) {
                const res = await fetch('/api/db/bulk-delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ db_id: databaseId, table: tableName || queryTabs?.name, rows: persistedRows }),
                })
                const result = await res.json().catch(() => ({}))
                if (!res.ok) throw new Error(result.error || 'Delete failed')
            }
            const remainingRows = displayData.filter((_, index) => !selectedIndexes.has(index))
            setDisplayData(remainingRows)
            setEditedCells((current) => Object.fromEntries(Object.entries(current).filter(([rowIndex]) => !selectedIndexes.has(Number(rowIndex)))))
            setSelectedRows({})
            setDeleteDialogOpen(false)
            try {
                if (serverPaginated) {
                    const updatedPage = await fetchPageData(currentPage)
                    setDisplayData(updatedPage.data)
                    onSaved?.({
                        data: updatedPage.data,
                        count: updatedPage.count,
                        pageIndex: updatedPage.pageIndex,
                        pageSize: updatedPage.pageSize,
                        hasNext: updatedPage.hasNext,
                        hasPrevious: updatedPage.hasPrevious,
                        cursorSupported: updatedPage.cursorSupported,
                        nextCursor: updatedPage.nextCursor,
                        previousCursor: updatedPage.previousCursor,
                        requestCursor: updatedPage.requestCursor,
                        requestDirection: updatedPage.requestDirection,
                    })
                } else {
                    const refreshed = await fetch('/api/playground/query', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            db_id: databaseId,
                            query: `SELECT * FROM \`${String(tableName).replace(/`/g, '``')}\``,
                        }),
                    })
                    if (refreshed.ok) {
                        const updatedResponse = await refreshed.json()
                        setDisplayData(updatedResponse.data || [])
                        onSaved?.(updatedResponse)
                    }
                }
            } catch (refreshError) {
                console.error('Deleted table refresh failed', refreshError)
            }
        } catch (error) {
            setDeleteError(error.message || 'Delete failed')
        } finally {
            setDeletingRows(false)
        }
    }

    const renderInsertCell = (row, field) => {
        const columnSchema = schemaByField.get(field)
        const extra = String(columnSchema?.extra || '').toLowerCase()
        const isGenerated = extra.includes('auto_increment') || extra.includes('generated')
        const hasNoDefault = columnSchema?.default === null || columnSchema?.default === undefined
        const isRequired = columnSchema && !columnSchema.null && hasNoDefault && !isGenerated
        const value = row.original?.[field] ?? ''
        const setValue = (nextValue) => setCellValue(row, field, nextValue)
        if (isGenerated) {
            return <Input type="text" value="" disabled aria-label={`${field} (generated)`} className={cellInputClassName} />
        }

        return <Input type="text" value={value} onChange={(event) => setValue(event.target.value)} aria-label={field} aria-required={isRequired} title={isRequired ? 'Required' : undefined} className={cellInputClassName} />
    }

    const handleSave = async () => {
        if (!hasChanges || !canSave || !databaseId || !tableName) return
        setSaving(true)
        setSaveError('')
        setSaveSuccess('')
        try {
            const res = await fetch('/api/db/bulk-update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const result = await res.json().catch(() => ({}))
            if (!res.ok) {
                throw new Error(result.error || 'Save failed')
            }
            const locallyUpdatedRows = displayData.map((row, index) => {
                if (row.__insertDraft) {
                    return Object.fromEntries(Object.entries(row).filter(([field]) => !field.startsWith('__insertDraft')))
                }
                const rowChanges = editedCells[index]?.changes
                if (!rowChanges) return row
                return {
                    ...row,
                    ...Object.fromEntries(Object.entries(rowChanges).map(([field, diff]) => [field, diff.after])),
                }
            })
            let updatedResponse = { data: locallyUpdatedRows, count: locallyUpdatedRows.length }
            if (serverPaginated) {
                try {
                    const updatedPage = await fetchPageData(currentPage)
                    updatedResponse = {
                        data: updatedPage.data,
                        count: updatedPage.count,
                        pageIndex: updatedPage.pageIndex,
                        pageSize: updatedPage.pageSize,
                        sensitiveColumns: updatedPage.sensitiveColumns,
                        hasNext: updatedPage.hasNext,
                        hasPrevious: updatedPage.hasPrevious,
                        cursorSupported: updatedPage.cursorSupported,
                        nextCursor: updatedPage.nextCursor,
                        previousCursor: updatedPage.previousCursor,
                        requestCursor: updatedPage.requestCursor,
                        requestDirection: updatedPage.requestDirection,
                    }
                } catch (refreshError) {
                    console.error('Saved table page refresh failed', refreshError)
                }
            } else {
                try {
                    const refreshed = await fetch('/api/playground/query', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            db_id: databaseId,
                            query: `SELECT * FROM \`${String(tableName).replace(/`/g, '``')}\``,
                        }),
                    })
                    if (refreshed.ok) updatedResponse = await refreshed.json()
                } catch (refreshError) {
                    console.error('Saved table refresh failed', refreshError)
                }
            }
            setDisplayData(updatedResponse.data)
            onSaved?.(updatedResponse)
            const savedMessages = []
            if (result.updatedRows > 0) savedMessages.push(`${result.updatedRows} row${result.updatedRows === 1 ? '' : 's'} updated`)
            if (result.insertedRows > 0) savedMessages.push(`${result.insertedRows} row${result.insertedRows === 1 ? '' : 's'} inserted`)
            setSaveSuccess(savedMessages.length ? `${savedMessages.join(', ')}.` : 'Saved.')
            setEditedCells({})
            onOpenChange?.(false)
        } catch (err) {
            setSaveError(err.message || 'Save failed')
        } finally {
            setSaving(false)
        }
    }

    const table = useReactTable({
        data: displayData,
        columns,
        state: {
            globalFilter,
            sorting: effectiveSorting,
            columnFilters,
            columnVisibility,
            grouping: groupingColumns,
            expanded,
            columnSizing,
            columnPinning: { left: firstAccessorKey ? [firstAccessorKey] : [] },
        },
        onSortingChange: setSorting,
        onExpandedChange: setExpanded,
        onColumnSizingChange: setColumnSizing,
        getGroupedRowModel: getGroupedRowModel(),
        getExpandedRowModel: getExpandedRowModel(),
        getSortedRowModel: getSortedRowModel(),
        defaultColumn: TABLE_DEFAULT_COLUMN,
        enableColumnPinning: true,
        onGlobalFilterChange: setGlobalFilter,
        globalFilterFn: (row, columnId, filterValue) => {
            const value = row.getValue(columnId)
            return String(value ?? '').toLowerCase().includes(String(filterValue ?? '').toLowerCase())
        },
        columnResizeDirection,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
    })
    useEffect(() => {
        if (!groupingColumns.length) {
            setExpanded((current) => Object.keys(current).length === 0 ? current : {})
            return
        }
        const groupedRows = table.getGroupedRowModel().flatRows.filter((row) => row.getIsGrouped())
        setExpanded((current) => {
            const next = Object.fromEntries(groupedRows.map((row) => [row.id, true]))
            const unchanged = Object.keys(current).length === Object.keys(next).length
                && Object.entries(next).every(([id, isExpanded]) => current[id] === isExpanded)
            return unchanged ? current : next
        })
    }, [groupingColumns, table])
    const visibleRows = table.getRowModel().rows
    const rowsToRender = groupingColumns.length > 0 ? visibleRows : [
        ...visibleRows.filter((row) => !row.original?.__insertDraft),
        ...visibleRows.filter((row) => row.original?.__insertDraft),
    ]
    const selectablePageRows = rowsToRender.filter((row) => !row.getIsGrouped())
    const allPageRowsSelected = selectablePageRows.length > 0 && selectablePageRows.every((row) => Boolean(selectedRows[row.id]))
    const somePageRowsSelected = selectablePageRows.some((row) => Boolean(selectedRows[row.id]))
    const pageSelectionState = allPageRowsSelected ? true : somePageRowsSelected ? 'indeterminate' : false
    const togglePageSelection = (checked) => setSelectedRows((current) => {
        const next = { ...current }
        selectablePageRows.forEach((row) => {
            if (checked === true) next[row.id] = true
            else delete next[row.id]
        })
        return next
    })
    const onTableRender = useCallback((_id, phase, actualDuration) => {
        const configuredThreshold = Number(process.env.NEXT_PUBLIC_DATABASE_RENDER_SLOW_MS)
        const thresholdMs = Number.isFinite(configuredThreshold) && configuredThreshold > 0 ? configuredThreshold : 16
        if (process.env.NEXT_PUBLIC_DATABASE_PERFORMANCE_LOG_ALL === 'true' || actualDuration >= thresholdMs) {
            console.info(JSON.stringify({
                event: 'database.render.performance',
                component: 'results_table',
                phase,
                duration_ms: Math.round(actualDuration * 10) / 10,
                rows: displayData.length,
                columns: columns.length,
            }))
        }
    }, [columns.length, displayData.length])
    return <Profiler id="results-table" onRender={onTableRender}><>
        <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => {
            if (!deletingRows) setDeleteDialogOpen(open)
        }}>
            <AlertDialogContent className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-sm font-semibold">Delete selected rows?</AlertDialogTitle>
                    <AlertDialogDescription className="text-xs font-semibold">
                        This will permanently delete {selectedRowsCount} {selectedRowsCount === 1 ? 'row' : 'rows'} from the table.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                {deleteError && <div role="alert" className="rounded border border-red-300 bg-red-50 p-2 text-xs font-semibold text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">{deleteError}</div>}
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={deletingRows} className="!mt-0 h-6 border-0 bg-white p-1 px-2 text-black shadow-none ring-0 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900 !text-xs !font-semibold">Cancel</AlertDialogCancel>
                    <Button onClick={handleDeleteSelectedRows} disabled={deletingRows || selectedRowsCount === 0} className="flex h-6 items-center gap-1 border-0 bg-red-600 p-1 px-2 text-white shadow-none ring-1 ring-red-500 hover:bg-red-700 dark:text-zinc-100 !text-xs !font-semibold">
                        {deletingRows ? 'Deleting...' : 'Delete'}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        {saveSuccess && <div role="status" className="border-b bg-green-50 px-3 py-2 text-xs text-green-700 dark:bg-green-950/40 dark:text-green-300">{saveSuccess}</div>}
        <Sheet open={openSheet} onOpenChange={onOpenChange}>
            <SheetContent className="min-w-[500px] overflow-y-auto bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
                <SheetHeader><SheetTitle className="text-sm font-semibold">Pending changes</SheetTitle></SheetHeader>
                <div className="mt-4 space-y-4 text-xs font-semibold">
                    {saveError && <div role="alert" className="rounded border border-red-300 bg-red-50 p-2 text-xs font-semibold text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">{saveError}</div>}
                    {canSave && !primaryKeyField && <div className="text-xs font-semibold text-zinc-500">Without a unique key, saving works only when the original values identify exactly one row.</div>}
                    {payload.meta.modifiedRows === 0 && <div className="text-xs font-semibold text-zinc-500">No changes to review</div>}
                    {Object.entries(editedCells).map(([rowKey, entry]) => (
                        <div key={rowKey} className="p-3 border bg-zinc-100 dark:bg-zinc-900 rounded-md dark:border-zinc-800">
                            {Object.entries(entry.changes).map(([col, diff]) => (
                                <div key={col}>
                                    <Breadcrumb className="mb-2">
                                        <BreadcrumbList className="!text-xs !font-semibold">
                                            <BreadcrumbItem><BreadcrumbPage className="!text-xs !font-semibold">{database?.db_name}</BreadcrumbPage></BreadcrumbItem>
                                            <BreadcrumbSeparator />
                                            <BreadcrumbItem><BreadcrumbPage className="!text-xs !font-semibold">{entry.original?.[pkField] ?? `row ${Number(rowKey) + 1}`}</BreadcrumbPage></BreadcrumbItem>
                                            <BreadcrumbSeparator />
                                            <BreadcrumbItem><BreadcrumbPage className="!text-xs !font-semibold">{col}</BreadcrumbPage></BreadcrumbItem>
                                        </BreadcrumbList>
                                    </Breadcrumb>
                                    <div className="mt-1 space-y-2">
                                        <div className="bg-red-50 ring-1 ring-red-950 dark:bg-red-700/20 text-red-700 px-2 py-1 rounded text-xs font-semibold">− {activeSensitiveColumns.some((column) => String(column).toLowerCase() === col.toLowerCase()) ? "••••••••" : String(diff.before)}</div>
                                        <div className="bg-green-50 ring-1 ring-green-950 dark:bg-green-950/30 text-green-700 px-2 py-1 rounded text-xs font-semibold">+ {activeSensitiveColumns.some((column) => String(column).toLowerCase() === col.toLowerCase()) ? "••••••••" : String(diff.after)}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                    {payload.inserts.map((insert, index) => (
                        <div key={`insert-${index}`} className="rounded-md border bg-zinc-100 p-3 dark:border-zinc-800 dark:bg-zinc-900">
                            <Breadcrumb className="mb-2">
                                <BreadcrumbList className="!text-xs !font-semibold">
                                    <BreadcrumbItem><BreadcrumbPage className="!text-xs !font-semibold">{database?.db_name}</BreadcrumbPage></BreadcrumbItem>
                                    <BreadcrumbSeparator />
                                    <BreadcrumbItem><BreadcrumbPage className="!text-xs !font-semibold">{tableName}</BreadcrumbPage></BreadcrumbItem>
                                    <BreadcrumbSeparator />
                                    <BreadcrumbItem><BreadcrumbPage className="!text-xs !font-semibold">New row {index + 1}</BreadcrumbPage></BreadcrumbItem>
                                </BreadcrumbList>
                            </Breadcrumb>
                            {Object.entries(insert.values).map(([field, value]) => (
                                <div key={field} className="mt-1 text-xs font-semibold text-zinc-600 dark:text-zinc-300">{field}: {activeSensitiveColumns.some((column) => String(column).toLowerCase() === field.toLowerCase()) ? "••••••••" : String(value)}</div>
                            ))}
                        </div>
                    ))}
                </div>
                {payload.meta.modifiedRows > 0 && canSave && (
                    <div className="mt-6 flex items-center justify-end gap-2">
                        <Button onClick={() => onOpenChange(false)} className="bg-white dark:bg-zinc-950 hover:bg-zinc-100 hover:dark:bg-zinc-800 border-0 ring-1 ring-zinc-300 dark:ring-zinc-700 p-1 px-2 h-6 shadow-none text-black dark:text-zinc-100 !text-xs !font-semibold">Cancel</Button>
                        <Button disabled={!hasChanges || saving} onClick={handleSave} className="flex items-center gap-1 ring-1 ring-blue-500 bg-blue-600 hover:bg-blue-700 border-0 p-1 px-2 h-6 shadow-none text-white dark:text-zinc-100 !text-xs !font-semibold">{saving ? 'Saving…' : `Commit All (${payload?.meta?.modifiedRows})`}</Button>
                    </div>
                )}
            </SheetContent>
        </Sheet>
        <div
            className="overflow-x-auto bg-white dark:border-zinc-800 dark:bg-zinc-950"
            onScroll={(event) => setHasHorizontalScroll(event.currentTarget.scrollLeft > 0)}
        >
            <table ref={tableElementRef} className="resizable-table border-collapse text-xs font-mono w-full">
                <thead className="bg-zinc-100 dark:bg-zinc-900">
                    {table.getHeaderGroups().map((headerGroup, headerGroupIndex) => (
                        <tr key={headerGroup.id} className="border-b dark:border-zinc-800">
                            {showSelection && <th className="group/selection sticky left-0 z-[4] w-9 min-w-9 border-r-0 bg-zinc-100 dark:bg-zinc-900" aria-label="Row selection">
                                {headerGroupIndex === 0 && selectablePageRows.length > 0 && (
                                    <Checkbox
                                        checked={pageSelectionState}
                                        onCheckedChange={togglePageSelection}
                                        aria-label="Select all rows on this page"
                                        title="Select all rows on this page"
                                        className="mx-auto block h-4 w-4 opacity-0 transition-opacity group-hover/selection:opacity-100"
                                    />
                                )}
                                <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 z-[5] w-px bg-zinc-200 dark:bg-zinc-800" />
                            </th>}
                            {headerGroup.headers.map((header) => {
                                const isPinnedLeft = header.column.getIsPinned?.() === 'left'
                                const left = isPinnedLeft ? header.column.getStart('left') + selectionColumnWidth : undefined
                                return (
                                    <th key={header.id} data-column-id={header.column.id} className={`relative ${isPinnedLeft ? 'border-r-0' : 'border-r'} p-2 px-3 text-left font-semibold !text-xs text-zinc-700 dark:border-zinc-800 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-900`} style={{ width: `${header.getSize()}px`, position: isPinnedLeft ? 'sticky' : 'relative', left, zIndex: isPinnedLeft ? 3 : 1 }}>
                                        {!header.isPlaceholder && (
                                            <div className={header.column.getCanSort() ? 'cursor-pointer select-none flex items-center gap-1' : ''} onClick={header.column.getToggleSortingHandler()}>
                                                <div className={header.column.getIsSorted() ? 'text-blue-600 flex items-center gap-2' : 'flex items-center gap-2'}>
                                                    {flexRender(header.column.columnDef.header, header.getContext())}
                                                    {{ asc: <ArrowUp size={12} />, desc: <ArrowDown size={12} /> }[header.column.getIsSorted()] ?? null}
                                                </div>
                                            </div>
                                        )}
                                        {header.column.getCanResize() && (
                                            <div
                                                onPointerDown={(event) => startColumnResize(event, header.column, event.currentTarget.firstElementChild)}
                                                onClick={(event) => event.stopPropagation()}
                                                onDoubleClick={(event) => {
                                                    event.stopPropagation()
                                                    header.column.resetSize()
                                                }}
                                                className="group/resize absolute inset-y-0 right-[-4px] z-[40] w-2 cursor-col-resize select-none touch-none"
                                                aria-label={`Resize ${header.column.id} column`}
                                                role="separator"
                                                aria-orientation="vertical"
                                            >
                                                <span className={`pointer-events-none absolute inset-y-0 left-[3px] w-px ${header.column.getIsResizing() ? 'bg-blue-500' : 'bg-transparent group-hover/resize:bg-blue-500'}`} />
                                            </div>
                                        )}
                                        {isPinnedLeft && <>
                                            <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 z-[31] w-px bg-zinc-200 dark:bg-zinc-800" />
                                            {hasHorizontalScroll && <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-[-8px] z-[30] w-2 bg-gradient-to-r from-black/20 to-transparent dark:from-white/10" />}
                                        </>}
                                    </th>
                                )
                            })}
                        </tr>
                    ))}
                </thead>
                <tbody>
                    {rowsToRender.map((row) => row.getIsGrouped() ? (
                        <tr key={row.id} className="border-b bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/70">
                            {showSelection && <td className="sticky left-0 z-[3] w-9 min-w-9 border-r-0 bg-zinc-50 dark:bg-zinc-900">
                                <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 z-[5] w-px bg-zinc-200 dark:bg-zinc-800" />
                            </td>}
                            <td colSpan={Math.max(row.getVisibleCells().length, 1)} className="px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                                <div className="flex items-center justify-between gap-3" style={{ paddingLeft: `${row.depth * 16}px` }}>
                                    <button type="button" onClick={row.getToggleExpandedHandler()} className="inline-flex items-center gap-2 text-left !text-xs !font-semibold">
                                        {row.getIsExpanded() ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                        <span className="flex flex-col items-start gap-0.5">
                                            <span className="font-mono text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{row.groupingColumnId}</span>
                                            <span className="!text-xs !font-semibold">{String(row.getLeafRows()[0]?.getValue(row.groupingColumnId) ?? '(empty)')}</span>
                                        </span>
                                    </button>
                                    <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Count: {row.getLeafRows().length}</span>
                                </div>
                            </td>
                        </tr>
                    ) : (
                        <tr key={row.id} className="border-b group dark:border-zinc-800">
                            {showSelection && <td className="sticky left-0 z-[3] w-9 min-w-9 border-r-0 bg-white p-2 text-center dark:bg-zinc-950">
                                <Checkbox
                                    checked={Boolean(selectedRows[row.id])}
                                    onCheckedChange={(checked) => setSelectedRows((current) => ({ ...current, [row.id]: checked === true }))}
                                    aria-label={`Select row ${Number(row.id) + 1}`}
                                    className="block h-4 w-4"
                                />
                                <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 z-[5] w-px bg-zinc-200 dark:bg-zinc-800" />
                            </td>}
                            {row.getVisibleCells().map((cell) => {
                                const isPinnedLeft = cell.column.getIsPinned?.() === 'left'
                                const left = isPinnedLeft ? cell.column.getStart('left') + selectionColumnWidth : undefined
                                const colId = cell.column.id
                                const isDirtyCell = editedCells?.[row.id]?.changes?.[colId] !== undefined
                                const cellValue = getCellValue(row, colId)
                                const isSensitive = activeSensitiveColumns.some((column) => String(column).toLowerCase() === String(colId).toLowerCase())
                                return (
                                    <td key={cell.id} data-column-id={cell.column.id} className={['relative bg-white dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-800 dark:border-zinc-800 dark:text-zinc-100 shadow-none', isPinnedLeft ? 'border-r-0' : 'border-r', isDirtyCell ? '!bg-orange-50 dark:!bg-orange-950 !text-orange-400' : ''].join(' ')} style={{ width: `${cell.column.getSize()}px`, position: isPinnedLeft ? 'sticky' : 'relative', left, zIndex: isPinnedLeft ? 2 : 1 }}>
                                        {isSensitive ? (
                                            <div aria-label="Sensitive value masked" className="block w-full overflow-hidden text-ellipsis whitespace-nowrap p-2 px-3 !text-xs !font-semibold">••••••••</div>
                                        ) : row.original?.__insertDraft ? renderInsertCell(row, colId) : editable ? (
                                            <EditableTableCell
                                                row={row}
                                                colId={colId}
                                                value={cellValue}
                                                editable
                                                isDirtyCell={isDirtyCell}
                                                isPinnedLeft={isPinnedLeft}
                                                editorId={editorIdRef.current}
                                                onStartEdit={startCellEdit}
                                                onInlineBlur={commitInlineCell}
                                            />
                                        ) : (
                                            <div className="block w-full overflow-hidden text-ellipsis whitespace-nowrap p-2 px-3 !text-xs !font-semibold">
                                                {String(cellValue ?? '')}
                                            </div>
                                        )}
                                        {isPinnedLeft && <>
                                            <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 z-[5] w-px bg-zinc-200 dark:bg-zinc-800" />
                                            {hasHorizontalScroll && <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-[-8px] z-[4] w-2 bg-gradient-to-r from-black/20 to-transparent dark:from-white/10" />}
                                        </>}
                                    </td>
                                )
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        <CellEditorOverlay editorId={editorIdRef.current} editable={editable} onCommit={finishCellEdit} />
    </></Profiler>
}

const mapStateToProps = (state) => ({ queryResults: state.queryResults, queryTabs: state.queryTabs, database: state.database })

export default connect(mapStateToProps, null)(QueryResultsTable)
