import {
    setDatabase,
    setDatabases,
    setProfile,
    setQuery,
    setQueryResults,
    setQueryTabs,
    setTables,
} from "@/redux/actions/main";
import { connect } from "react-redux";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import useLogout from "@/lib/logout";
import {useCallback, useEffect, useRef, useState} from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import axios from "axios";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { BiExpandVertical } from "react-icons/bi";
import DatabaseEngineIcon from "@/components/databaseEngineIcon";
import { FaCheck } from "react-icons/fa6";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/base-toast";
import * as React from "react";
import { CircleUserRound, PanelRightOpen, RefreshCcw, Plus, Trash2 } from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import TablesV2 from "@/components/tables/v2";
import { useRouter } from "next/router";
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import AddDatabase from "@/components/addDatabase";
import useClear from "@/lib/clear";
import { NAVIGATION_WIDTH_MAX, NAVIGATION_WIDTH_MIN, useNavigationVisibility } from "@/components/navigationBar/navigationVisibility";
import { startRefreshIconAnimation, stopRefreshIconAnimation } from "@/lib/refreshIconAnimation";
import packageJson from "../../../package.json";

function LeftBar(props) {
    const {
        profile,
        setProfile,
        database,
        setDatabase,
        databases,
        setDatabases,
        setQuery,
        setQueryResults,
        setQueryTabs,
        openTab, // 👈 ARRIVA dal Playground
        openSqlTab,
        activeTabName,
    } = props;

    const logout = useLogout();
    const router = useRouter();
    const { data: session } = useSession();
    const { navigationHidden, navigationWidth, setNavigationWidth, setNavigationHidden, setAppSettingsOpen } = useNavigationVisibility();
    const resizeStartX = useRef(null);
    const resizeStartWidth = useRef(null);

    const handleResizePointerDown = (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        resizeStartX.current = event.clientX;
        resizeStartWidth.current = navigationWidth;
        event.currentTarget.setPointerCapture(event.pointerId);
    };

    const handleResizePointerMove = (event) => {
        if (resizeStartX.current === null) return;
        const nextWidth = resizeStartWidth.current + event.clientX - resizeStartX.current;
        setNavigationWidth(Math.min(NAVIGATION_WIDTH_MAX, Math.max(NAVIGATION_WIDTH_MIN, nextWidth)));
    };

    const stopResize = () => {
        resizeStartX.current = null;
        resizeStartWidth.current = null;
    };
    const [open, setOpen] = React.useState(false);
    const [openDb, setOpenDb] = React.useState(false);
    const [openAdDataSet, setOpenAdDataSet] = useState(false);
    const [refreshingSchema, setRefreshingSchema] = useState(false);
    const schemaRefreshIconRef = useRef(null);
    const schemaRefreshIconAnimationRef = useRef(null);
    const [datasetToDelete, setDatasetToDelete] = useState(null);
    const [deleteDatasetOpen, setDeleteDatasetOpen] = useState(false);
    const [deletingDataset, setDeletingDataset] = useState(false);
    const [, setDeleteDatasetError] = useState("");
    const [value, setValue] = React.useState("");
    const frameworks = databases;
    const clearDatabaseState = useClear();

    const fetchDatabases = useCallback(() => {
        axios.get("/api/database").then((response) => {
            setDatabases(response.data);
        });
    }, [setDatabases]);

    const refreshDatabaseSchema = async () => {
        if (!database?.db_id || refreshingSchema) return;
        startRefreshIconAnimation(schemaRefreshIconRef.current, schemaRefreshIconAnimationRef);
        setRefreshingSchema(true);
        try {
            const response = await axios.get(
                `/api/playground/db/table?db_id=${encodeURIComponent(database.db_id)}`
            );
            setTables({ ...response.data, _databaseId: database.db_id });
        } catch (error) {
            console.error("Unable to refresh database schema", error);
        } finally {
            setRefreshingSchema(false);
            stopRefreshIconAnimation(schemaRefreshIconRef.current, schemaRefreshIconAnimationRef);
        }
    };

    const deleteDataset = async () => {
        if (!datasetToDelete?.id || deletingDataset) return;
        setDeletingDataset(true);
        setDeleteDatasetError("");
        try {
            await axios.delete(`/api/database/${encodeURIComponent(datasetToDelete.id)}`);
            toast.add({ title: "Dataset deleted", description: "The database was removed.", type: "success" });
            setDatabases(frameworks.filter((dataset) => dataset.id !== datasetToDelete.id));
            setDeleteDatasetOpen(false);
            setDatasetToDelete(null);
            if (database?.db_id === datasetToDelete.id) {
                await clearDatabaseState();
                setValue("");
                router.push("/app/playground/play");
            }
        } catch (error) {
            const message = error.response?.data?.error || "Unable to delete dataset.";
            setDeleteDatasetError(message);
            toast.add({ title: "Unable to delete dataset", description: message, type: "error" });
        } finally {
            setDeletingDataset(false);
        }
    };

    useEffect(() => {
        fetchDatabases();
        setProfile(session);
    }, [fetchDatabases, session, setProfile]);

    if (navigationHidden) return null;

    return (
        <>
            <div className="fixed top-0 h-[100vh] border-r bg-zinc-50 dark:bg-zinc-900/30" style={{ width: `${navigationWidth}px` }}>
                <div className="flex flex-col gap-2">
                    <div className="grid gap-1 grid-cols-[26px_1fr_auto_auto] p-3 px-4">
                        <Popover>
                            <PopoverTrigger>
                                {profile?.user?.image ? <Image className="bg-zinc-100 dark:bg-zinc-900 rounded-full border object-cover" src={profile.user.image} height={30} width={30} alt={profile?.user?.name || "Account"} unoptimized /> : <span className="flex h-[30px] w-[30px] items-center justify-center"><CircleUserRound size={20} /></span>}
                            </PopoverTrigger>
                            <PopoverContent
                                align="start"
                                side="bottom"
                                className="w-[276px] p-0 border-zinc-200 dark:border-zinc-700 z-[99999999]"
                            >
                                <div className="p-3 pb-0 pt-2">
                                    <p className="text-xs text-zinc-500 !font-semibold">
                                        {profile?.user?.email}
                                    </p>
                                </div>
                                <ul className="p-1">
                                    <li className="font-semibold">
                                        <button
                                            type="button"
                                            onClick={() => setAppSettingsOpen(true)}
                                            className="!text-xs flex w-full text-left hover:cursor-pointer dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900 px-2 py-1 rounded-md"
                                        >
                                            Settings
                                        </button>
                                    </li>
                                    <li><button type="button" className="w-full text-left !text-xs dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900 px-2 py-1 rounded-md font-semibold" onClick={logout}>Logout</button></li>
                                </ul>
                            </PopoverContent>
                        </Popover>
                        <div className="contents">
                            <Popover open={openDb} onOpenChange={setOpenDb}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={open}
                                        className="hover:ring-1 ring-zinc-200 dark:hover:ring-zinc-800 flex w-full overflow-hidden truncate flex-row gap-3 px-3 h-7 rounded-md justify-between !font-semibold border-0 shadow-none bg-transparent hover:bg-zinc-100 dark:bg-transparent dark:hover:bg-zinc-900"
                                    >
                                        <p className="truncate overflow-hidden !text-xs">
                                            {value || database?.db_name || "Select dataset..."}
                                        </p>
                                        <BiExpandVertical size={16} />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                    align="start"
                                    className="p-0 w-[240px] rounded-md z-40 border-zinc-200 dark:border-zinc-700"
                                >
                                    <Command className="rounded-md [&_[cmdk-input-wrapper]]:px-2">
                                        <CommandInput
                                            placeholder="Search dataset..."
                                            className="h-9 !py-1 !font-semibold !text-xs"
                                        />
                                        <CommandList>
                                            <CommandEmpty className="px-2 !py-2 text-left text-xs font-semibold">No dataset found.</CommandEmpty>
                                            <CommandGroup>
                                                {frameworks.map((framework) => (
                                                    <CommandItem
                                                        className="!font-semibold rounded-md !text-xs !px-2 !py-1 hover:cursor-pointer"
                                                        key={framework.id}
                                                        value={framework.db_name}
                                                        onSelect={(currentValue) => {
                                                            setValue(currentValue);
                                                            setOpen(false);

                                                            const selectedFramework = frameworks.find(
                                                                (f) => f.db_name === currentValue
                                                            );

                                                            if (selectedFramework) {
                                                                setDatabase({
                                                                    db_id: selectedFramework.id,
                                                                    db_name: selectedFramework.db_name,
                                                                    dialect: selectedFramework.dialect,
                                                                });
                                                                setQuery("");
                                                                setQueryResults(null);
                                                                setQueryTabs([]);
                                                                router.push(
                                                                    `/app/playground/play/${selectedFramework.id}`
                                                                );
                                                            }
                                                        }}
                                                    >
                                                        <div className="!text-xs !font-semibold flex items-center gap-2">
                                                            <DatabaseEngineIcon dialect={framework.dialect} size={14} />
                                                            {framework.db_name}
                                                        </div>
                                                        <FaCheck
                                                            size={12}
                                                            className={cn(
                                                                "ml-auto h-3 w-3 shrink-0",
                                                                value === framework.db_name
                                                                    ? "opacity-100"
                                                                    : "opacity-0"
                                                            )}
                                                        />
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            aria-label={`Delete ${framework.db_name}`}
                                                            title="Delete dataset"
                                                            onPointerDown={(event) => event.stopPropagation()}
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                setDatasetToDelete(framework);
                                                                setDeleteDatasetError("");
                                                                setOpenDb(false);
                                                                setDeleteDatasetOpen(true);
                                                            }}
                                                            className="ml-1 h-5 w-5 shrink-0 p-1 text-zinc-500 shadow-none hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-950 dark:hover:text-red-300"
                                                        >
                                                            <Trash2 size={14} />
                                                        </Button>
                                                    </CommandItem>
                                                ))}
                                                <CommandSeparator className="my-1" />
                                                <AlertDialog open={openAdDataSet} onOpenChange={setOpenAdDataSet}>
                                                    <AlertDialogTrigger className="w-full">
                                                        <CommandItem className="w-full !px-2 !py-1 !text-xs hover:cursor-pointer">
                                                            <div className="flex items-center gap-2 w-full">
                                                                <Plus size={14} />
                                                                <p className="!font-semibold !text-xs">Add dataset</p>
                                                            </div>
                                                        </CommandItem>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent className="z-[1000] bg-white text-zinc-900 outline-none focus:outline-none focus-visible:ring-0 dark:bg-zinc-950 dark:text-zinc-100">
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle className="text-sm font-semibold">Add new dataset</AlertDialogTitle>
                                                            <AddDatabase onClose={() => setOpenAdDataSet(false)} onSuccess={() => setOpenAdDataSet(false)}/>
                                                        </AlertDialogHeader>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                        <TooltipProvider>
                            <Button onClick={refreshDatabaseSchema} disabled={!database?.db_id || refreshingSchema} className="hover:ring-1 ring-zinc-200 dark:hover:ring-zinc-800 w-fit shadow-none h-7 p-1.5 bg-transparent text-zinc-950 hover:bg-zinc-100 dark:bg-transparent dark:text-white dark:hover:bg-zinc-900 dark:hover:text-white disabled:cursor-not-allowed disabled:opacity-50">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span>
                                            <RefreshCcw ref={schemaRefreshIconRef} size={16} />
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent className="mt-2 font-semibold border bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-100">
                                        <p>{refreshingSchema ? "Refreshing schema..." : "Refresh schema"}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </Button>
                        </TooltipProvider>
                        <TooltipProvider>
                            <Button onClick={() => setNavigationHidden(true)} aria-label="Hide navigation" className="!transition-none hover:ring-1 ring-zinc-200 dark:hover:ring-zinc-800 w-fit shadow-none h-7 p-1.5 bg-transparent text-zinc-900 hover:bg-zinc-100 dark:bg-transparent dark:text-white dark:hover:bg-zinc-900 dark:hover:text-white">
                                <Tooltip>
                                    <TooltipTrigger className="z-[10000]">
                                        <PanelRightOpen size={16} />
                                    </TooltipTrigger>
                                    <TooltipContent className="z-[99999999] mt-2 font-semibold border bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-100">
                                        <p>Hide navigator</p>
                                    </TooltipContent>
                                </Tooltip>
                            </Button>
                        </TooltipProvider>
                    </div>
                    <div className="overflow-x-scroll flex flex-col h-[100vh]">
                        <div className="h-[calc(100vh-100px)]">
                            <TablesV2 openTab={openTab} openSqlTab={openSqlTab} activeTabName={activeTabName}/>
                        </div>
                        <div className="p-3 px-4">
                            <p className="!text-xs !font-semibold text-zinc-700">Version: {packageJson.version}</p>
                        </div>
                    </div>
                </div>
                <div
                    role="separator"
                    aria-label="Resize navigation"
                    aria-orientation="vertical"
                    aria-valuemin={NAVIGATION_WIDTH_MIN}
                    aria-valuemax={NAVIGATION_WIDTH_MAX}
                    aria-valuenow={navigationWidth}
                    tabIndex={0}
                    onPointerDown={handleResizePointerDown}
                    onPointerMove={handleResizePointerMove}
                    onPointerUp={stopResize}
                    onPointerCancel={stopResize}
                    onKeyDown={(event) => {
                        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                        event.preventDefault();
                        const delta = event.key === "ArrowRight" ? 10 : -10;
                        setNavigationWidth((width) => Math.min(NAVIGATION_WIDTH_MAX, Math.max(NAVIGATION_WIDTH_MIN, width + delta)));
                    }}
                    className="absolute -right-1 top-0 z-50 h-full w-2 cursor-col-resize touch-none outline-none after:absolute after:inset-y-0 after:left-[3px] after:w-px after:bg-transparent hover:after:bg-blue-500 focus-visible:after:bg-blue-500"
                />
            </div>
            <AlertDialog open={deleteDatasetOpen} onOpenChange={(open) => {
                if (!deletingDataset) setDeleteDatasetOpen(open);
            }}>
                <AlertDialogContent className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-sm font-semibold">Delete dataset?</AlertDialogTitle>
                        <AlertDialogDescription className="text-xs font-semibold">
                            This removes “{datasetToDelete?.db_name}” and its saved connection from the workspace. The database and its data will not be deleted.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deletingDataset} className="!mt-0 h-6 border-0 bg-white p-1 px-2 text-black shadow-none ring-0 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900 !text-xs !font-semibold">Cancel</AlertDialogCancel>
                        <Button onClick={deleteDataset} disabled={deletingDataset} className="h-6 border-0 bg-red-600 p-1 px-2 text-white shadow-none ring-1 ring-red-500 hover:bg-red-700 dark:text-zinc-100 !text-xs !font-semibold">
                            {deletingDataset ? "Deleting..." : "Delete"}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

const mapStateToProps = (state) => ({
    profile: state.profile,
    database: state.database,
    databases: state.databases,
});

const mapDispatchToProps = {
    setProfile,
    setDatabases,
    setDatabase,
    setQuery,
    setTables,
    setQueryResults,
    setQueryTabs,
};

export default connect(mapStateToProps, mapDispatchToProps)(LeftBar);
