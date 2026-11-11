import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTheme } from "next-themes";
import axios from "axios";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Image from "next/image";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useNavigationVisibility } from "@/components/navigationBar/navigationVisibility";
import { Check, Computer, Copy, Download, LockKeyhole, Menu, Moon, RefreshCw, Shield, X } from "lucide-react";
import { toast } from "@/components/ui/base-toast";
import { disableAnalytics, enableAnalytics, isAnalyticsConfigured, isAnalyticsEnvironmentAllowed } from "@/lib/analytics";
import { setColorThemePreference, setThemePreference } from "@/redux/actions/main";

const COLOR_THEMES = ["Zinc", "Olive", "Neutral", "Emerald", "Teal", "Indigo", "Rose", "Slate", "Gray"];

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

function AppSettingsDialog({ open = false, onOpenChange = () => {} }) {
    const { setTheme } = useTheme();
    const dispatch = useDispatch();
    const theme = useSelector((state) => state.settings.theme);
    const colorTheme = useSelector((state) => state.settings.colorTheme || "olive");
    const analyticsEnabled = useSelector((state) => state.settings.analyticsEnabled);
    const {
        navigationHidden,
        setNavigationHidden,
        updateInfo,
        updateStatus,
        setUpdateStatus,
        checkForUpdates: requestUpdateCheck,
    } = useNavigationVisibility();
    const [activeSection, setActiveSection] = useState("appearance");
    const [twoFAEnabled, setTwoFAEnabled] = useState(false);
    const [setupOpen, setSetupOpen] = useState(false);
    const [setupLoading, setSetupLoading] = useState(false);
    const [setupData, setSetupData] = useState(null);
    const [setupCode, setSetupCode] = useState("");
    const [disableOpen, setDisableOpen] = useState(false);
    const [disableCode, setDisableCode] = useState("");
    const [twoFAActionLoading, setTwoFAActionLoading] = useState(false);
    const [computerInfo, setComputerInfo] = useState(null);
    const [computerInfoLoading, setComputerInfoLoading] = useState(false);
    const [computerInfoError, setComputerInfoError] = useState("");
    const [analyticsSaving, setAnalyticsSaving] = useState(false);
    const [analyticsEnvironmentAllowed, setAnalyticsEnvironmentAllowed] = useState(null);

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
        { id: "navigation", label: "Navigation", icon: Menu },
        { id: "updates", label: "Updates", icon: RefreshCw },
        { id: "analytics", label: "Privacy & analytics", icon: Shield },
        { id: "computer", label: "About & diagnostics", icon: Computer },
        { id: "security", label: "Security", icon: LockKeyhole },
    ];

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
        if (!open || activeSection !== "analytics" || typeof window === "undefined") return;
        isAnalyticsEnvironmentAllowed().then(setAnalyticsEnvironmentAllowed);
    }, [open, activeSection]);

    useEffect(() => {
        if (!open || activeSection !== "security") return undefined;
        let cancelled = false;
        axios.get("/api/2fa/status")
            .then(({ data }) => { if (!cancelled) setTwoFAEnabled(Boolean(data.enabled)); })
            .catch((error) => {
                if (!cancelled) toast.add({ title: "Unable to load security status", description: error.response?.data?.error || "Unable to read two-factor status.", type: "error" });
            });
        return () => { cancelled = true; };
    }, [open, activeSection]);

    const changeAnalyticsPreference = async (enabled) => {
        if (!isAnalyticsConfigured()) return;
        setAnalyticsSaving(true);
        try {
            if (enabled) {
                const enabledSuccessfully = await enableAnalytics();
                if (!enabledSuccessfully) return;
            } else {
                await disableAnalytics();
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
        const result = await requestUpdateCheck();
        if (result.status === "available") {
            toast.add({ title: "Update available", description: `Version ${result.version} is ready to download.`, type: "success" });
        } else if (result.status === "not-available") {
            toast.add({ title: "You’re up to date", description: "You already have the latest version.", type: "success" });
        } else if (result.status === "unsupported") {
            toast.add({ title: "Update check unavailable", description: "In-app updates are available in the installed desktop app.", type: "warning" });
        } else if (result.status === "error") {
            toast.add({ title: "Unable to check for updates", description: result.message || "Unable to check for updates.", type: "error" });
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

    const beginTwoFactorSetup = async () => {
        setSetupLoading(true);
        try {
            const { data } = await axios.post("/api/2fa/setup");
            setSetupData(data);
            setSetupCode("");
            setSetupOpen(true);
        } catch (error) {
            toast.add({ title: "Unable to start setup", description: error.response?.data?.error || "Unable to start two-factor setup.", type: "error" });
        } finally {
            setSetupLoading(false);
        }
    };

    const confirmTwoFactorSetup = async () => {
        setTwoFAActionLoading(true);
        try {
            await axios.post("/api/2fa/verify", { token: setupCode });
            setTwoFAEnabled(true);
            setSetupOpen(false);
            setSetupData(null);
            setSetupCode("");
            toast.add({ title: "Two-factor authentication enabled", description: "The app will ask for an authenticator code when it starts.", type: "success" });
        } catch (error) {
            toast.add({ title: "Unable to verify code", description: error.response?.data?.error || "Check the code and try again.", type: "error" });
        } finally {
            setTwoFAActionLoading(false);
        }
    };

    const disableTwoFactor = async () => {
        setTwoFAActionLoading(true);
        try {
            await axios.post("/api/2fa/status", { token: disableCode });
            setTwoFAEnabled(false);
            setDisableOpen(false);
            setDisableCode("");
            toast.add({ title: "Two-factor authentication disabled", type: "success" });
        } catch (error) {
            toast.add({ title: "Unable to disable 2FA", description: error.response?.data?.error || "Check the code and try again.", type: "error" });
        } finally {
            setTwoFAActionLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="grid h-[500px] w-[800px] max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] grid-cols-[255px_minmax(0,1fr)] gap-0 overflow-hidden p-0">
                <DialogTitle className="sr-only">Application settings</DialogTitle>
                <DialogDescription className="sr-only">
                    Manage application appearance, updates, privacy, security, and navigation settings.
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
                                    <Button type="button" onClick={downloadUpdate} className="flex h-6 items-center gap-1 border-0 bg-blue-600 p-1 px-2 text-white shadow-none ring-1 ring-blue-500 hover:bg-blue-700 dark:text-zinc-100 !text-xs !font-semibold">
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
                                    <Button type="button" onClick={installUpdate} className="flex h-6 items-center gap-1 border-0 bg-blue-600 p-1 px-2 text-white shadow-none ring-1 ring-blue-500 hover:bg-blue-700 dark:text-zinc-100 !text-xs !font-semibold">Restart and install</Button>
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
                                className="flex h-6 items-center gap-1 border-0 bg-blue-600 p-1 px-2 text-white shadow-none ring-1 ring-blue-500 hover:bg-blue-700 dark:text-zinc-100 !text-xs !font-semibold"
                            >
                                <RefreshCw size={13} /> Check for updates
                            </Button>
                        </section>
                    ) : activeSection === "computer" ? (
                        <section className="space-y-4 text-left">
                            <div className="space-y-1">
                                <h2 className="text-sm font-semibold">About &amp; diagnostics</h2>
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
                    ) : activeSection === "security" ? (
                        <section className="space-y-4 text-left">
                            <div className="space-y-1">
                                <h2 className="text-sm font-semibold">Security</h2>
                                <p className="text-xs font-semibold text-muted-foreground">Use an authenticator app to lock Placedv Query when it starts.</p>
                            </div>
                            <div className="flex items-center justify-between gap-4 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold">Two-factor authentication</p>
                                    <p className="text-xs font-semibold text-muted-foreground">{twoFAEnabled ? "Enabled. You’ll be asked for a code each time the app starts." : "Disabled. Enable it to require an authenticator code when the app starts."}</p>
                                </div>
                                {twoFAEnabled ? (
                                    <Button type="button" onClick={() => { setDisableCode(""); setDisableOpen(true); }} className="flex h-6 shrink-0 items-center gap-1 border-0 bg-white p-1 px-2 text-black shadow-none ring-0 hover:bg-neutral-100 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:bg-neutral-900 !text-xs !font-semibold">Disable 2FA</Button>
                                ) : (
                                    <Button type="button" disabled={setupLoading} onClick={beginTwoFactorSetup} className="flex h-6 shrink-0 items-center gap-1 border-0 bg-blue-600 p-1 px-2 text-white shadow-none ring-1 ring-blue-500 hover:bg-blue-700 disabled:opacity-50 dark:text-zinc-100 !text-xs !font-semibold">{setupLoading ? "Starting..." : "Enable 2FA"}</Button>
                                )}
                            </div>

                            <AlertDialog open={setupOpen} onOpenChange={(nextOpen) => {
                                if (twoFAActionLoading) return;
                                setSetupOpen(nextOpen);
                                if (!nextOpen) { setSetupData(null); setSetupCode(""); }
                            }}>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle className="text-sm font-semibold">Set up two-factor authentication</AlertDialogTitle>
                                        <AlertDialogDescription className="text-xs font-semibold">Scan this QR code with an authenticator app, then enter the six-digit code to confirm setup. The setup expires in 10 minutes.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <div className="flex flex-col items-center gap-3 text-left">
                                        {setupData?.qrCodeImage && <Image src={setupData.qrCodeImage} alt="Authenticator setup QR code" width={220} height={220} className="rounded-md border bg-white p-1" unoptimized />}
                                        <p className="w-full text-xs font-semibold">Or enter this setup key manually:</p>
                                        <p className="w-full select-all break-all rounded border border-neutral-200 bg-neutral-50 p-2 font-mono text-xs font-semibold dark:border-neutral-700 dark:bg-neutral-800">{setupData?.secret}</p>
                                        <InputOTP maxLength={6} value={setupCode} onChange={setSetupCode}>
                                            <InputOTPGroup>{[0, 1, 2, 3, 4, 5].map((index) => <InputOTPSlot key={index} index={index} />)}</InputOTPGroup>
                                        </InputOTP>
                                    </div>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel disabled={twoFAActionLoading} className="!mt-0 h-6 border-0 bg-white p-1 px-2 text-black shadow-none ring-0 hover:bg-neutral-100 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:bg-neutral-900 !text-xs !font-semibold">Cancel</AlertDialogCancel>
                                        <Button type="button" onClick={confirmTwoFactorSetup} disabled={twoFAActionLoading || setupCode.length !== 6} className="flex h-6 items-center gap-1 border-0 bg-blue-600 p-1 px-2 text-white shadow-none ring-1 ring-blue-500 hover:bg-blue-700 disabled:opacity-50 dark:text-zinc-100 !text-xs !font-semibold">{twoFAActionLoading ? "Verifying..." : "Confirm setup"}</Button>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>

                            <AlertDialog open={disableOpen} onOpenChange={(nextOpen) => {
                                if (twoFAActionLoading) return;
                                setDisableOpen(nextOpen);
                                if (!nextOpen) setDisableCode("");
                            }}>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle className="text-sm font-semibold">Disable two-factor authentication?</AlertDialogTitle>
                                        <AlertDialogDescription className="text-xs font-semibold">Enter a current authenticator code to turn off the app lock.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <InputOTP maxLength={6} value={disableCode} onChange={setDisableCode}>
                                        <InputOTPGroup>{[0, 1, 2, 3, 4, 5].map((index) => <InputOTPSlot key={index} index={index} />)}</InputOTPGroup>
                                    </InputOTP>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel disabled={twoFAActionLoading} className="!mt-0 h-6 border-0 bg-white p-1 px-2 text-black shadow-none ring-0 hover:bg-neutral-100 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:bg-neutral-900 !text-xs !font-semibold">Cancel</AlertDialogCancel>
                                        <Button type="button" onClick={disableTwoFactor} disabled={twoFAActionLoading || disableCode.length !== 6} className="flex h-6 items-center gap-1 border-0 bg-blue-600 p-1 px-2 text-white shadow-none ring-1 ring-blue-500 hover:bg-blue-700 disabled:opacity-50 dark:text-zinc-100 !text-xs !font-semibold">{twoFAActionLoading ? "Disabling..." : "Disable 2FA"}</Button>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </section>
                    ) : activeSection === "appearance" ? (
                        <section className="space-y-4 text-left">
                            <h2 className="text-sm font-semibold">Appearance</h2>
                            <div className="flex items-center justify-between gap-4">
                                <div className="space-y-1 text-left">
                                    <p className="text-xs font-semibold">Color mode</p>
                                    <p className="text-xs font-semibold text-muted-foreground">Choose how the app looks on this device.</p>
                                </div>
                                <Tabs value={theme || "system"} onValueChange={(value) => {
                                    dispatch(setThemePreference(value));
                                    setTheme(value);
                                }} className="w-fit">
                                    <TabsList className="h-7 p-0.5">
                                        <TabsTrigger value="light" className="h-6 px-2 py-0 !text-xs !font-semibold">Light</TabsTrigger>
                                        <TabsTrigger value="dark" className="h-6 px-2 py-0 !text-xs !font-semibold">Dark</TabsTrigger>
                                        <TabsTrigger value="system" className="h-6 px-2 py-0 !text-xs !font-semibold">System</TabsTrigger>
                                    </TabsList>
                                </Tabs>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                                <div className="space-y-1 text-left">
                                    <p className="text-xs font-semibold">Color theme</p>
                                    <p className="text-xs font-semibold text-muted-foreground">Choose the app’s color palette.</p>
                                </div>
                                <Select value={colorTheme} onValueChange={(value) => dispatch(setColorThemePreference(value))}>
                                    <SelectTrigger className="h-7 w-36 px-2 text-xs font-semibold">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent align="end">
                                        {COLOR_THEMES.map((color) => (
                                            <SelectItem key={color} value={color.toLowerCase()} className="text-xs font-semibold">
                                                {color}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </section>
                    ) : (
                        <section className="space-y-4 text-left">
                            <h2 className="text-sm font-semibold">Navigation</h2>
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

export default AppSettingsDialog;
