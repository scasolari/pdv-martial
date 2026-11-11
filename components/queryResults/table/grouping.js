import { useMemo, useState } from 'react'
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
                <Button type="button" className={`flex h-6 items-center gap-1 border-0 p-1 px-2 shadow-none !text-xs !font-semibold ${activeCount > 0 ? 'bg-primary text-primary-foreground ring-1 ring-ring hover:bg-primary/90' : 'bg-background text-foreground ring-0 hover:bg-accent hover:text-accent-foreground'}`}>
                    <Layers size={12} />
                    Group{activeCount > 0 ? ` ${activeCount}` : ''}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[620px] max-w-[calc(100vw-2rem)] p-0">
                <div className="px-3 pt-3 pb-2 text-xs font-semibold text-foreground dark:text-foreground">Group by</div>
                <div className="space-y-2 border-y border-border px-3 py-3 dark:border-border">
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
                                <GripVertical size={14} className="shrink-0 cursor-grab text-muted-foreground" aria-hidden="true" />
                                <Select value={group.column} onValueChange={(column) => updateGroup(index, { column })}>
                                    <SelectTrigger aria-label="Group column" className="h-7 min-w-0 flex-1 border-0 bg-background px-2 py-0 text-xs font-semibold text-foreground shadow-none ring-1 ring-border dark:bg-background dark:text-foreground dark:ring-border [&>span]:font-mono [&>span]:text-xs [&>span]:font-semibold [&>svg]:h-3 [&>svg]:w-3">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="text-xs font-semibold">
                                        {availableColumns.map((column) => <SelectItem key={column} value={column} className="py-1.5 font-mono text-xs font-semibold">{column}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <Select value={group.desc ? 'desc' : 'asc'} onValueChange={(direction) => updateGroup(index, { desc: direction === 'desc' })}>
                                    <SelectTrigger aria-label="Group sort direction" className="h-7 w-[90px] shrink-0 border-0 bg-background px-2 py-0 text-xs font-semibold text-foreground shadow-none ring-1 ring-border dark:bg-background dark:text-foreground dark:ring-border [&>span]:text-xs [&>span]:font-semibold [&>svg]:h-3 [&>svg]:w-3">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="text-xs font-semibold">
                                        <SelectItem value="asc" className="py-1.5 text-xs font-semibold">A → Z</SelectItem>
                                        <SelectItem value="desc" className="py-1.5 text-xs font-semibold">Z → A</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Select value={group.mode} onValueChange={(mode) => updateGroup(index, { mode })}>
                                    <SelectTrigger aria-label="Group matching mode" className="h-7 w-[112px] shrink-0 border-0 bg-background px-2 py-0 text-xs font-semibold text-foreground shadow-none ring-1 ring-border dark:bg-background dark:text-foreground dark:ring-border [&>span]:text-xs [&>span]:font-semibold [&>svg]:h-3 [&>svg]:w-3">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="text-xs font-semibold">
                                        <SelectItem value="exact" className="py-1.5 text-xs font-semibold">Exact</SelectItem>
                                        <SelectItem value="caseInsensitive" className="py-1.5 text-xs font-semibold">Case insensitive</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button type="button" onClick={() => removeGroup(index)} aria-label="Remove group" className="h-6 w-6 shrink-0 border-0 bg-transparent p-1 text-muted-foreground shadow-none hover:bg-accent dark:text-muted-foreground dark:hover:bg-accent">
                                    <X size={12} />
                                </Button>
                            </div>
                        )
                    })}
                    {draftGroups.length === 0 && <p className="py-1 text-xs font-semibold text-muted-foreground dark:text-muted-foreground">No groups added.</p>}
                </div>
                <div className="flex items-center justify-between px-3 pt-2 pb-3">
                    <Button type="button" onClick={addGroup} disabled={ungroupedColumns.length === 0} className="flex h-6 items-center gap-1 border-0 bg-background p-1 px-2 text-foreground shadow-none ring-0 hover:bg-accent disabled:opacity-50 dark:bg-background dark:text-foreground dark:hover:bg-accent !text-xs !font-semibold">
                        <Plus size={12} /> Add group
                    </Button>
                    <div className="flex items-center gap-2">
                        <Button type="button" onClick={() => { updateGroups([]); onChange?.([]) }} disabled={draftGroups.length === 0 && groups.length === 0} className="h-6 border-0 bg-background p-1 px-2 text-foreground shadow-none ring-0 hover:bg-accent disabled:opacity-50 dark:bg-background dark:text-foreground dark:hover:bg-accent !text-xs !font-semibold">
                            Clear all groups
                        </Button>
                        <Button type="button" onClick={() => { onChange?.(draftGroups); setOpen(false) }} disabled={!hasUnappliedChanges} className="flex h-6 items-center gap-1 border-0 bg-primary p-1 px-2 text-primary-foreground shadow-none ring-1 ring-ring hover:bg-primary/90 disabled:opacity-50 !text-xs !font-semibold">
                            Apply groups
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}

export default TableGrouping
