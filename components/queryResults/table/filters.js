import React, { useMemo, useState } from 'react'
import { ListFilter, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const operators = [
    { value: 'contains', label: 'contains' },
    { value: 'equals', label: 'is' },
    { value: 'notEquals', label: 'is not' },
    { value: 'startsWith', label: 'starts with' },
    { value: 'endsWith', label: 'ends with' },
    { value: 'isEmpty', label: 'is empty' },
    { value: 'isNotEmpty', label: 'is not empty' },
]

function TableFilters({ columns = [], rules = [], onChange, disabled = false, sensitiveColumns = [] }) {
    const [open, setOpen] = useState(false)
    const availableColumns = useMemo(() => (Array.isArray(columns) ? columns : []).filter(Boolean), [columns])
    const safeSensitiveColumns = Array.isArray(sensitiveColumns) ? sensitiveColumns : []
    const safeRules = Array.isArray(rules) ? rules : []
    const [draftRules, setDraftRules] = useState(safeRules)
    const visibleRules = draftRules
    const activeCount = safeRules.filter((rule) => ['isEmpty', 'isNotEmpty'].includes(rule.operator) || String(rule.value ?? '').trim() !== '').length
    const hasUnappliedChanges = JSON.stringify(visibleRules) !== JSON.stringify(safeRules)

    const updateRules = (nextRules) => {
        setDraftRules(nextRules)
    }

    const addRule = () => {
        const usedColumns = new Set(visibleRules.map((rule) => rule.column))
        const column = availableColumns.find((name) => !usedColumns.has(name))
        if (!column) return
        setDraftRules([...draftRules, { id: `${Date.now()}-${Math.random()}`, column, operator: 'contains', value: '', conjunction: 'and' }])
    }

    const updateRule = (id, patch) => {
        updateRules(draftRules.map((rule) => rule.id === id ? { ...rule, ...patch } : rule))
    }
    const canAddRule = visibleRules.length < availableColumns.length

    if (availableColumns.length === 0) return null

    return (
        <Popover open={open} onOpenChange={(nextOpen) => {
            if (nextOpen) setDraftRules(safeRules)
            setOpen(nextOpen)
        }}>
            <PopoverTrigger asChild>
                <Button type="button" disabled={disabled} className={`flex h-6 items-center gap-1 border-0 p-1 px-2 shadow-none !text-xs !font-semibold ${activeCount > 0 ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-200 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-900 dark:hover:bg-blue-950/60' : 'bg-white text-black ring-0 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900'}`}>
                    <ListFilter size={12} />
                    Filter
                    {activeCount > 0 && <span className="ml-1 text-current">{activeCount}</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[620px] max-w-[calc(100vw-2rem)] p-0">
                <div className="px-3 pt-3 mb-3 text-xs font-semibold text-zinc-700 dark:text-zinc-200">In this view show records</div>
                <div className="space-y-2 px-3">
                    {visibleRules.map((rule, index) => (
                        <div key={rule.id} className="space-y-1">
                        <div className="flex items-center gap-2">
                            {index === 0 ? (
                                <span className="w-[58px] shrink-0 text-xs font-semibold text-zinc-500 dark:text-zinc-400">Where</span>
                            ) : (
                                <Select value={rule.conjunction || 'and'} onValueChange={(conjunction) => updateRule(rule.id, { conjunction })}>
                                    <SelectTrigger aria-label="Filter conjunction" className="h-7 w-[58px] shrink-0 border-0 bg-white px-2 py-0 text-xs font-semibold text-zinc-900 shadow-none ring-1 ring-zinc-300 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-700 [&>span]:text-xs [&>span]:font-semibold [&>svg]:h-3 [&>svg]:w-3">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="text-xs font-semibold">
                                        <SelectItem value="and" className="py-1.5 text-xs font-semibold">And</SelectItem>
                                        <SelectItem value="or" className="py-1.5 text-xs font-semibold">Or</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                            <Select value={rule.column || ''} onValueChange={(column) => updateRule(rule.id, { column })}>
                                <SelectTrigger aria-label="Filter column" className="h-7 w-[180px] shrink-0 border-0 bg-white px-2 py-0 text-xs font-semibold text-zinc-900 shadow-none ring-1 ring-zinc-300 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-700 [&>span]:text-xs [&>span]:font-mono [&>span]:font-semibold [&>svg]:h-3 [&>svg]:w-3">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="text-xs font-semibold">
                                    {availableColumns.map((column) => <SelectItem key={column} value={column} className="py-1.5 text-xs font-mono font-semibold">{column}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Select value={rule.operator || 'contains'} onValueChange={(operator) => updateRule(rule.id, { operator, value: ['isEmpty', 'isNotEmpty'].includes(operator) ? '' : String(rule.value ?? '') })}>
                                <SelectTrigger aria-label="Filter condition" className="h-7 w-[132px] shrink-0 border-0 bg-white px-2 py-0 text-xs font-semibold text-zinc-900 shadow-none ring-1 ring-zinc-300 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-700 [&>span]:text-xs [&>span]:font-semibold [&>svg]:h-3 [&>svg]:w-3">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="text-xs font-semibold">
                                    {operators.map((operator) => <SelectItem key={operator.value} value={operator.value} className="py-1.5 text-xs font-semibold">{operator.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            {!['isEmpty', 'isNotEmpty'].includes(rule.operator) && (
                                <Input value={String(rule.value ?? '')} onChange={(event) => updateRule(rule.id, { value: event.target.value })} placeholder="Enter value..." aria-label="Filter value" className="h-7 min-w-0 flex-1 px-2 py-0 !text-xs !font-semibold" />
                            )}
                            <Button type="button" onClick={() => updateRules(draftRules.filter((item) => item.id !== rule.id))} aria-label="Remove filter" className="h-6 w-6 shrink-0 border-0 bg-transparent p-1 text-zinc-500 shadow-none hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800">
                                <X size={12} />
                            </Button>
                        </div>
                        {rule.operator === 'contains' && safeSensitiveColumns.some((column) => column.toLowerCase() === String(rule.column).toLowerCase()) && (
                            <p className="pl-[66px] text-xs font-semibold text-amber-700 dark:text-amber-400">Sensitive values stay masked in results and exports.</p>
                        )}
                        </div>
                    ))}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-zinc-200 px-3 pt-2 pb-3 dark:border-zinc-800">
                    <Button type="button" onClick={addRule} disabled={disabled || !canAddRule} className="flex h-6 items-center gap-1 border-0 bg-white p-1 px-2 text-black shadow-none ring-0 hover:bg-zinc-100 disabled:opacity-50 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900 !text-xs !font-semibold">
                        <Plus size={12} /> Add filter
                    </Button>
                    <div className="flex items-center gap-2">
                        <Button type="button" onClick={() => { updateRules([]); onChange?.([]) }} disabled={disabled || (draftRules.length === 0 && safeRules.length === 0)} className="h-6 border-0 bg-white p-1 px-2 text-black shadow-none ring-1 ring-zinc-300 hover:bg-zinc-100 disabled:opacity-50 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-900 !text-xs !font-semibold">
                            Clear all filters
                        </Button>
                        <Button type="button" onClick={() => { onChange?.(draftRules); setOpen(false) }} disabled={disabled || !hasUnappliedChanges} className="h-6 border-0 bg-blue-600 p-1 px-2 text-white shadow-none hover:bg-blue-700 disabled:opacity-50 dark:text-zinc-100 !text-xs !font-semibold">
                            Apply filters
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}

export default TableFilters
