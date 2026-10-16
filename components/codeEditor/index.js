import React, { useEffect, useMemo, useRef } from 'react'
import { EditorState, Compartment } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { basicSetup } from '@codemirror/basic-setup'
import { sql } from '@codemirror/lang-sql'
import { HighlightStyle, tags as t } from '@codemirror/highlight'
import { useTheme } from "next-themes";

const EMPTY_SCHEMA = Object.freeze({})
const EMPTY_TABLES = Object.freeze([])

export default function MinimalEditor({ onChange, initialValue = '', schema = EMPTY_SCHEMA, tables = EMPTY_TABLES }) {
    const editorRef = useRef(null)
    const viewRef = useRef(null)
    const lastValueRef = useRef('')
    const onChangeRef = useRef(onChange)
    onChangeRef.current = onChange
    const { theme, setTheme } = useTheme();

    const themeCompartment = useRef(new Compartment()).current
    const highlightCompartment = useRef(new Compartment()).current
    const sqlCompartment = useRef(new Compartment()).current

    const sqlExtension = useMemo(() => sql({
        schema,
        tables: tables.map((tableName) => ({ label: tableName, type: 'namespace' })),
    }), [schema, tables])

    const createTheme = (isDark) =>
        EditorView.theme(
            {
                '&': {
                    backgroundColor: theme === "dark" ? '#111111' : '#ffffff',
                    color: theme === "dark" ? '#f5f5f5' : '#000000',
                    height: '100%',
                },
                '.cm-content': {
                    caretColor: theme === "dark" ? '#f5f5f5' : '#000000',
                    padding: '12px',
                },
                '.cm-gutters': {
                    backgroundColor: theme === "dark" ? '#111111' : '#ffffff',
                    color: theme === "dark" ? '#888888' : '#aaaaaa',
                    border: 'none',
                },
                // Tooltip / autocomplete (selettori più aggressivi)
                '.cm-tooltip, .cm-tooltip.cm-tooltip-autocomplete, .cm-tooltip-autocomplete': {
                    padding: '5px',
                    borderRadius: '10px',
                    backgroundColor: theme === "dark" ? '#09090b' : '#ffffff',
                    border: theme === "dark" ? '1px solid #374151' : '1px solid #e5e5e5',
                },
                '.cm-tooltip.cm-tooltip-autocomplete > ul > li': {
                    borderRadius: '5px',
                    padding: '5px 10px',
                    display: 'flex',
                    gap: '10px',
                    alignItems: 'center',
                    fontFamily:
                        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif',
                    fontSize: '0.875rem',
                },
                '.cm-tooltip-autocomplete ul li[aria-selected]': {
                    backgroundColor: theme === "dark" ? '#111111' : '#f5f5f5',
                    color: theme === "dark" ? '#ffffff' : '#000000',
                },
            },
            { dark: theme === "dark" }
        )

    const createHighlight = (isDark) =>
        HighlightStyle.define([
            { tag: t.keyword, color: theme === "dark" ? '#93c5fd' : '#2563eb', fontWeight: 'bold' },
            { tag: t.operator, color: theme === "dark" ? '#ffcb6b' : '#6a1b9a', fontWeight: 'bold' },
            { tag: t.string, color: theme === "dark" ? '#c3e88d' : '#2e7d32', fontWeight: 'bold' },
            { tag: t.variableName, color: theme === "dark" ? '#ffffff' : '#000000', fontWeight: 'bold' },
            { tag: t.literal, color: theme === "dark" ? '#ff5370' : '#c62828', fontWeight: 'bold' },
            { tag: t.comment, color: theme === "dark" ? '#999999' : '#757575', fontStyle: 'italic', fontWeight: 'bold' },
            { tag: t.number, fontWeight: 'bold' },
        ])

    // Init una sola volta
    useEffect(() => {
        if (!editorRef.current) return

        const updateListener = EditorView.updateListener.of((update) => {
            if (update.docChanged) {
                const value = update.state.doc.toString()
                lastValueRef.current = value
                onChangeRef.current?.(value)
            }
        })

        const state = EditorState.create({
            doc: initialValue,
            extensions: [
                basicSetup,
                sqlCompartment.of(sqlExtension),
                updateListener,
                // prima l'highlight…
                highlightCompartment.of(createHighlight(theme === 'dark')),
                // …poi il tema, così vince su tutto (anche sul default)
                themeCompartment.of(createTheme(theme === 'dark')),
            ],
        })

        const view = new EditorView({
            state,
            parent: editorRef.current,
        })

        viewRef.current = view
        lastValueRef.current = initialValue

        return () => view.destroy()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (!viewRef.current) return
        viewRef.current.dispatch({
            effects: sqlCompartment.reconfigure(sqlExtension),
        })
    }, [schema, sqlCompartment, sqlExtension])

    // Aggiorna il contenuto se cambia initialValue da fuori
    useEffect(() => {
        if (!viewRef.current) return

        const currentValue = viewRef.current.state.doc.toString()
        if (initialValue !== currentValue && initialValue !== lastValueRef.current) {
            const tr = viewRef.current.state.update({
                changes: {
                    from: 0,
                    to: currentValue.length,
                    insert: initialValue,
                },
            })
            viewRef.current.dispatch(tr)
            lastValueRef.current = initialValue
        }
    }, [initialValue])

    // Cambia tema on-the-fly
    useEffect(() => {
        if (!viewRef.current) return

        viewRef.current.dispatch({
            effects: [
                highlightCompartment.reconfigure(createHighlight(theme === 'dark')),
                themeCompartment.reconfigure(createTheme(theme === 'dark')),
            ],
        })
    }, [theme])

    return (
        <div
            ref={editorRef}
            className="!text-sm h-[200px] overflow-y-auto bg-zinc-50 dark:bg-zinc-900/30"
        />
    )
}
