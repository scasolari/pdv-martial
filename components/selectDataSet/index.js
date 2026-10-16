"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {setDatabase, setDatabases, setQuery} from "@/redux/actions/main";
import {connect} from "react-redux";
import {FaCheck} from "react-icons/fa6";
import {BiExpandVertical} from "react-icons/bi";
import {PiTrashSimpleBold} from "react-icons/pi";
import useClear from "@/lib/clear";
import {LuPaintbrush} from "react-icons/lu";
import {BsDatabase} from "react-icons/bs";
import {FiDatabase} from "react-icons/fi";
import {fetchTablesForDb} from "@/redux/actions/tables";

export function SelectDataSet(props) {
    const { databases, database, setDatabase, setQuery, fetchTablesForDb} = props;
    const [open, setOpen] = React.useState(false)
    const [value, setValue] = React.useState("")
    const frameworks = databases
    const clear = useClear()
    const removeAll = () => {
        setValue("")
        clear()
    }

    return <>
        <div className="flex gap-3">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="rounded-lg w-[340px] justify-between !font-semibold border-0 shadow-none bg-neutral-100 hover:bg-neutral-200/70 dark:bg-neutral-800 dark:hover:bg-neutral-700"
                    >
                        <p className="truncate overflow-hidden !text-xs !font-semibold">
                            {value || database?.db_name || "Select dataset..."}
                        </p>
                        <BiExpandVertical size={16} />
                    </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="p-0 w-[340px] rounded-lg">
                    <Command className="rounded-lg">
                        <CommandInput placeholder="Search dataset..." className="h-9 !font-semibold !text-xs" />
                        <CommandList>
                            <CommandEmpty>No dataset found.</CommandEmpty>
                            <CommandGroup>
                                {frameworks.map((framework) => (
                                    <CommandItem
                                        key={framework.id}
                                        value={String(framework.id)}
                                        className="!font-semibold rounded-lg !text-xs"
                                        onSelect={(currentValue) => {
                                            setOpen(false);

                                            const selectedFramework = frameworks.find(
                                                f => String(f.id) === currentValue
                                            );

                                            if (!selectedFramework) return;

                                            const db = {
                                                db_id: selectedFramework.id,
                                                db_name: selectedFramework.db_name,
                                            };

                                            setValue(selectedFramework.db_name);
                                            setDatabase(db);
                                            fetchTablesForDb(db.db_id); // 🚀 ORA PARTE
                                            setQuery("");
                                        }}
                                    >

                                    <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden whitespace-nowrap">
                                            <FiDatabase size={14} className="shrink-0" />
                                            <span className="block min-w-0 flex-1 truncate" title={framework.db_name}>{framework.db_name}</span>
                                        </div>
                                        <FaCheck size={16} className={cn(
                                            "ml-auto",
                                            value === framework.db_name ? "opacity-100" : "opacity-0"
                                        )}/>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
            <Button variant="outline" disabled={Array.isArray(database)} onClick={removeAll} className="shadow-none rounded-lg !font-semibold h-9 border-0 text-primary w-fit bg-neutral-100 hover:bg-neutral-200/70 dark:bg-neutral-800 dark:hover:bg-neutral-700">
                <LuPaintbrush />
            </Button>
        </div>
    </>
}

const mapStateToProps = (state) => {
    return {
        databases: state.databases,
        database: state.database,
    };
};

const mapDispatchToProps = {
    setDatabases,
    setDatabase,
    setQuery,
    fetchTablesForDb
};

export default connect(mapStateToProps, mapDispatchToProps)(SelectDataSet);
