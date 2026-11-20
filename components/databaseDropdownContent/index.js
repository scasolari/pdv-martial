import { Check, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
    DropdownMenuItem,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import DatabaseEngineIcon from "@/components/databaseEngineIcon";

function DatabaseDropdownContent({
    databases = [],
    selectedDatabaseId,
    search,
    onSearchChange,
    onSelectDatabase,
    onAddDatabase,
}) {
    const normalizedSearch = search.trim().toLowerCase();
    const filteredDatabases = databases.filter((database) =>
        String(database.db_name || "").toLowerCase().includes(normalizedSearch)
    );

    return (
        <>
            <div className="sticky top-0 z-10 bg-popover pb-1">
                <Input
                    value={search}
                    onChange={(event) => onSearchChange(event.target.value)}
                    onKeyDown={(event) => event.stopPropagation()}
                    onClick={(event) => event.stopPropagation()}
                    placeholder="Search databases..."
                    aria-label="Search databases"
                    className="h-7 text-xs! font-semibold!"
                />
            </div>
            <div className="max-h-[min(70vh,400px)] overflow-y-auto">
                {filteredDatabases.map((database) => (
                    <DropdownMenuItem
                        key={database.id}
                        onSelect={() => onSelectDatabase(database)}
                        className="flex items-center gap-2 text-xs! font-semibold!"
                    >
                        <DatabaseEngineIcon dialect={database.dialect} size={12} />
                        <span className="min-w-0 flex-1 truncate">{database.db_name}</span>
                        {database.id === selectedDatabaseId && <Check size={12} className="shrink-0" />}
                    </DropdownMenuItem>
                ))}
                {filteredDatabases.length === 0 && (
                    <DropdownMenuItem disabled className="text-xs! font-semibold!">
                        {normalizedSearch ? "No databases match your search" : "No databases found"}
                    </DropdownMenuItem>
                )}
            </div>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem onSelect={onAddDatabase} className="flex items-center gap-2 text-xs! font-semibold!">
                <Plus size={12} />
                Add dataset
            </DropdownMenuItem>
        </>
    );
}

export default DatabaseDropdownContent;
