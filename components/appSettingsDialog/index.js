import { useEffect, useRef, useState } from "react";
import { connect } from "react-redux";
import { useTheme } from "next-themes";
import axios from "axios";
import useLogout from "@/lib/logout";
import { setDatabase, setProfile } from "@/redux/actions/main";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useNavigationVisibility } from "@/components/navigationBar/navigationVisibility";
import { Check, ChevronDown, Computer, Copy, Database, Download, EyeOff, Languages, Menu, Moon, RefreshCw, Search, Shield, Trash2, X } from "lucide-react";
import { toast } from "@/components/ui/base-toast";
import { disableAnalytics, enableAnalytics, isAnalyticsConfigured, isAnalyticsEnabled, isAnalyticsEnvironmentAllowed } from "@/lib/analytics";

function formatByteSize(bytes) {
    if (!Number.isFinite(bytes)) return "Unknown";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
    }
    return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(size)} ${units[unitIndex]}`;
}

function AppSettingsDialog({ profile, setProfile, setDatabase, database, tables, queryTabs = [], open = false, onOpenChange = () => {} }) {
    const databaseId = database?.db_id;
    const logout = useLogout();
    const currentDatabaseId = useRef(databaseId);
    currentDatabaseId.current = databaseId;
    const { theme, setTheme } = useTheme();
    const { navigationHidden, setNavigationHidden } = useNavigationVisibility();
    const [activeSection, setActiveSection] = useState("appearance");
    const [browserLocale, setBrowserLocale] = useState("en-US");
    const [value, setValue] = useState("");
    const [qrcode, setQrcode] = useState({});
    const [status, setStatus] = useState(profile?.user?.is2FAEnabled);
    const [loading, setLoading] = useState(false);
    const [twoFAAction, setTwoFAAction] = useState(null);
    const [twoFACode, setTwoFACode] = useState("");
    const [, setTwoFAError] = useState("");
    const [databasePreferences, setDatabasePreferences] = useState({ pageSize: 50, sensitiveColumns: [] });
    const [loadedSchema, setLoadedSchema] = useState({ databaseId: null, data: [] });
    const [schemaLoading, setSchemaLoading] = useState(false);
    const [schemaError, setSchemaError] = useState("");
    const [sensitiveColumnSearch, setSensitiveColumnSearch] = useState("");
    const [preferencesLoading, setPreferencesLoading] = useState(false);
    const [, setPreferencesError] = useState("");
    const [computerInfo, setComputerInfo] = useState(null);
    const [computerInfoLoading, setComputerInfoLoading] = useState(false);
    const [computerInfoError, setComputerInfoError] = useState("");
    const [updateInfo, setUpdateInfo] = useState(null);
    const [updateStatus, setUpdateStatus] = useState({ status: "idle" });
    const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
    const [analyticsSaving, setAnalyticsSaving] = useState(false);
    const [analyticsEnvironmentAllowed, setAnalyticsEnvironmentAllowed] = useState(null);
    const [accountDeleteOpen, setAccountDeleteOpen] = useState(false);
    const [accountConfirmation, setAccountConfirmation] = useState("");
    const [accountDeleteCode, setAccountDeleteCode] = useState("");
    const [, setAccountDeleteError] = useState("");
    const [accountDeleteLoading, setAccountDeleteLoading] = useState(false);
    const preferencesRef = useRef(databasePreferences);
    const copySqlitePath = async (sqlitePath) => {
        if (!sqlitePath) return;
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(sqlitePath);
            } else {
                const temporaryInput = document.createElement("textarea");
                temporaryInput.value = sqlitePath;
                temporaryInput.style.position = "fixed";
                temporaryInput.style.opacity = "0";
                document.body.appendChild(temporaryInput);
                temporaryInput.select();
                const copied = document.execCommand("copy");
                temporaryInput.remove();
                if (!copied) throw new Error("Clipboard access is unavailable.");
            }
            toast.add({ title: "SQLite path copied", type: "success" });
        } catch {
            toast.add({ title: "Unable to copy SQLite path", type: "error" });
        }
    };
    const sections = [
        { id: "appearance", label: "Appearance", icon: Moon },
        { id: "language", label: "Language & region", icon: Languages },
        { id: "navigation", label: "Navigation & Accessibility", icon: Menu },
        { id: "sensitive", label: "Sensitive data", icon: EyeOff },
        { id: "database", label: "Database preferences", icon: Database },
        { id: "updates", label: "Updates", icon: RefreshCw },
        { id: "analytics", label: "Privacy & analytics", icon: Shield },
        { id: "computer", label: "Computer", icon: Computer },
    ];
    const reduxSchemaIsCurrent = String(tables?._databaseId ?? "") === String(databaseId ?? "") && Array.isArray(tables?.data);
    const queryTabSchemaTables = (queryTabs || [])
        .filter((tab) => tab.type === "table" && String(tab.id ?? "") === String(databaseId ?? "") && tab.name && Array.isArray(tab.schema))
        .map((tab) => ({ tableName: tab.name, details: { columns: tab.schema } }));
    const schemaTables = reduxSchemaIsCurrent && tables.data.length
        ? tables.data
        : String(loadedSchema.databaseId ?? "") === String(databaseId ?? "") && loadedSchema.data.length
            ? loadedSchema.data
            : queryTabSchemaTables;
    const sensitiveColumns = [...new Set(schemaTables.flatMap((table) =>
        (table.details?.columns || []).map((column) => column.field).filter(Boolean)
    ))].sort((a, b) => a.localeCompare(b));
    const filteredSensitiveColumns = sensitiveColumns.filter((column) =>
        column.toLowerCase().includes(sensitiveColumnSearch.trim().toLowerCase())
    );
    useEffect(() => {
        preferencesRef.current = databasePreferences;
    }, [databasePreferences]);

    useEffect(() => {
        if (typeof navigator !== "undefined") {
            setBrowserLocale(navigator.language || "en-US");
        }
    }, []);

    useEffect(() => {
        if (!open || activeSection !== "computer") return undefined;
        let cancelled = false;
        setComputerInfoLoading(true);
        setComputerInfoError("");
        axios.get("/api/desktop/info")
            .then(({ data }) => { if (!cancelled) setComputerInfo(data); })
            .catch((error) => {
                if (!cancelled) setComputerInfoError(error.response?.data?.error || "Unable to load computer information.");
            })
            .finally(() => { if (!cancelled) setComputerInfoLoading(false); });
        return () => { cancelled = true; };
    }, [open, activeSection]);

    useEffect(() => {
        if (!open || activeSection !== "updates" || typeof window === "undefined") return undefined;
        if (!window.desktopUpdates) {
            setUpdateStatus({ status: "unsupported" });
            return undefined;
        }
        let cancelled = false;
        const unsubscribe = window.desktopUpdates.onStatus((nextStatus) => {
            if (!cancelled) setUpdateStatus(nextStatus);
        });
        window.desktopUpdates.getInfo()
            .then((info) => {
                if (!cancelled) {
                    setUpdateInfo(info);
                    if (!info.supported) setUpdateStatus({ status: "unsupported" });
                }
            })
            .catch((error) => {
                if (!cancelled) setUpdateStatus({ status: "error", message: error.message || "Unable to load update information." });
            });
        return () => {
            cancelled = true;
            unsubscribe?.();
        };
    }, [open, activeSection]);

    useEffect(() => {
        if (!open || activeSection !== "analytics" || typeof window === "undefined") return;
        setAnalyticsEnabled(isAnalyticsEnabled());
        isAnalyticsEnvironmentAllowed().then(setAnalyticsEnvironmentAllowed);
    }, [open, activeSection]);

    const changeAnalyticsPreference = async (enabled) => {
        if (!isAnalyticsConfigured()) return;
        setAnalyticsSaving(true);
        try {
            if (enabled) {
                const enabledSuccessfully = await enableAnalytics();
                if (!enabledSuccessfully) return;
                setAnalyticsEnabled(true);
                window.dispatchEvent(new Event("placedv-analytics-consent-changed"));
            } else {
                await disableAnalytics();
                setAnalyticsEnabled(false);
                window.dispatchEvent(new Event("placedv-analytics-consent-changed"));
            }
        } catch {
            toast.add({
                title: "Unable to update analytics preference",
                description: "Your current setting has not been changed.",
                type: "error",
            });
        } finally {
            setAnalyticsSaving(false);
        }
    };

    const checkForUpdates = async () => {
        if (["checking", "downloading", "installing"].includes(updateStatus.status)) {
            toast.add({ title: "Update operation in progress", description: "Wait for the current update operation to finish.", type: "warning" });
            return;
        }
        if (updateStatus.status === "downloaded") {
            toast.add({ title: "Update ready to install", description: "Restart the app to finish installing the downloaded update.", type: "warning" });
            return;
        }
        if (!window.desktopUpdates || !updateInfo?.supported) {
            setUpdateStatus({ status: "unsupported" });
            toast.add({ title: "Update check unavailable", description: "In-app updates are available in the installed desktop app.", type: "warning" });
            return;
        }
        setUpdateStatus({ status: "checking" });
        try {
            const result = await window.desktopUpdates.checkForUpdates();
            setUpdateStatus(result);
            if (result.status === "available") {
                toast.add({ title: "Update available", description: `Version ${result.version} is ready to download.`, type: "success" });
            } else if (result.status === "not-available") {
                toast.add({ title: "You’re up to date", description: "You already have the latest version.", type: "success" });
            } else if (result.status === "unsupported") {
                toast.add({ title: "Update check unavailable", description: "In-app updates are available in the installed desktop app.", type: "warning" });
            }
        } catch (error) {
            const message = error.message || "Unable to check for updates.";
            setUpdateStatus({ status: "error", message });
            toast.add({ title: "Unable to check for updates", description: message, type: "error" });
        }
    };

    const downloadUpdate = async () => {
        setUpdateStatus({ status: "downloading", percent: 0 });
        try {
            await window.desktopUpdates.downloadUpdate();
        } catch (error) {
            setUpdateStatus({ status: "error", message: error.message || "Unable to download the update." });
        }
    };

    const installUpdate = async () => {
        setUpdateStatus({ status: "installing" });
        try {
            await window.desktopUpdates.installUpdate();
        } catch (error) {
            setUpdateStatus({ status: "error", message: error.message || "Unable to install the update." });
        }
    };

    useEffect(() => {
        let cancelled = false;
        if (!databaseId) {
            setDatabasePreferences({ pageSize: 50, sensitiveColumns: [] });
            setPreferencesError("");
            return () => { cancelled = true; };
        }
        setPreferencesLoading(true);
        setPreferencesError("");
        axios.get(`/api/database/${encodeURIComponent(databaseId)}/preferences`)
            .then(({ data }) => {
                if (cancelled || currentDatabaseId.current !== databaseId) return;
                setDatabasePreferences(data);
                preferencesRef.current = data;
                setDatabase({ db_id: databaseId, preferences: data });
            })
            .catch((error) => {
                if (!cancelled) {
                    const message = error.response?.data?.error || "Unable to load database preferences.";
                    setPreferencesError(message);
                    toast.add({ title: "Unable to load database preferences", description: message, type: "error" });
                }
            })
            .finally(() => { if (!cancelled) setPreferencesLoading(false); });
        return () => { cancelled = true; };
    }, [databaseId, setDatabase]);

    useEffect(() => {
        if (!open || activeSection !== "sensitive" || !databaseId || (reduxSchemaIsCurrent && tables.data.length)) return undefined;
        let cancelled = false;
        setSchemaLoading(true);
        setSchemaError("");
        axios.get(`/api/playground/db/table?db_id=${encodeURIComponent(databaseId)}`)
            .then(({ data }) => {
                if (cancelled || currentDatabaseId.current !== databaseId) return;
                setLoadedSchema({ databaseId, data: Array.isArray(data?.data) ? data.data : [] });
            })
            .catch((error) => {
                if (!cancelled) setSchemaError(error.response?.data?.error || error.response?.data?.message || "Unable to load database schema.");
            })
            .finally(() => { if (!cancelled) setSchemaLoading(false); });
        return () => { cancelled = true; };
    }, [open, activeSection, databaseId, reduxSchemaIsCurrent, tables?.data?.length]);

    const updateDatabasePreferences = (updates) => {
        if (!databaseId) return;
        const previousPreferences = preferencesRef.current;
        const nextPreferences = { ...previousPreferences, ...updates };
        preferencesRef.current = nextPreferences;
        setDatabasePreferences(nextPreferences);
        setDatabase({ db_id: databaseId, preferences: nextPreferences });
        setPreferencesError("");
        axios.patch(`/api/database/${encodeURIComponent(databaseId)}/preferences`, nextPreferences)
            .then(({ data }) => {
                if (currentDatabaseId.current !== databaseId) return;
                preferencesRef.current = data;
                setDatabasePreferences(data);
                setDatabase({ db_id: databaseId, preferences: data });
            })
            .catch((error) => {
                if (currentDatabaseId.current !== databaseId) return;
                preferencesRef.current = previousPreferences;
                setDatabasePreferences(previousPreferences);
                setDatabase({ db_id: databaseId, preferences: previousPreferences });
                setPreferencesError(error.response?.data?.error || "Unable to save database preferences.");
                toast.add({ title: "Unable to save database preferences", description: error.response?.data?.error || "Unable to save database preferences.", type: "error" });
            });
    };

    const updateStatus2FA = async (newStatus) => {
        setLoading(true);
        setTwoFAError("");
        try {
            await axios.post("/api/2fa/status", { status: newStatus, token: twoFACode });
            toast.add({ title: newStatus ? "Two-factor authentication enabled" : "Two-factor authentication disabled", type: "success" });
            setStatus(newStatus);
            setProfile({ ...profile, user: { ...profile.user, is2FAEnabled: newStatus } });
            setTwoFAAction(null);
            setTwoFACode("");
            await logout();
        } catch (error) {
            const message = error.response?.data?.message || "Unable to update two-factor authentication.";
            setTwoFAError(message);
            toast.add({ title: "Unable to update two-factor authentication", description: message, type: "error" });
        } finally {
            setLoading(false);
        }
    };

    const fetch2FASetUp = () => {
        setQrcode({});
        setValue("");
        axios.post("/api/2fa/setup").then((res) => setQrcode(res.data)).catch((error) => {
            const message = error.response?.data?.message || "Unable to start two-factor setup.";
            setTwoFAError(message);
            toast.add({ title: "Unable to start setup", description: message, type: "error" });
        });
    };

    const verifyCode2fa = () => {
        setLoading(true);
        axios.post("/api/2fa/verify", { token: value })
            .then(() => logout())
            .catch((error) => {
                const message = error.response?.data?.message || "Unable to verify the code.";
                setTwoFAError(message);
                toast.add({ title: "Code verification failed", description: message, type: "error" });
            })
            .finally(() => setLoading(false));
    };

    const deleteAccount = async () => {
        setAccountDeleteLoading(true);
        setAccountDeleteError("");
        try {
            await axios.delete("/api/user/account", {
                data: {
                    confirmation: accountConfirmation,
                    code: accountDeleteCode,
                },
            });
            toast.add({ title: "Account deleted", description: "Your account was deleted.", type: "success" });
            setAccountDeleteOpen(false);
            await logout();
        } catch (error) {
            const message = error.response?.data?.error || "Unable to delete account.";
            setAccountDeleteError(message);
            toast.add({ title: "Unable to delete account", description: message, type: "error" });
        } finally {
            setAccountDeleteLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="grid h-[500px] w-[800px] max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] grid-cols-[255px_minmax(0,1fr)] gap-0 overflow-hidden p-0">
                <DialogTitle className="sr-only">Application settings</DialogTitle>
                <DialogDescription className="sr-only">
                    Manage database preferences, account settings, and navigation options.
                </DialogDescription>
                <aside className="h-full bg-neutral-100 p-2 dark:bg-neutral-900">
                    <nav aria-label="Settings sections" className="space-y-1">
                        {sections.map(({ id, label, icon: Icon }) => (
                            <button
                                key={id}
                                type="button"
                                aria-current={activeSection === id ? "page" : undefined}
                                onClick={() => setActiveSection(id)}
                                className={`flex h-7 w-full items-center gap-2 rounded-lg px-2 py-0 text-left !text-xs !font-semibold hover:bg-neutral-200 dark:hover:bg-neutral-800 ${activeSection === id ? "bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100" : "text-neutral-600 dark:text-neutral-400"}`}
                            >
                                <Icon size={14} />
                                {label}
                            </button>
                        ))}
                    </nav>
                </aside>
                <main className="h-full overflow-y-auto p-6 text-left">
                    {activeSection === "analytics" ? (
                        <section className="space-y-4 text-left">
                            <div className="space-y-1">
                                <h2 className="text-sm font-semibold">Privacy &amp; analytics</h2>
                                <p className="text-xs font-semibold text-muted-foreground">Choose whether to share basic usage analytics to help improve Placedv Query.</p>
                            </div>
                            {isAnalyticsConfigured() ? (
                                <div className="flex items-start justify-between gap-4 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
                                    <div className="space-y-1">
                                        <p className="text-xs font-semibold">Share usage analytics</p>
                                        <p className="max-w-[440px] text-xs font-semibold leading-relaxed text-muted-foreground">
                                            When enabled, PostHog US receives a pseudonymous analytics ID and events for app opens, broad screen categories, and successful queries, with basic app/device context. It never receives database names, SQL, connection strings, or table and row contents. Automatic click tracking, page URLs, and session recordings are disabled. PostHog receives your IP address and may derive approximate location from it. You can turn this off at any time.
                                        </p>
                                        {analyticsEnvironmentAllowed === false && <p className="text-xs font-semibold text-muted-foreground">Analytics are disabled in development builds and on localhost.</p>}
                                    </div>
                                    <Switch
                                        aria-label="Share usage analytics"
                                        checked={analyticsEnabled}
                                        disabled={analyticsSaving || (analyticsEnvironmentAllowed !== true && !analyticsEnabled)}
                                        onCheckedChange={changeAnalyticsPreference}
                                        className="shrink-0 shadow-none"
                                    />
                                </div>
                            ) : (
                                <p className="rounded-lg border border-neutral-200 p-3 text-xs font-semibold text-muted-foreground dark:border-neutral-800">
                                    Usage analytics are not configured for this build.
                                </p>
                            )}
                        </section>
                    ) : activeSection === "updates" ? (
                        <section className="space-y-4 text-left">
                            <div className="space-y-1">
                                <h2 className="text-sm font-semibold">Updates</h2>
                                <p className="text-xs font-semibold text-muted-foreground">Check for and install the latest version of Placedv Query.</p>
                            </div>
                            <div className="flex items-center justify-between gap-4 rounded-lg border border-neutral-200 px-3 py-2 dark:border-neutral-800">
                                <span className="text-xs font-semibold text-muted-foreground">Installed version</span>
                                <span className="text-xs font-semibold">{updateInfo?.version || "Loading..."}</span>
                            </div>
                            {updateStatus.status === "unsupported" ? (
                                <p className="text-xs font-semibold text-muted-foreground">In-app updates are available in the installed desktop app.</p>
                            ) : updateStatus.status === "available" ? (
                                <div className="space-y-3">
                                    <p className="text-xs font-semibold">Version {updateStatus.version} is available.</p>
                                    <Button type="button" onClick={downloadUpdate} className="h-7 gap-1.5 bg-blue-600 px-3 !text-xs !font-semibold text-white hover:bg-blue-700">
                                        <Download size={13} /> Download update
                                    </Button>
                                </div>
                            ) : updateStatus.status === "downloading" ? (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-semibold"><span>Downloading update...</span><span>{Math.floor(updateStatus.percent || 0)}%</span></div>
                                    <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(updateStatus.percent || 0)} className="h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                                        <div className="h-full bg-blue-600 transition-[width]" style={{ width: `${Math.min(100, Math.max(0, updateStatus.percent || 0))}%` }} />
                                    </div>
                                </div>
                            ) : updateStatus.status === "downloaded" ? (
                                <div className="space-y-3">
                                    <p className="flex items-center gap-1.5 text-xs font-semibold"><Check size={14} className="text-green-600" />Version {updateStatus.version} is ready to install.</p>
                                    <Button type="button" onClick={installUpdate} className="h-7 bg-blue-600 px-3 !text-xs !font-semibold text-white hover:bg-blue-700">Restart and install</Button>
                                </div>
                            ) : updateStatus.status === "not-available" ? (
                                <p className="flex items-center gap-1.5 text-xs font-semibold"><Check size={14} className="text-green-600" />You’re up to date.</p>
                            ) : updateStatus.status === "error" ? (
                                <p role="alert" className="text-xs font-semibold text-red-600">{updateStatus.message || "Unable to check for updates."}</p>
                            ) : updateStatus.status === "installing" ? (
                                <p className="text-xs font-semibold text-muted-foreground">Restarting to install the update...</p>
                            ) : updateStatus.status === "checking" ? (
                                <p className="text-xs font-semibold text-muted-foreground">Checking for updates...</p>
                            ) : updateStatus.status === "idle" || updateStatus.status === "cancelled" ? (
                                <p className="text-xs font-semibold text-muted-foreground">{updateInfo ? "Check for a newer release." : "Loading update information..."}</p>
                            ) : null}
                            <Button
                                type="button"
                                onClick={checkForUpdates}
                                className="h-7 gap-1.5 bg-blue-600 px-3 !text-xs !font-semibold text-white hover:bg-blue-700"
                            >
                                <RefreshCw size={13} /> Check for updates
                            </Button>
                        </section>
                    ) : activeSection === "computer" ? (
                        <section className="space-y-4 text-left">
                            <div className="space-y-1">
                                <h2 className="text-sm font-semibold">Computer information</h2>
                                <p className="text-xs font-semibold text-muted-foreground">System details for this local installation.</p>
                            </div>
                            {computerInfoLoading ? (
                                <p className="text-xs font-semibold text-muted-foreground">Loading computer information...</p>
                            ) : computerInfoError ? (
                                <p role="alert" className="text-xs font-semibold text-red-600">{computerInfoError}</p>
                            ) : computerInfo ? (
                                <dl className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
                                    {[
                                        ["Operating system", computerInfo.operatingSystem],
                                        ["Version", computerInfo.osVersion],
                                        ["Architecture", computerInfo.architecture],
                                        ["Computer name", computerInfo.computerName],
                                        ["Application", computerInfo.appVersion],
                                        ["Available storage", formatByteSize(computerInfo.availableDiskBytes)],
                                        ["SQLite database size", formatByteSize(computerInfo.sqliteFileSizeBytes)],
                                        ["SQLite database path", computerInfo.sqlitePath],
                                    ].map(([label, value]) => (
                                        <div key={label} className="flex items-start justify-between gap-4 px-3 py-2">
                                            <dt className="shrink-0 text-xs font-semibold text-muted-foreground">{label}</dt>
                                            <dd className={`${label === "SQLite database path" ? "flex min-w-0 items-start gap-2" : "truncate text-right"} text-xs font-semibold`} title={value || "Unknown"}>
                                                <span className={label === "SQLite database path" ? "min-w-0 flex-1 break-all text-right" : ""}>{value || "Unknown"}</span>
                                                {label === "SQLite database path" && value && <Button type="button" variant="outline" size="sm" className="h-6 shrink-0 gap-1 px-2 !text-xs" onClick={() => copySqlitePath(value)} aria-label="Copy SQLite database path">
                                                    <Copy size={12} /> Copy
                                                </Button>}
                                            </dd>
                                        </div>
                                    ))}
                                </dl>
                            ) : null}
                        </section>
                    ) : activeSection === "database" ? (
                        <section className="space-y-4 text-left">
                            <div className="space-y-1">
                                <h2 className="text-sm font-semibold">Database preferences</h2>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold">Rows per page</p>
                                    <p className="text-xs font-semibold text-muted-foreground">Default size when opening a table.</p>
                                </div>
                                <Select disabled={!database?.db_id || preferencesLoading} value={String(databasePreferences.pageSize)} onValueChange={(value) => updateDatabasePreferences({ pageSize: Number(value) })}>
                                    <SelectTrigger className="h-7 w-[100px] text-xs font-semibold [&>span]:text-xs [&>span]:font-semibold"><SelectValue /></SelectTrigger>
                                    <SelectContent align="end">
                                        {[10, 25, 50, 100].map((size) => <SelectItem key={size} value={String(size)} className="text-xs font-semibold">{size} rows</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            {!database?.db_id && <p className="text-xs font-semibold text-muted-foreground">Select a database to configure its preferences.</p>}
                        </section>
                    ) : activeSection === "sensitive" ? (
                        <section className="space-y-4 text-left">
                            <h2 className="text-sm font-semibold">Sensitive data</h2>
                            <div className="flex items-center justify-between gap-4">
                                <div className="min-w-0 space-y-1">
                                    <p className="text-xs font-semibold">Sensitive columns</p>
                                    <p className="text-xs font-semibold text-muted-foreground">Selected columns are masked in table views and exports for this database.</p>
                                </div>
                                {sensitiveColumns.length ? (
                                <DropdownMenu onOpenChange={(isOpen) => { if (!isOpen) setSensitiveColumnSearch(""); }}>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            disabled={!database?.db_id || preferencesLoading}
                                            className="flex h-7 w-[260px] items-center justify-between gap-2 px-2 !text-xs !font-semibold"
                                        >
                                            <span className="truncate">
                                                {databasePreferences.sensitiveColumns.length
                                                    ? `${databasePreferences.sensitiveColumns.length} columns selected`
                                                    : "Select columns"}
                                            </span>
                                            <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-[320px] p-1">
                                        <div className="relative p-1">
                                            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                            <Input
                                                value={sensitiveColumnSearch}
                                                onChange={(event) => setSensitiveColumnSearch(event.target.value)}
                                                onKeyDown={(event) => event.stopPropagation()}
                                                placeholder="Search columns..."
                                                aria-label="Search sensitive columns"
                                                className="h-7 rounded-md pl-7 pr-2 !text-xs !font-semibold"
                                            />
                                        </div>
                                        <div className="max-h-56 overflow-y-auto">
                                            {filteredSensitiveColumns.length ? filteredSensitiveColumns.map((column) => (
                                                <DropdownMenuCheckboxItem
                                                    key={column}
                                                    checked={databasePreferences.sensitiveColumns.includes(column)}
                                                    onCheckedChange={(checked) => updateDatabasePreferences({
                                                        sensitiveColumns: checked
                                                            ? [...new Set([...databasePreferences.sensitiveColumns, column])]
                                                            : databasePreferences.sensitiveColumns.filter((item) => item !== column),
                                                    })}
                                                    onSelect={(event) => event.preventDefault()}
                                                    className="!py-1.5 !font-mono !text-xs !font-semibold"
                                                >
                                                    {column}
                                                </DropdownMenuCheckboxItem>
                                            )) : (
                                                <p className="px-2 py-4 text-center text-xs font-semibold text-muted-foreground">No columns match.</p>
                                            )}
                                        </div>
                                        <DropdownMenuSeparator />
                                        <p className="px-2 py-1 text-right text-xs font-semibold text-muted-foreground">
                                            {databasePreferences.sensitiveColumns.length} selected
                                        </p>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            ) : (
                                <p className="shrink-0 text-xs font-semibold text-muted-foreground">
                                    {schemaLoading ? "Loading database schema..." : schemaError || (databaseId ? "No columns found in this database schema." : "Select a database to choose sensitive columns.")}
                                </p>
                            )}
                            </div>
                        </section>
                    ) : activeSection === "security" ? (
                        <section className="space-y-4 text-left">
                            <h2 className="text-sm font-semibold">Security</h2>
                            <div className="flex items-center justify-between gap-4">
                                <div className="min-w-0 space-y-1">
                                    <p className="text-xs font-semibold">Two-factor authentication</p>
                                    <p className="text-xs font-semibold text-muted-foreground">Use an authentication app to get a verification code when logging in.</p>
                                </div>
                                {profile?.user?.is2FAActive ? (
                                    <Switch id="app-settings-2fa" disabled={loading} checked={status} onCheckedChange={(enabled) => {
                                        setTwoFAAction(enabled ? "enable" : "disable");
                                        setTwoFACode("");
                                        setTwoFAError("");
                                    }} className="shrink-0 shadow-none" />
                                ) : (
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button onClick={fetch2FASetUp} className="h-7 shrink-0 bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700">Activate 2FA</Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle className="text-sm font-semibold">2FA Setup</AlertDialogTitle>
                                            </AlertDialogHeader>
                                            <div className="flex flex-col items-start gap-3 text-left">
                                                <p className="text-xs font-semibold">Scan the image below with the 2FA authenticator app on your phone.</p>
                                                {qrcode.qrCodeImage && <Image src={qrcode.qrCodeImage} alt="QR Code" width={200} height={200} className="rounded-md border bg-neutral-50" />}
                                                <p className="text-xs font-semibold">Or, manually enter the code below in the authenticator app.</p>
                                                <p className="w-full rounded border border-neutral-100 bg-neutral-50 p-2 text-left font-mono text-xs font-semibold dark:border-neutral-700 dark:bg-neutral-800">{qrcode.secret}</p>
                                                <p className="text-xs font-semibold">Enter the six-digit code from the application.</p>
                                                <InputOTP maxLength={6} value={value} onChange={setValue}>
                                                    <InputOTPGroup>
                                                        {[0, 1, 2, 3, 4, 5].map((index) => <InputOTPSlot key={index} index={index} />)}
                                                    </InputOTPGroup>
                                                </InputOTP>
                                            </div>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel className="text-xs font-semibold">Cancel</AlertDialogCancel>
                                                <Button onClick={verifyCode2fa} disabled={loading || value.length !== 6} className="bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">Continue</Button>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                )}
                            </div>
                            <AlertDialog open={Boolean(twoFAAction)} onOpenChange={(nextOpen) => {
                                if (!nextOpen) {
                                    setTwoFAAction(null);
                                    setTwoFACode("");
                                    setTwoFAError("");
                                }
                            }}>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle className="text-sm font-semibold">Confirm {twoFAAction === "enable" ? "enable" : "disable"} 2FA</AlertDialogTitle>
                                    </AlertDialogHeader>
                                    <div className="space-y-3 text-left">
                                        <p className="text-xs font-semibold text-muted-foreground">Enter the current six-digit code from your authenticator app to confirm this change.</p>
                                        <InputOTP maxLength={6} value={twoFACode} onChange={setTwoFACode}>
                                            <InputOTPGroup>
                                                {[0, 1, 2, 3, 4, 5].map((index) => <InputOTPSlot key={index} index={index} />)}
                                            </InputOTPGroup>
                                        </InputOTP>
                                    </div>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel className="!mt-0 h-6 border-0 bg-white p-1 px-2 text-black shadow-none ring-0 hover:bg-neutral-100 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:bg-neutral-900 !text-xs !font-semibold">Cancel</AlertDialogCancel>
                                        <Button onClick={() => updateStatus2FA(twoFAAction === "enable")} disabled={loading || twoFACode.length !== 6} className="flex h-6 items-center gap-1 border-0 bg-blue-600 p-1 px-2 text-white shadow-none ring-1 ring-blue-500 hover:bg-blue-700 disabled:opacity-50 dark:text-neutral-100 !text-xs !font-semibold">Confirm</Button>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </section>
                    ) : activeSection === "account" ? (
                        <section className="space-y-4 text-left">
                            <h2 className="text-sm font-semibold">Account</h2>
                            <div className="flex items-center justify-between gap-4">
                                <div className="min-w-0 space-y-1">
                                    <p className="text-xs font-semibold">Download account data</p>
                                    <p className="text-xs font-semibold text-muted-foreground">Profile, saved database settings, and retained activity history. Credentials are excluded.</p>
                                </div>
                                <Button type="button" onClick={() => window.open("/api/user/export", "_self")} className="flex h-6 shrink-0 items-center gap-1 border-0 bg-blue-600 p-1 px-2 text-white shadow-none ring-1 ring-blue-500 hover:bg-blue-700 dark:text-zinc-100 !text-xs !font-semibold">
                                    <Download size={14} />Download
                                </Button>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                                <div className="min-w-0 space-y-1">
                                    <p className="text-xs font-semibold">Delete account</p>
                                    <p className="text-xs font-semibold text-muted-foreground">Deletes your profile, connections, and activity history. External database data is untouched.</p>
                                </div>
                                <Button
                                    type="button"
                                    onClick={() => {
                                        setAccountConfirmation("");
                                        setAccountDeleteCode("");
                                        setAccountDeleteError("");
                                        setAccountDeleteOpen(true);
                                    }}
                                    className="flex h-6 shrink-0 items-center gap-1 border-0 bg-red-600 p-1 px-2 text-white shadow-none ring-1 ring-red-500 hover:bg-red-700 dark:text-zinc-100 !text-xs !font-semibold"
                                >
                                    <Trash2 size={14} className="mr-1.5" />Delete account
                                </Button>
                            </div>
                            <AlertDialog open={accountDeleteOpen} onOpenChange={(nextOpen) => {
                                if (accountDeleteLoading) return;
                                setAccountDeleteOpen(nextOpen);
                                if (!nextOpen) {
                                    setAccountDeleteError("");
                                    setAccountDeleteCode("");
                                }
                            }}>
                                <AlertDialogContent>
                                    {profile?.user?.is2FAActive && profile?.user?.is2FAEnabled ? (
                                        <>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle className="text-sm font-semibold">Delete your account permanently?</AlertDialogTitle>
                                                <AlertDialogDescription className="text-xs font-semibold">
                                                    This removes your PDV account, saved connection details, and activity history. It does not delete data from the external databases.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <div className="space-y-3 text-left">
                                                <div className="space-y-1">
                                                    <label htmlFor="delete-account-email" className="text-xs font-semibold">Type your account email to confirm: {profile?.user?.email}</label>
                                                    <Input id="delete-account-email" autoComplete="off" value={accountConfirmation} onChange={(event) => setAccountConfirmation(event.target.value)} className="h-7 !text-xs !font-semibold" />
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-xs font-semibold">Enter your current authenticator code</p>
                                                    <InputOTP maxLength={6} value={accountDeleteCode} onChange={setAccountDeleteCode}>
                                                        <InputOTPGroup>
                                                            {[0, 1, 2, 3, 4, 5].map((index) => <InputOTPSlot key={index} index={index} />)}
                                                        </InputOTPGroup>
                                                    </InputOTP>
                                                </div>
                                            </div>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel disabled={accountDeleteLoading} className="!mt-0 h-6 border-0 bg-white p-1 px-2 text-black shadow-none ring-0 hover:bg-neutral-100 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:bg-neutral-900 !text-xs !font-semibold">Cancel</AlertDialogCancel>
                                                <Button
                                                    type="button"
                                                    onClick={deleteAccount}
                                                    disabled={accountDeleteLoading || !profile?.user?.email || accountConfirmation.trim().toLowerCase() !== profile.user.email.trim().toLowerCase() || accountDeleteCode.length !== 6}
                                                    className="flex h-6 items-center gap-1 border-0 bg-red-600 p-1 px-2 text-white shadow-none ring-1 ring-red-500 hover:bg-red-700 dark:text-zinc-100 !text-xs !font-semibold"
                                                >
                                                    {accountDeleteLoading ? "Deleting..." : "Permanently delete"}
                                                </Button>
                                            </AlertDialogFooter>
                                        </>
                                    ) : (
                                        <>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle className="text-sm font-semibold">Two-factor authentication required</AlertDialogTitle>
                                                <AlertDialogDescription className="text-xs font-semibold">
                                                    Configure and enable two-factor authentication before deleting your account. You will need to enter a current authenticator code to confirm deletion.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel className="!mt-0 h-6 border-0 bg-white p-1 px-2 text-black shadow-none ring-0 hover:bg-neutral-100 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:bg-neutral-900 !text-xs !font-semibold">Cancel</AlertDialogCancel>
                                                <Button
                                                    type="button"
                                                    onClick={() => {
                                                        setAccountDeleteOpen(false);
                                                        setAccountDeleteError("");
                                                        setActiveSection("security");
                                                    }}
                                                    className="flex h-6 items-center gap-1 border-0 bg-blue-600 p-1 px-2 text-white shadow-none ring-1 ring-blue-500 hover:bg-blue-700 dark:text-neutral-100 !text-xs !font-semibold"
                                                >
                                                    Open Security settings
                                                </Button>
                                            </AlertDialogFooter>
                                        </>
                                    )}
                                </AlertDialogContent>
                            </AlertDialog>
                        </section>
                    ) : activeSection === "appearance" ? (
                        <section className="space-y-4 text-left">
                            <h2 className="text-sm font-semibold">Appearance</h2>
                            <div className="flex items-center justify-between gap-4">
                                <div className="space-y-1 text-left">
                                    <p className="text-xs font-semibold">Theme</p>
                                    <p className="text-xs font-semibold text-muted-foreground">Choose how the app looks on this device.</p>
                                </div>
                                <Tabs value={theme || "system"} onValueChange={setTheme} className="w-fit">
                                    <TabsList className="h-7 p-0.5">
                                        <TabsTrigger value="light" className="h-6 px-2 py-0 !text-xs !font-semibold">Light</TabsTrigger>
                                        <TabsTrigger value="dark" className="h-6 px-2 py-0 !text-xs !font-semibold">Dark</TabsTrigger>
                                        <TabsTrigger value="system" className="h-6 px-2 py-0 !text-xs !font-semibold">System</TabsTrigger>
                                    </TabsList>
                                </Tabs>
                            </div>
                        </section>
                    ) : activeSection === "language" ? (
                        <section className="space-y-4 text-left">
                            <h2 className="text-sm font-semibold">Language &amp; region</h2>
                            <div className="flex items-center justify-between gap-4">
                                <div className="min-w-0 space-y-1">
                                    <p className="text-xs font-semibold">Browser language and region</p>
                                    <p className="text-xs font-semibold text-muted-foreground">The app currently uses your browser locale for regional formatting. Interface translations are not available yet.</p>
                                </div>
                                <span className="shrink-0 text-xs font-semibold text-muted-foreground">{browserLocale}</span>
                            </div>
                        </section>
                    ) : (
                        <section className="space-y-4 text-left">
                            <h2 className="text-sm font-semibold">Navigation &amp; Accessibility</h2>
                            <div className="flex items-center justify-between gap-4">
                                <div className="min-w-0 space-y-1">
                                    <p className="text-xs font-semibold">Show navigation</p>
                                    <p className="text-xs font-semibold text-muted-foreground">Keep the database navigation visible while working.</p>
                                </div>
                                <Switch
                                    aria-label="Show navigation"
                                    checked={!navigationHidden}
                                    onCheckedChange={(visible) => setNavigationHidden(!visible)}
                                    className="shrink-0 shadow-none"
                                />
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-semibold">Keyboard accessibility</p>
                                <p className="text-xs font-semibold text-muted-foreground">Settings and table controls support keyboard navigation and focus indicators.</p>
                            </div>
                        </section>
                    )}
                </main>
                <DialogClose asChild>
                    <Button aria-label="Close settings" variant="ghost" className="absolute right-4 top-4 h-7 w-7 p-0 text-muted-foreground shadow-none hover:text-foreground">
                        <X size={14} />
                    </Button>
                </DialogClose>
            </DialogContent>
        </Dialog>
    );
}

const mapStateToProps = (state) => ({ profile: state.profile, database: state.database, tables: state.tables, queryTabs: state.queryTabs });
export default connect(mapStateToProps, { setProfile, setDatabase })(AppSettingsDialog);
