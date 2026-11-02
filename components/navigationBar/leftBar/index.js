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
import {useCallback, useEffect, useRef, useState} from "react";
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
import Image from "next/image";
import { BiExpandVertical } from "react-icons/bi";
import DatabaseEngineIcon from "@/components/databaseEngineIcon";
import { FaCheck } from "react-icons/fa6";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/base-toast";
import * as React from "react";
import { Database, PanelRightOpen, RefreshCcw, RefreshCw, Plus, Trash2 } from "lucide-react";
import LocalAvatar from "@/components/localAvatar";
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
import { useNavigationVisibility } from "@/components/navigationBar/navigationVisibility";
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

    const router = useRouter();
    const {
        navigationHidden,
        setNavigationHidden,
        setAppSettingsOpen,
        updateStatus,
        checkForUpdates,
    } = useNavigationVisibility();
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
    const sidebarRef = useRef(null);
    const resizeDragRef = useRef(null);
    const [sidebarWidth, setSidebarWidth] = useState(null);
    const [value, setValue] = React.useState("");
    const frameworks = databases;
    const compactDatabaseSelector = sidebarWidth !== null && sidebarWidth <= 300;
    const clearDatabaseState = useClear();
    const [updateDialogOpen, setUpdateDialogOpen] = useState(false);

    const handleUpdateButtonClick = async () => {
        if (updateStatus.status === "downloaded") {
            setUpdateDialogOpen(true);
            return;
        }
        if (["checking", "downloading", "installing"].includes(updateStatus.status)) return;
        if (updateStatus.status === "unsupported") {
            toast.add({ title: "Update check unavailable", description: "Update checks are available in the installed desktop app.", type: "warning" });
            return;
        }

        const result = await checkForUpdates();
        if (result.status === "available") {
            setUpdateDialogOpen(true);
        } else if (result.status === "not-available") {
            setUpdateDialogOpen(false);
            toast.add({ title: "You’re up to date", description: "You already have the latest version.", type: "success" });
        } else if (result.status === "error") {
            setUpdateDialogOpen(false);
            toast.add({ title: "Unable to check for updates", description: result.message || "Unable to check for updates.", type: "error" });
        } else if (result.status === "unsupported") {
            setUpdateDialogOpen(false);
            toast.add({ title: "Update check unavailable", description: "Update checks are available in the installed desktop app.", type: "warning" });
        }
    };

    const downloadUpdate = async () => {
        if (!window.desktopUpdates) return;
        try {
            setUpdateStatus({ status: "downloading", percent: 0 });
            await window.desktopUpdates.downloadUpdate();
        } catch (error) {
            setUpdateStatus({ status: "error", message: error.message || "Unable to download the update." });
        }
    };

    const installUpdate = async () => {
        if (!window.desktopUpdates) return;
        try {
            setUpdateStatus({ status: "installing" });
            await window.desktopUpdates.installUpdate();
        } catch (error) {
            setUpdateStatus({ status: "error", message: error.message || "Unable to install the update." });
        }
    };

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
        setProfile({ user: { id: "placedv-local-user", name: "Local user", email: "Local desktop" } });
    }, [setProfile]);

    useEffect(() => {
        const root = document.documentElement;
        const minWidth = Number.parseFloat(getComputedStyle(root).getPropertyValue("--electron-sidebar-min-width")) || 220;
        const maxWidth = Number.parseFloat(getComputedStyle(root).getPropertyValue("--electron-sidebar-max-width")) || 340;
        const defaultWidth = sidebarRef.current?.getBoundingClientRect().width || maxWidth;
        const storedWidth = Number.parseFloat(localStorage.getItem("placedv-query-sidebar-width"));
        const width = Number.isFinite(storedWidth)
            ? Math.min(maxWidth, Math.max(minWidth, storedWidth))
            : defaultWidth;

        root.style.setProperty("--electron-sidebar-width", `${width}px`);
        setSidebarWidth(width);
    }, []);

    const getSidebarWidthLimits = () => {
        const root = document.documentElement;
        return {
            min: Number.parseFloat(getComputedStyle(root).getPropertyValue("--electron-sidebar-min-width")) || 220,
            max: Number.parseFloat(getComputedStyle(root).getPropertyValue("--electron-sidebar-max-width")) || 340,
        };
    };

    const updateSidebarWidth = (width, persist = false) => {
        const { min, max } = getSidebarWidthLimits();
        const nextWidth = Math.min(max, Math.max(min, width));
        document.documentElement.style.setProperty("--electron-sidebar-width", `${nextWidth}px`);
        setSidebarWidth(nextWidth);
        if (persist) localStorage.setItem("placedv-query-sidebar-width", String(nextWidth));
    };

    const handleResizePointerDown = (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        document.documentElement.classList.add("electron-sidebar-resizing");
        resizeDragRef.current = { pointerId: event.pointerId };
    };

    const handleResizePointerMove = (event) => {
        if (resizeDragRef.current?.pointerId !== event.pointerId) return;
        const { min, max } = getSidebarWidthLimits();
        if (event.clientX <= 32) {
            resizeDragRef.current = null;
            document.documentElement.classList.remove("electron-sidebar-resizing");
            updateSidebarWidth(min, true);
            if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
            setNavigationHidden(true);
            return;
        }
        updateSidebarWidth(Math.min(max, Math.max(min, event.clientX)));
    };

    const handleResizePointerUp = (event) => {
        if (resizeDragRef.current?.pointerId !== event.pointerId) return;
        resizeDragRef.current = null;
        document.documentElement.classList.remove("electron-sidebar-resizing");
        const width = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--electron-sidebar-width"));
        if (Number.isFinite(width)) localStorage.setItem("placedv-query-sidebar-width", String(width));
        setSidebarWidth(width);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    };

    const handleResizeKeyDown = (event) => {
        const { min, max } = getSidebarWidthLimits();
        const currentWidth = sidebarWidth || sidebarRef.current?.getBoundingClientRect().width || max;
        const step = event.shiftKey ? 32 : 12;
        const nextWidth = event.key === "ArrowLeft" ? currentWidth - step
            : event.key === "ArrowRight" ? currentWidth + step
                : event.key === "Home" ? min
                    : event.key === "End" ? max
                        : null;
        if (nextWidth === null) return;
        event.preventDefault();
        updateSidebarWidth(nextWidth, true);
    };

    if (navigationHidden) return null;

    return (
        <>
            <div ref={sidebarRef} className="electron-sidebar fixed top-0 h-[100vh] w-[240px] border-r bg-zinc-50 dark:bg-zinc-900/30">
                <div
                    className="electron-sidebar-resize-handle"
                    role="separator"
                    aria-label="Resize navigation sidebar"
                    aria-orientation="vertical"
                    aria-valuemin={getSidebarWidthLimits().min}
                    aria-valuemax={getSidebarWidthLimits().max}
                    aria-valuenow={sidebarWidth || undefined}
                    tabIndex={0}
                    onPointerDown={handleResizePointerDown}
                    onPointerMove={handleResizePointerMove}
                    onPointerUp={handleResizePointerUp}
                    onPointerCancel={handleResizePointerUp}
                    onKeyDown={handleResizeKeyDown}
                />
                <div className="flex flex-col gap-2">
                    <div className="electron-titlebar-safe-left flex min-w-0 items-center justify-between gap-1 p-3 px-3">
                        <div className="flex items-center gap-1">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button aria-label="Open local profile menu" className="ml-3 mr-3 flex items-center h-6 w-6 shrink-0 rounded-full border-0 bg-transparent p-0 shadow-none hover:bg-zinc-100 dark:hover:bg-zinc-800">
                                        {profile?.user?.image ? <Image className="h-6 w-6 rounded-full border object-cover" src={profile.user.image} height={24} width={24} alt={profile?.user?.name || "Account"} unoptimized /> : <LocalAvatar size={24} />}
                                    </Button>
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
                                    </ul>
                                </PopoverContent>
                            </Popover>
                            <Popover open={openDb} onOpenChange={setOpenDb}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-label={compactDatabaseSelector ? `Select database${database?.db_name ? `: ${database.db_name}` : ""}` : undefined}
                                        title={compactDatabaseSelector ? database?.db_name || "Select database" : undefined}
                                        aria-expanded={openDb}
                                        className={`ring-1 ring-zinc-200 dark:ring-zinc-800 dark:hover:ring-zinc-800 flex min-w-0 overflow-hidden flex-row items-center ${compactDatabaseSelector ? "h-7 w-7 shrink-0 justify-center p-1.5" : "basis-[104px] shrink justify-between gap-2 px-1"} h-7 rounded-md !font-semibold border-0 shadow-none bg-transparent hover:bg-zinc-100 dark:bg-transparent dark:hover:bg-zinc-900`}
                                    >
                                        {compactDatabaseSelector ? (
                                            <Database className="h-4 w-4 shrink-0" aria-hidden="true" />
                                        ) : (
                                            <span className="min-w-0 flex-1 truncate text-left !text-xs">
                                                {value || database?.db_name || "Select dataset..."}
                                            </span>
                                        )}
                                        {!compactDatabaseSelector && <BiExpandVertical className="h-4 w-4 shrink-0" size={16} />}
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
                                                        className="!font-semibold rounded-md !text-xs !px-2 !py-1 hover:cursor-pointer flex justify-between items-center"
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
                                                        <div className="!text-xs !font-semibold flex items-center gap-2 truncate">
                                                            <DatabaseEngineIcon dialect={framework.dialect} size={14} />
                                                            <div className="truncate">{framework.db_name}</div>
                                                        </div>
                                                        <div className="flex gap-1 items-center">
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
                                                        </div>
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
                                                            <AlertDialogDescription className="text-xs font-semibold text-muted-foreground">
                                                                Connect to a database or upload a SQLite file.
                                                            </AlertDialogDescription>
                                                            <AddDatabase onClose={() => setOpenAdDataSet(false)} onSuccess={() => setOpenAdDataSet(false)}/>
                                                        </AlertDialogHeader>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                            <TooltipProvider>
                                <Button onClick={refreshDatabaseSchema} disabled={!database?.db_id || refreshingSchema} aria-label="Refresh schema" className="hover:ring-1 ring-zinc-200 dark:hover:ring-zinc-800 h-7 w-7 shrink-0 p-1.5 shadow-none bg-transparent text-zinc-950 hover:bg-zinc-100 dark:bg-transparent dark:text-white dark:hover:bg-zinc-900 dark:hover:text-white disabled:cursor-not-allowed disabled:opacity-50">
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
                        </div>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button onClick={() => setNavigationHidden(true)} aria-label="Hide navigation" className="!transition-none ml-auto hover:ring-1 ring-zinc-200 dark:hover:ring-zinc-800 h-7 w-7 shrink-0 p-1.5 shadow-none bg-transparent text-zinc-900 hover:bg-zinc-100 dark:bg-transparent dark:text-white dark:hover:bg-zinc-900 dark:hover:text-white">
                                        <PanelRightOpen size={16} />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent className="z-[99999999] mt-2 font-semibold border bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-100">
                                    <p>Hide navigator</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                    <div className="overflow-x-scroll flex flex-col h-[100vh]">
                        <div className="h-[calc(100vh-100px)]">
                            <TablesV2 openTab={openTab} openSqlTab={openSqlTab} activeTabName={activeTabName}/>
                        </div>
                        <div className="flex items-center justify-between px-4">
                            <p className="!text-xs !font-semibold text-zinc-700">Version: {packageJson.version}</p>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            type="button"
                                            aria-label={updateStatus.status === "available" ? `Update ${updateStatus.version} available` : "Check for updates"}
                                            onClick={handleUpdateButtonClick}
                                            disabled={["checking", "downloading", "installing"].includes(updateStatus.status)}
                                            className="relative h-6 w-6 border-0 bg-transparent p-1 text-zinc-600 shadow-none hover:bg-zinc-100 hover:text-zinc-950 disabled:cursor-wait dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
                                        >
                                            <RefreshCw size={15} className={updateStatus.status === "checking" ? "animate-spin" : undefined} />
                                            {updateStatus.status === "available" && (
                                                <span aria-hidden="true" className="absolute right-1 top-1 h-2 w-2 rounded-full bg-blue-500 ring-2 ring-zinc-50 dark:ring-zinc-900" />
                                            )}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent className="mt-2 border bg-white font-semibold text-zinc-950 dark:bg-zinc-950 dark:text-zinc-100">
                                        <p>{updateStatus.status === "available" ? `Version ${updateStatus.version} available — click to update` : updateStatus.status === "checking" ? "Checking for updates..." : updateStatus.status === "unsupported" ? "Update checks are available in the installed desktop app" : "Check for updates"}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    </div>
                </div>
            </div>
            <AlertDialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
                <AlertDialogContent className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-sm font-semibold">
                            {updateStatus.status === "downloaded" ? "Update ready to install" : updateStatus.status === "checking" ? "Checking for updates" : updateStatus.status === "downloading" ? "Downloading update" : updateStatus.status === "installing" ? "Installing update" : updateStatus.status === "error" ? "Update failed" : "Update available"}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-xs font-semibold">
                            {updateStatus.status === "available" && `Version ${updateStatus.version} is available. Download it now?`}
                            {updateStatus.status === "checking" && "Checking whether a newer version is available..."}
                            {updateStatus.status === "downloading" && `Downloading version ${updateStatus.version || "update"}...`}
                            {updateStatus.status === "downloaded" && `Version ${updateStatus.version} has been downloaded. Restart the app to install it.`}
                            {updateStatus.status === "installing" && "The app is restarting to complete the update."}
                            {updateStatus.status === "error" && (updateStatus.message || "The update could not be completed.")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {updateStatus.status === "downloading" && (
                        <div className="space-y-1">
                            <div className="flex justify-between text-xs font-semibold"><span>Progress</span><span>{Math.floor(updateStatus.percent || 0)}%</span></div>
                            <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(updateStatus.percent || 0)} className="h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                                <div className="h-full bg-blue-600 transition-[width]" style={{ width: `${Math.min(100, Math.max(0, updateStatus.percent || 0))}%` }} />
                            </div>
                        </div>
                    )}
                    <AlertDialogFooter>
                        {!["downloading", "installing"].includes(updateStatus.status) && (
                            <AlertDialogCancel className="!mt-0 h-7 border-0 bg-white p-1 px-2 text-black shadow-none ring-1 ring-neutral-200 hover:bg-neutral-100 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-neutral-800 dark:hover:bg-zinc-900 !text-xs !font-semibold">
                                {updateStatus.status === "downloaded" ? "Later" : "Cancel"}
                            </AlertDialogCancel>
                        )}
                        {updateStatus.status === "available" && (
                            <Button onClick={downloadUpdate} className="h-7 border-0 bg-blue-600 p-1 px-2 text-white shadow-none ring-1 ring-blue-500 hover:bg-blue-700 !text-xs !font-semibold">Download update</Button>
                        )}
                        {updateStatus.status === "downloaded" && (
                            <Button onClick={installUpdate} className="h-7 border-0 bg-blue-600 p-1 px-2 text-white shadow-none ring-1 ring-blue-500 hover:bg-blue-700 !text-xs !font-semibold">Restart and install</Button>
                        )}
                        {updateStatus.status === "installing" && <Button disabled className="h-7 border-0 bg-blue-600 p-1 px-2 text-white shadow-none !text-xs !font-semibold">Restarting...</Button>}
                        {updateStatus.status === "downloading" && <Button disabled className="h-7 border-0 bg-blue-600 p-1 px-2 text-white shadow-none !text-xs !font-semibold">Downloading...</Button>}
                        {updateStatus.status === "error" && <Button onClick={handleUpdateButtonClick} className="h-7 border-0 bg-blue-600 p-1 px-2 text-white shadow-none ring-1 ring-blue-500 hover:bg-blue-700 !text-xs !font-semibold">Check again</Button>}
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
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
