import React, { useMemo, useState } from 'react'
import { GripVertical, Layers, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const normalizeGroup = (group) => typeof group === 'string'
    ? { column: group, desc: false, mode: 'exact' }
    : { column: group.column, desc: Boolean(group.desc), mode: group.mode || 'exact' }

function TableGrouping({ columns = [], grouping = [], onChange }) {
    const [open, setOpen] = useState(false)
    const [draggedIndex, setDraggedIndex] = useState(null)
    const groups = useMemo(() => (Array.isArray(grouping) ? grouping : []).map(normalizeGroup), [grouping])
    const [draftGroups, setDraftGroups] = useState(groups)
    const ungroupedColumns = columns.filter((column) => !draftGroups.some((group) => group.column === column))
    const activeCount = groups.length
    const hasUnappliedChanges = JSON.stringify(draftGroups) !== JSON.stringify(groups)

    const updateGroups = (nextGroups) => setDraftGroups(nextGroups)
    const addGroup = () => {
        const column = ungroupedColumns[0]
        if (!column) return
        updateGroups([...draftGroups, { column, desc: false, mode: 'exact' }])
    }
    const updateGroup = (index, patch) => updateGroups(draftGroups.map((group, currentIndex) => currentIndex === index ? { ...group, ...patch } : group))
    const removeGroup = (index) => updateGroups(draftGroups.filter((_, currentIndex) => currentIndex !== index))
    const moveGroup = (fromIndex, toIndex) => {
        if (fromIndex === null || fromIndex === toIndex || toIndex < 0 || toIndex >= draftGroups.length) return
        const nextGroups = [...draftGroups]
        const [moved] = nextGroups.splice(fromIndex, 1)
        nextGroups.splice(toIndex, 0, moved)
        updateGroups(nextGroups)
        setDraggedIndex(null)
    }

    return (
        <Popover open={open} onOpenChange={(nextOpen) => {
            if (nextOpen) setDraftGroups(groups)
            setOpen(nextOpen)
        }}>
            <PopoverTrigger asChild>
                <Button type="button" className={`flex h-6 items-center gap-1 border-0 p-1 px-2 shadow-none !text-xs !font-semibold ${activeCount > 0 ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-200 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-900 dark:hover:bg-blue-950/60' : 'bg-white text-black ring-0 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900'}`}>
                    <Layers size={12} />
                    Group{activeCount > 0 ? ` ${activeCount}` : ''}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[620px] max-w-[calc(100vw-2rem)] p-0">
                <div className="px-3 pt-3 pb-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200">Group by</div>
                <div className="space-y-2 border-y border-zinc-200 px-3 py-3 dark:border-zinc-800">
                    {draftGroups.map((group, index) => {
                        const availableColumns = columns.filter((column) => column === group.column || !draftGroups.some((item) => item.column === column))
                        return (
                            <div
                                key={`${group.column}-${index}`}
                                draggable
                                onDragStart={() => setDraggedIndex(index)}
                                onDragOver={(event) => event.preventDefault()}
                                onDrop={() => moveGroup(draggedIndex, index)}
                                onDragEnd={() => setDraggedIndex(null)}
                                className={`flex items-center gap-2 ${draggedIndex === index ? 'opacity-50' : ''}`}
                            >
                                <GripVertical size={14} className="shrink-0 cursor-grab text-zinc-400" aria-hidden="true" />
                                <Select value={group.column} onValueChange={(column) => updateGroup(index, { column })}>
                                    <SelectTrigger aria-label="Group column" className="h-7 min-w-0 flex-1 border-0 bg-white px-2 py-0 text-xs font-semibold text-zinc-900 shadow-none ring-1 ring-zinc-300 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-700 [&>span]:font-mono [&>span]:text-xs [&>span]:font-semibold [&>svg]:h-3 [&>svg]:w-3">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="text-xs font-semibold">
                                        {availableColumns.map((column) => <SelectItem key={column} value={column} className="py-1.5 font-mono text-xs font-semibold">{column}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <Select value={group.desc ? 'desc' : 'asc'} onValueChange={(direction) => updateGroup(index, { desc: direction === 'desc' })}>
                                    <SelectTrigger aria-label="Group sort direction" className="h-7 w-[90px] shrink-0 border-0 bg-white px-2 py-0 text-xs font-semibold text-zinc-900 shadow-none ring-1 ring-zinc-300 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-700 [&>span]:text-xs [&>span]:font-semibold [&>svg]:h-3 [&>svg]:w-3">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="text-xs font-semibold">
                                        <SelectItem value="asc" className="py-1.5 text-xs font-semibold">A → Z</SelectItem>
                                        <SelectItem value="desc" className="py-1.5 text-xs font-semibold">Z → A</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Select value={group.mode} onValueChange={(mode) => updateGroup(index, { mode })}>
                                    <SelectTrigger aria-label="Group matching mode" className="h-7 w-[112px] shrink-0 border-0 bg-white px-2 py-0 text-xs font-semibold text-zinc-900 shadow-none ring-1 ring-zinc-300 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-700 [&>span]:text-xs [&>span]:font-semibold [&>svg]:h-3 [&>svg]:w-3">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="text-xs font-semibold">
                                        <SelectItem value="exact" className="py-1.5 text-xs font-semibold">Exact</SelectItem>
                                        <SelectItem value="caseInsensitive" className="py-1.5 text-xs font-semibold">Case insensitive</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button type="button" onClick={() => removeGroup(index)} aria-label="Remove group" className="h-6 w-6 shrink-0 border-0 bg-transparent p-1 text-zinc-500 shadow-none hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800">
                                    <X size={12} />
                                </Button>
                            </div>
                        )
                    })}
                    {draftGroups.length === 0 && <p className="py-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">No groups added.</p>}
                </div>
                <div className="flex items-center justify-between px-3 pt-2 pb-3">
                    <Button type="button" onClick={addGroup} disabled={ungroupedColumns.length === 0} className="flex h-6 items-center gap-1 border-0 bg-white p-1 px-2 text-black shadow-none ring-0 hover:bg-zinc-100 disabled:opacity-50 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900 !text-xs !font-semibold">
                        <Plus size={12} /> Add group
                    </Button>
                    <div className="flex items-center gap-2">
                        <Button type="button" onClick={() => { updateGroups([]); onChange?.([]) }} disabled={draftGroups.length === 0 && groups.length === 0} className="h-6 border-0 bg-white p-1 px-2 text-black shadow-none ring-1 ring-zinc-300 hover:bg-zinc-100 disabled:opacity-50 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-900 !text-xs !font-semibold">
                            Clear all groups
                        </Button>
                        <Button type="button" onClick={() => { onChange?.(draftGroups); setOpen(false) }} disabled={!hasUnappliedChanges} className="h-6 border-0 bg-blue-600 p-1 px-2 text-white shadow-none hover:bg-blue-700 disabled:opacity-50 dark:text-zinc-100 !text-xs !font-semibold">
                            Apply groups
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}

export default TableGrouping
