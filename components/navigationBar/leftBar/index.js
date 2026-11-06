import {
    setDatabase,
    setProfile,
    setQuery,
    setQueryResults,
    setQueryTabs,
    setTables,
    setSidebarWidth,
} from "@/redux/actions/main";
import { connect, useDispatch, useSelector } from "react-redux";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {useEffect, useRef, useState} from "react";
import axios from "axios";
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
    ComboboxSeparator,
    ComboboxTrigger,
} from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { BiExpandVertical } from "react-icons/bi";
import DatabaseEngineIcon from "@/components/databaseEngineIcon";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/base-toast";
import * as React from "react";
import { Check, CodeXml, Database, EllipsisVertical, PanelRightOpen, RefreshCcw, RefreshCw, Plus, Search } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
} from "@/components/ui/alert-dialog"
import AddDatabase from "@/components/addDatabase";
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
        setQuery,
        setQueryResults,
        setQueryTabs,
        openTab, // 👈 ARRIVA dal Playground
        openSqlTab,
        activeTabName,
        savedQueries = [],
        onDeleteSavedQuery,
    } = props;

    const router = useRouter();
    const dispatch = useDispatch();
    const {
        navigationHidden,
        setNavigationHidden,
        setAppSettingsOpen,
        updateStatus,
        setUpdateStatus,
        checkForUpdates,
    } = useNavigationVisibility();
    const [openDb, setOpenDb] = React.useState(false);
    const [databaseSearch, setDatabaseSearch] = useState("");
    const [openSavedQueryMenuId, setOpenSavedQueryMenuId] = useState(null);
    const [openAdDataSet, setOpenAdDataSet] = useState(false);
    const [refreshingSchema, setRefreshingSchema] = useState(false);
    const schemaRefreshIconRef = useRef(null);
    const schemaRefreshIconAnimationRef = useRef(null);
    const [queryToDelete, setQueryToDelete] = useState(null);
    const sidebarRef = useRef(null);
    const resizeDragRef = useRef(null);
    const sidebarWidth = useSelector((state) => state.settings.sidebarWidth);
    const frameworks = databases;
    const compactDatabaseSelector = sidebarWidth !== null && sidebarWidth <= 300;
    const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
    const downloadPercent = Math.floor(Math.min(100, Math.max(0, Number(updateStatus.percent) || 0)));

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
        if (!window.desktopUpdates?.downloadUpdate) {
            setUpdateStatus({ status: "error", message: "The desktop updater is unavailable. Restart the installed app and try again." });
            return;
        }
        try {
            setUpdateStatus({ status: "downloading", percent: 0 });
            const result = await window.desktopUpdates.downloadUpdate();
            if (result?.status === "downloaded") setUpdateStatus(result);
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

    useEffect(() => {
        setProfile({ user: { id: "placedv-local-user", name: "Local user", email: "Local desktop" } });
    }, [setProfile]);

    useEffect(() => {
        const root = document.documentElement;
        const minWidth = Number.parseFloat(getComputedStyle(root).getPropertyValue("--electron-sidebar-min-width")) || 220;
        const maxWidth = Number.parseFloat(getComputedStyle(root).getPropertyValue("--electron-sidebar-max-width")) || 340;
        const defaultWidth = sidebarRef.current?.getBoundingClientRect().width || maxWidth;
        const width = Number.isFinite(sidebarWidth)
            ? Math.min(maxWidth, Math.max(minWidth, sidebarWidth))
            : defaultWidth;

        root.style.setProperty("--electron-sidebar-width", `${width}px`);
        if (sidebarWidth !== width) dispatch(setSidebarWidth(width));
    }, [sidebarWidth, dispatch]);

    const getSidebarWidthLimits = () => {
        const root = document.documentElement;
        return {
            min: Number.parseFloat(getComputedStyle(root).getPropertyValue("--electron-sidebar-min-width")) || 220,
            max: Number.parseFloat(getComputedStyle(root).getPropertyValue("--electron-sidebar-max-width")) || 340,
        };
    };

    const updateSidebarWidth = (width) => {
        const { min, max } = getSidebarWidthLimits();
        const nextWidth = Math.min(max, Math.max(min, width));
        document.documentElement.style.setProperty("--electron-sidebar-width", `${nextWidth}px`);
        dispatch(setSidebarWidth(nextWidth));
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
            updateSidebarWidth(min);
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
        if (Number.isFinite(width)) dispatch(setSidebarWidth(width));
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
        updateSidebarWidth(nextWidth);
    };

    const hasSelectedDatabase = Object.keys(database ?? {}).length > 0;

    if (navigationHidden) return null;

    return (
        <>
            <div ref={sidebarRef} className="electron-sidebar fixed top-0 h-[100vh] w-[240px] border-r bg-zinc-50 dark:bg-zinc-900/30">
                <div
                    className="electron-sidebar-resize-handle"
                    role="slider"
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
                        <div className="flex min-w-0 flex-1 items-center gap-1">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button aria-label="Open local profile menu" className="ml-3 mr-1 flex items-center h-6 w-6 shrink-0 rounded-full border-0 bg-transparent p-0 shadow-none hover:bg-zinc-100 dark:hover:bg-zinc-800">
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
                            <Combobox
                                open={openDb}
                                onOpenChange={(open) => {
                                    setOpenDb(open);
                                    if (open) setDatabaseSearch("");
                                }}
                                items={frameworks}
                                inputValue={databaseSearch}
                                onInputValueChange={setDatabaseSearch}
                                value={frameworks.find((item) => item.id === database?.db_id) ?? null}
                                itemToStringValue={(item) => item?.db_name ?? ""}
                                itemToStringLabel={(item) => item?.db_name ?? ""}
                                isItemEqualToValue={(item, selected) => item?.id === selected?.id}
                                onValueChange={(selectedFramework) => {
                                    if (!selectedFramework) return;
                                    setDatabaseSearch("");
                                    setDatabase({
                                        db_id: selectedFramework.id,
                                        db_name: selectedFramework.db_name,
                                        dialect: selectedFramework.dialect,
                                    });
                                    setQuery("");
                                    setQueryResults(null);
                                    setQueryTabs([]);
                                    router.push(`/app/playground/play/${selectedFramework.id}`);
                                }}
                            >
                                <ComboboxTrigger
                                    render={
                                        <Button
                                            variant="outline"
                                            aria-label={compactDatabaseSelector ? `Select database${database?.db_name ? `: ${database.db_name}` : ""}` : undefined}
                                            title={compactDatabaseSelector ? database?.db_name || "Select database" : undefined}
                                            className={`ring-1 ring-zinc-200 dark:ring-zinc-800 dark:hover:ring-zinc-800 flex min-w-0 overflow-hidden flex-row items-center ${compactDatabaseSelector ? "h-7 w-7 ring-0 hover:ring-1 shrink-0 justify-center p-1.5" : "min-w-0 flex-1"} h-7 rounded-md !font-semibold border-0 shadow-none bg-transparent hover:bg-zinc-100 dark:bg-transparent dark:hover:bg-zinc-900`}
                                        >
                                            {compactDatabaseSelector ? (
                                                <Database className="h-4 w-4 shrink-0" aria-hidden="true" />
                                            ) : (
                                                <div className="min-w-0 flex-1 truncate text-left !text-xs !font-semibold">
                                                    {database?.db_name || "Select dataset..."}
                                                </div>
                                            )}
                                            {!compactDatabaseSelector && <BiExpandVertical className="h-4 w-4 shrink-0" size={16} />}
                                        </Button>
                                    }
                                />
                                <ComboboxContent className="p-0">
                                    <div className="flex items-center border-b border-zinc-200 px-2 dark:border-zinc-800">
                                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
                                        <ComboboxInput placeholder="Search dataset..." className="h-9 !px-0 !py-1 !font-semibold !text-xs" />
                                    </div>
                                    <ComboboxEmpty>No dataset found.</ComboboxEmpty>
                                    <ComboboxList>
                                        {(framework) => (
                                            <ComboboxItem key={framework.id} value={framework} className="!justify-between !px-2 !py-1">
                                                <div className="flex min-w-0 items-center gap-2 truncate">
                                                    <DatabaseEngineIcon dialect={framework.dialect} size={14} />
                                                    <span className="truncate">{framework.db_name}</span>
                                                </div>
                                                <Check
                                                    size={12}
                                                    className={cn("ml-auto h-3 w-3 shrink-0", framework.id === database?.db_id ? "opacity-100" : "opacity-0")}
                                                />
                                            </ComboboxItem>
                                        )}
                                    </ComboboxList>
                                    <ComboboxSeparator />
                                    <div className="p-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setOpenDb(false);
                                                setOpenAdDataSet(true);
                                            }}
                                            className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                        >
                                            <Plus size={14} />
                                            <span>Add dataset</span>
                                        </button>
                                    </div>
                                </ComboboxContent>
                            </Combobox>
                            <AlertDialog open={openAdDataSet} onOpenChange={setOpenAdDataSet}>
                                <AlertDialogContent className="z-[1000] bg-white text-zinc-900 outline-none focus:outline-none focus-visible:ring-0 dark:bg-zinc-950 dark:text-zinc-100">
                                    <AlertDialogHeader>
                                        <AlertDialogTitle className="text-sm font-semibold">Add new dataset</AlertDialogTitle>
                                        <AlertDialogDescription className="text-xs font-semibold text-muted-foreground">
                                            Connect to a database or upload a SQLite file.
                                        </AlertDialogDescription>
                                        <AddDatabase onClose={() => setOpenAdDataSet(false)} onSuccess={() => setOpenAdDataSet(false)} />
                                    </AlertDialogHeader>
                                </AlertDialogContent>
                            </AlertDialog>
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
                        {!hasSelectedDatabase
                            ? <div className="h-[calc(100vh-100px)]">
                            </div>
                            : <div className="h-[calc(100vh-100px)]">
                                <Tabs defaultValue="tables">
                                    <div className="px-4">
                                        <TabsList className="h-7 p-0.5">
                                            <TabsTrigger value="tables" className="font-semibold text-xs w-full">Tables</TabsTrigger>
                                            <TabsTrigger value="queries" className="font-semibold text-xs w-full">Queries</TabsTrigger>
                                        </TabsList>
                                    </div>
                                    <TabsContent value="tables">
                                        <TablesV2 openTab={openTab} openSqlTab={openSqlTab} activeTabName={activeTabName}/>
                                    </TabsContent>
                                    <TabsContent value="queries">
                                        {savedQueries.length === 0 ? (
                                            <p className="px-6 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400">No saved queries yet.</p>
                                        ) : (
                                            <ul className="px-4 py-2 pt-0 flex flex-col gap-0.5 relative mt-1">
                                                {savedQueries.map((savedQuery) => {
                                                    const isMenuOpen = openSavedQueryMenuId === savedQuery.id;
                                                    const openQuery = () => openSqlTab(savedQuery.query);
                                                    return (
                                                        <div
                                                            key={savedQuery.id}
                                                            role="button"
                                                            tabIndex={0}
                                                            onKeyDown={(event) => {
                                                                if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                                                                    event.preventDefault();
                                                                    openQuery();
                                                                }
                                                            }}
                                                            onClick={openQuery}
                                                            className={cn(
                                                                "group flex flex-row items-center justify-between px-2.5 py-1 rounded-md text-xs font-semibold transition hover:cursor-pointer",
                                                                "hover:bg-zinc-200 dark:hover:bg-zinc-900",
                                                                isMenuOpen && "bg-zinc-100 dark:bg-zinc-900"
                                                            )}
                                                        >
                                                            <div className="flex min-w-0 flex-row items-center gap-3">
                                                                <CodeXml size={12} className="shrink-0" />
                                                                <p className="!text-xs !font-semibold truncate">{savedQuery.name}</p>
                                                            </div>
                                                            <DropdownMenu
                                                                open={isMenuOpen}
                                                                onOpenChange={(open) => setOpenSavedQueryMenuId(open ? savedQuery.id : null)}
                                                            >
                                                                <DropdownMenuTrigger asChild>
                                                                    <button
                                                                        type="button"
                                                                        aria-label={`Actions for ${savedQuery.name}`}
                                                                        onClick={(event) => event.stopPropagation()}
                                                                        onPointerDown={(event) => event.stopPropagation()}
                                                                        className="relative opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 transition-opacity p-1 rounded-md"
                                                                    >
                                                                        <EllipsisVertical size={12} />
                                                                    </button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="start" side="right" className="z-[10000] w-[200px] border border-neutral-200 dark:border-neutral-700">
                                                                    <DropdownMenuItem
                                                                        className="text-xs font-semibold hover:cursor-pointer"
                                                                        onClick={(event) => {
                                                                            event.stopPropagation();
                                                                            openQuery();
                                                                        }}
                                                                    >
                                                                        Open query in SQL editor
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem
                                                                        className="text-xs font-semibold hover:cursor-pointer"
                                                                        onClick={(event) => {
                                                                            event.stopPropagation();
                                                                            window.navigator.clipboard.writeText(savedQuery.query)
                                                                                .then(() => toast.add({ title: "Query copied", type: "success" }))
                                                                                .catch(() => toast.add({ title: "Unable to copy query", type: "error" }));
                                                                        }}
                                                                    >
                                                                        Copy query
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem
                                                                        className="text-xs font-semibold text-red-600 hover:cursor-pointer focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                                                                        onClick={(event) => {
                                                                            event.stopPropagation();
                                                                            setQueryToDelete(savedQuery);
                                                                        }}
                                                                    >
                                                                        Delete query
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </div>
                                                    );
                                                })}
                                            </ul>
                                        )}
                                    </TabsContent>
                                </Tabs>
                            </div>
                        }
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
                    <AlertDialogFooter>
                        {!["downloading", "installing"].includes(updateStatus.status) && (
                            <AlertDialogCancel className="!mt-0 h-7 border-0 bg-white p-1 px-2 text-black shadow-none ring-1 ring-neutral-200 hover:bg-neutral-100 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-neutral-800 dark:hover:bg-zinc-900 !text-xs !font-semibold">
                                {updateStatus.status === "downloaded" ? "Later" : "Cancel"}
                            </AlertDialogCancel>
                        )}
                        {updateStatus.status === "available" && (
                            <Button type="button" onClick={downloadUpdate} className="flex h-6 items-center gap-1 border-0 bg-blue-600 p-1 px-2 text-white shadow-none ring-1 ring-blue-500 hover:bg-blue-700 dark:text-zinc-100 !text-xs !font-semibold">Download update</Button>
                        )}
                        {updateStatus.status === "downloaded" && (
                            <Button type="button" onClick={installUpdate} className="flex h-6 items-center gap-1 border-0 bg-blue-600 p-1 px-2 text-white shadow-none ring-1 ring-blue-500 hover:bg-blue-700 dark:text-zinc-100 !text-xs !font-semibold">Restart and install</Button>
                        )}
                        {updateStatus.status === "installing" && <Button disabled className="flex h-6 items-center gap-1 border-0 bg-blue-600 p-1 px-2 text-white shadow-none ring-1 ring-blue-500 dark:text-zinc-100 !text-xs !font-semibold">Restarting...</Button>}
                        {updateStatus.status === "downloading" && <Button type="button" disabled className="flex h-6 items-center gap-1 border-0 bg-blue-600 p-1 px-2 text-white shadow-none ring-1 ring-blue-500 dark:text-zinc-100 !text-xs !font-semibold">Downloading... {downloadPercent}%</Button>}
                        {updateStatus.status === "error" && <Button type="button" onClick={handleUpdateButtonClick} className="flex h-6 items-center gap-1 border-0 bg-blue-600 p-1 px-2 text-white shadow-none ring-1 ring-blue-500 hover:bg-blue-700 dark:text-zinc-100 !text-xs !font-semibold">Check again</Button>}
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={Boolean(queryToDelete)} onOpenChange={(open) => {
                if (!open) setQueryToDelete(null);
            }}>
                <AlertDialogContent className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-sm font-semibold">Delete saved query?</AlertDialogTitle>
                        <AlertDialogDescription className="text-xs font-semibold">
                            Delete “{queryToDelete?.name}” from the saved queries on this device?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="!mt-0 h-6 border-0 bg-white p-1 px-2 text-black shadow-none ring-0 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900 !text-xs !font-semibold">
                            Cancel
                        </AlertDialogCancel>
                        <Button
                            type="button"
                            onClick={() => {
                                if (queryToDelete) onDeleteSavedQuery?.(queryToDelete.id, queryToDelete.databaseId);
                                setQueryToDelete(null);
                            }}
                            className="h-6 border-0 bg-red-600 p-1 px-2 text-white shadow-none ring-1 ring-red-500 hover:bg-red-700 !text-xs !font-semibold"
                        >
                            Delete
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
    setDatabase,
    setQuery,
    setTables,
    setQueryResults,
    setQueryTabs,
};

export default connect(mapStateToProps, mapDispatchToProps)(LeftBar);
