import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { connect } from "react-redux";
import axios from "axios";
import { ArrowLeft, ChevronDown, Settings2, Trash2 } from "lucide-react";
import LeftBar from "@/components/navigationBar/leftBar";
import ElectronTitlebarSpacer from "@/components/electronTitlebarSpacer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setDatabase, setDatabases, setQueryTabs, setTables } from "@/redux/actions/main";
import { ShowNavigationButton, useNavigationVisibility } from "@/components/navigationBar/navigationVisibility";
import useClear from "@/lib/clear";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/base-toast";

function DatabaseSettingsPage({ database, databases, setDatabase, setDatabases, setQueryTabs, setTables }) {
    const router = useRouter();
    const clearDatabaseState = useClear();
    const { navigationHidden } = useNavigationVisibility();
    const databaseId = router.query.id;
    const [dbName, setDbName] = useState("");
    const [savedDbName, setSavedDbName] = useState("");
    const [connectionString, setConnectionString] = useState("");
    const [connectionAuthorizationConfirmed, setConnectionAuthorizationConfirmed] = useState(false);
    const [sshConfigured, setSshConfigured] = useState(false);
    const [sshEnabled, setSshEnabled] = useState(false);
    const [replaceSshSettings, setReplaceSshSettings] = useState(false);
    const [ssh, setSsh] = useState({ host: "", port: "22", username: "", authType: "password", password: "", privateKey: "", passphrase: "", hostFingerprint: "" });
    const [sslEnabled, setSslEnabled] = useState(false);
    const [sslMode, setSslMode] = useState("verify-full");
    const [savedSslEnabled, setSavedSslEnabled] = useState(false);
    const [savedSslMode, setSavedSslMode] = useState("verify-full");
    const sshSettingsChanged = replaceSshSettings || sshEnabled !== sshConfigured;
    const sslSettingsChanged = sslEnabled !== savedSslEnabled || sslMode !== savedSslMode;
    const [createdAt, setCreatedAt] = useState(null);
    const [updatedAt, setUpdatedAt] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [, setSaved] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [, setDeleteError] = useState("");

    useEffect(() => {
        if (!router.isReady || typeof databaseId !== "string") return;
        let cancelled = false;

        axios.get(`/api/database/${encodeURIComponent(databaseId)}`)
            .then(({ data }) => {
                if (cancelled) return;
                setDbName(data.db_name || "");
                setSavedDbName(data.db_name || "");
                setCreatedAt(data.createdAt);
                setUpdatedAt(data.updatedAt);
                setSshConfigured(Boolean(data.hasSshTunnel));
                setSshEnabled(Boolean(data.hasSshTunnel));
                setSslEnabled(Boolean(data.sslEnabled));
                setSslMode(data.sslMode || "verify-full");
                setSavedSslEnabled(Boolean(data.sslEnabled));
                setSavedSslMode(data.sslMode || "verify-full");
                setDatabase({ db_id: data.id, db_name: data.db_name, dialect: data.dialect });
            })
            .catch((requestError) => {
                if (!cancelled) {
                    const message = requestError.response?.data?.error || "Unable to load database settings.";
                    setError(message);
                    toast.add({ title: "Unable to load settings", description: message, type: "error" });
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, [router.isReady, databaseId, setDatabase]);

    const saveSettings = async (event) => {
        event.preventDefault();
        const nextName = dbName.trim();
        const nextConnectionString = connectionString.trim();
        const connectionChanged = Boolean(nextConnectionString);
        const connectionSettingsChanged = connectionChanged || sshSettingsChanged || sslSettingsChanged;
        if (connectionSettingsChanged && !connectionAuthorizationConfirmed) {
            toast.add({ title: "Confirm database authorization", description: "Confirm that you are authorised to use this database before updating its connection.", type: "warning" });
            return;
        }
        if (!nextName || (nextName === savedDbName && !connectionSettingsChanged)) return;

        setSaving(true);
        setError("");
        setSaved(false);
        try {
            const { data } = await axios.patch(`/api/database/${encodeURIComponent(databaseId)}`, {
                db_name: nextName,
                ...(connectionChanged ? { url_connection: nextConnectionString } : {}),
                ...(sshSettingsChanged ? { ssh: sshEnabled ? { ...ssh, enabled: true, port: Number(ssh.port) } : { enabled: false } } : {}),
                ...(sslSettingsChanged ? { ssl: { enabled: sslEnabled, mode: sslMode } } : {}),
                ...(connectionSettingsChanged ? { authorizationConfirmed: true } : {}),
            });
            setDbName(data.db_name);
            setSavedDbName(data.db_name);
            setConnectionString("");
            setConnectionAuthorizationConfirmed(false);
            setSshConfigured(Boolean(data.hasSshTunnel));
            setSshEnabled(Boolean(data.hasSshTunnel));
            setReplaceSshSettings(false);
            setSsh({ host: "", port: "22", username: "", authType: "password", password: "", privateKey: "", passphrase: "", hostFingerprint: "" });
            setSslEnabled(Boolean(data.sslEnabled));
            setSslMode(data.sslMode || "verify-full");
            setSavedSslEnabled(Boolean(data.sslEnabled));
            setSavedSslMode(data.sslMode || "verify-full");
            setUpdatedAt(data.updatedAt);
            setDatabase({ ...database, db_id: data.id, db_name: data.db_name, dialect: data.dialect });
            setDatabases((databases || []).map((item) => item.id === data.id ? { ...item, db_name: data.db_name, dialect: data.dialect } : item));
            if (connectionChanged) {
                setTables(null);
                setQueryTabs([]);
            }
            setSaved(true);
            toast.add({ title: "Settings saved", description: "Database settings were updated.", type: "success" });
        } catch (requestError) {
            const message = requestError.response?.data?.error || "Unable to save database settings.";
            setError(message);
            toast.add({ title: "Unable to save settings", description: message, type: "error" });
        } finally {
            setSaving(false);
        }
    };

    const openTable = (tab) => {
        setQueryTabs([tab]);
        router.push(`/app/playground/play/${encodeURIComponent(databaseId)}`);
    };
    const openSql = (sql) => {
        setQueryTabs([{ id: `sql-${Date.now()}`, name: "SQL", type: "sql", query: sql, data: { data: [] }, count: 0 }]);
        router.push(`/app/playground/play/${encodeURIComponent(databaseId)}`);
    };

    const deleteDatabase = async () => {
        if (!databaseId || deleting) return;
        setDeleting(true);
        setDeleteError("");
        try {
            await axios.delete(`/api/database/${encodeURIComponent(databaseId)}`);
            toast.add({ title: "Dataset deleted", description: "The database was removed.", type: "success" });
            setDatabases((databases || []).filter((item) => item.id !== databaseId));
            setDeleteOpen(false);
            if (String(database?.db_id ?? "") === String(databaseId)) {
                await clearDatabaseState();
                setQueryTabs([]);
                router.push("/app/playground/play");
            }
        } catch (requestError) {
            const message = requestError.response?.data?.error || "Unable to delete dataset.";
            setDeleteError(message);
            toast.add({ title: "Unable to delete dataset", description: message, type: "error" });
        } finally {
            setDeleting(false);
        }
    };

    return (
        <>
            <LeftBar openTab={openTable} openSqlTab={openSql} />
            <main className={`electron-main-with-sidebar ${navigationHidden ? "ml-0" : "ml-[240px]"} min-h-screen transition-[margin] duration-200`}>
                <div className="sticky top-0 z-40 flex h-[53px] items-center justify-between border-b bg-zinc-50 dark:bg-zinc-950">
                    <div data-command-search-left className={`electron-titlebar-no-drag ${navigationHidden ? "electron-titlebar-safe-left electron-titlebar-safe-left-controls" : ""} flex items-center gap-2 px-4`}>
                    <ShowNavigationButton />
                    <Button
                        onClick={() => router.push(`/app/playground/play/${encodeURIComponent(databaseId)}`)}
                        className="h-6 border-0 bg-white p-1 px-2 text-black shadow-none ring-1 ring-zinc-300 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-900 !text-xs !font-semibold"
                    >
                        <ArrowLeft size={12} className="mr-1" /> Back to database
                    </Button>
                    </div>
                    <ElectronTitlebarSpacer />
                    <div data-command-search-right className="flex items-center gap-1 px-4 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                        <Settings2 size={13} /> Database settings
                    </div>
                </div>

                <section className="max-w-2xl p-4">
                    <div className="mb-4">
                        <h1 className="text-sm font-semibold">Database settings</h1>
                        <p className="mt-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                            Manage the saved connection for {database?.db_name || savedDbName || "this database"}.
                        </p>
                    </div>

                    {loading ? (
                        <p className="text-xs font-semibold text-zinc-500">Loading settings...</p>
                    ) : error && !savedDbName ? (
                        null
                    ) : (
                        <form onSubmit={saveSettings} className="space-y-5">
                            <div className="space-y-2">
                                <label htmlFor="database-name" className="text-xs font-semibold">Database name</label>
                                <Input
                                    id="database-name"
                                    value={dbName}
                                    onChange={(event) => { setDbName(event.target.value); setSaved(false); }}
                                    maxLength={120}
                                    className="h-8 w-[240px] text-xs font-semibold"
                                    disabled={saving}
                                />
                                <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                                    This name is used to identify the saved connection in the dataset menu.
                                </p>
                            </div>

                            <details className="group w-[400px]">
                                <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold [&::-webkit-details-marker]:hidden">
                                    <ChevronDown size={14} className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                                    SSL and SSH options
                                </summary>
                                <div className="mt-3 space-y-3">
                                    <div className="flex items-center gap-2 text-xs font-semibold">
                                        <Checkbox aria-label="Use SSL/TLS encryption" checked={sslEnabled} onCheckedChange={(checked) => { setSslEnabled(Boolean(checked)); setSaved(false); }} className="h-3.5 w-3.5 border-zinc-400 data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600" />
                                        Use SSL/TLS encryption
                                    </div>
                                    {sslEnabled && <div className="space-y-1">
                                        <div className="text-xs font-semibold text-zinc-500">Certificate verification</div>
                                        <Select value={sslMode} onValueChange={(value) => { setSslMode(value); setSaved(false); }}>
                                            <SelectTrigger aria-label="Certificate verification" className="h-8 w-full !text-xs !font-semibold"><SelectValue /></SelectTrigger>
                                            <SelectContent className="z-[1100] !text-xs !font-semibold">
                                                <SelectItem value="verify-full" className="!text-xs !font-semibold">Verify certificate and hostname</SelectItem>
                                                <SelectItem value="verify-ca" className="!text-xs !font-semibold">Verify certificate</SelectItem>
                                                <SelectItem value="require" className="!text-xs !font-semibold">Encrypt without certificate verification</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>}
                                    <div className="flex items-center gap-2 text-xs font-semibold">
                                        <Checkbox aria-label="Connect through an SSH tunnel" checked={sshEnabled} onCheckedChange={(checked) => {
                                            const enabled = Boolean(checked);
                                            setSshEnabled(enabled);
                                            setReplaceSshSettings(enabled && !sshConfigured);
                                            setSaved(false);
                                        }} className="h-3.5 w-3.5 border-zinc-400 data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600" />
                                        Connect through an SSH tunnel
                                    </div>
                                    {sshEnabled && sshConfigured && !replaceSshSettings && <div className="space-y-2">
                                        <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">An SSH tunnel is configured. Its credentials are encrypted and hidden.</p>
                                        <Button type="button" onClick={() => setReplaceSshSettings(true)} className="h-6 border-0 bg-white p-1 px-2 text-black shadow-none ring-1 ring-zinc-300 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-900 !text-xs !font-semibold">Replace SSH credentials</Button>
                                    </div>}
                                    {sshEnabled && (!sshConfigured || replaceSshSettings) && <div className="grid grid-cols-2 gap-2">
                                        <div className="flex flex-col gap-2 text-xs font-semibold text-zinc-500"><span>SSH host</span><Input aria-label="SSH host" required value={ssh.host} onChange={(event) => setSsh({ ...ssh, host: event.target.value })} placeholder="bastion.example.com" className="h-8 !text-xs !font-semibold" /></div>
                                        <div className="flex flex-col gap-2 text-xs font-semibold text-zinc-500"><span>SSH port</span><Input aria-label="SSH port" required type="number" min="1" max="65535" value={ssh.port} onChange={(event) => setSsh({ ...ssh, port: event.target.value })} className="h-8 !text-xs !font-semibold" /></div>
                                        <div className="flex flex-col gap-2 text-xs font-semibold text-zinc-500"><span>SSH username</span><Input aria-label="SSH username" required value={ssh.username} onChange={(event) => setSsh({ ...ssh, username: event.target.value })} className="h-8 !text-xs !font-semibold" /></div>
                                        <div className="flex flex-col gap-2 text-xs font-semibold text-zinc-500"><span>Authentication</span><Select value={ssh.authType} onValueChange={(value) => setSsh({ ...ssh, authType: value })}><SelectTrigger aria-label="Authentication" className="h-8 w-full !text-xs !font-semibold"><SelectValue /></SelectTrigger><SelectContent className="z-[1100] !text-xs !font-semibold"><SelectItem value="password" className="!text-xs !font-semibold">Password</SelectItem><SelectItem value="privateKey" className="!text-xs !font-semibold">Private key</SelectItem></SelectContent></Select></div>
                                        {ssh.authType === "password" ? <div className="col-span-2 flex flex-col gap-2 text-xs font-semibold text-zinc-500"><span>SSH password</span><Input aria-label="SSH password" required type="password" value={ssh.password} onChange={(event) => setSsh({ ...ssh, password: event.target.value })} autoComplete="new-password" className="h-8 !text-xs !font-semibold" /></div> : <>
                                            <div className="col-span-2 flex flex-col gap-2 text-xs font-semibold text-zinc-500"><span>SSH private key</span><textarea aria-label="SSH private key" required rows={4} value={ssh.privateKey} onChange={(event) => setSsh({ ...ssh, privateKey: event.target.value })} className="w-full rounded-md bg-white p-2 text-xs font-semibold ring-1 ring-zinc-200 dark:bg-zinc-950 dark:ring-zinc-700" /></div>
                                            <div className="col-span-2 flex flex-col gap-2 text-xs font-semibold text-zinc-500"><span>Key passphrase (if required)</span><Input aria-label="Key passphrase" type="password" value={ssh.passphrase} onChange={(event) => setSsh({ ...ssh, passphrase: event.target.value })} autoComplete="new-password" className="h-8 !text-xs !font-semibold" /></div>
                                        </>}
                                        <div className="col-span-2 flex flex-col gap-2 text-xs font-semibold text-zinc-500"><span>SSH server SHA-256 fingerprint</span><Input aria-label="SSH server SHA-256 fingerprint" required value={ssh.hostFingerprint} onChange={(event) => setSsh({ ...ssh, hostFingerprint: event.target.value })} placeholder="SHA256:..." className="h-8 !text-xs !font-semibold" /></div>
                                    </div>}
                                </div>
                            </details>

                            <div className="space-y-2">
                                <p className="text-xs font-semibold">Connection string</p>
                                <Input
                                    id="database-connection-string"
                                    type="password"
                                    value={connectionString}
                                    onChange={(event) => { setConnectionString(event.target.value); setSaved(false); }}
                                    maxLength={4096}
                                    placeholder="Enter a new MySQL or PostgreSQL connection string"
                                    autoComplete="new-password"
                                    spellCheck={false}
                                    className="h-8 w-[400px] text-xs font-semibold"
                                    disabled={saving}
                                />
                                <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                                    Saved credentials are encrypted and never shown here. Leave blank to keep them, or enter a replacement; the new connection is checked before it is saved.
                                </p>
                                {(Boolean(connectionString.trim()) || sshSettingsChanged || sslSettingsChanged) && <div className="flex max-w-[520px] items-start gap-2 text-xs font-semibold leading-relaxed text-zinc-600 dark:text-zinc-300">
                                    <Checkbox id="confirm-database-authorization" checked={connectionAuthorizationConfirmed} onCheckedChange={(checked) => setConnectionAuthorizationConfirmed(checked === true)} className="mt-0.5 h-3.5 w-3.5 shrink-0 border-zinc-400 data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600" />
                                    <label htmlFor="confirm-database-authorization">I confirm that I own this database or am authorised by its owner to connect it and process its contents through Placedv Query. If I act for a client, I have obtained any required written approval, including approval for Placedv Query and its listed sub-processors.</label>
                                </div>}
                            </div>

                            <div className="space-y-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                                <p>Created: {createdAt ? new Date(createdAt).toLocaleString() : "—"}</p>
                                <p>Last updated: {updatedAt ? new Date(updatedAt).toLocaleString() : "—"}</p>
                            </div>


                            <Button
                                type="submit"
                                disabled={saving || !dbName.trim() || (dbName.trim() === savedDbName && !connectionString.trim() && !sshSettingsChanged && !sslSettingsChanged)}
                                className="h-7 border-0 bg-blue-600 px-3 text-white shadow-none hover:bg-blue-700 disabled:opacity-50 dark:text-zinc-100 !text-xs !font-semibold"
                            >
                                {saving ? "Saving..." : "Save changes"}
                            </Button>

                            <div className="mt-8 space-y-2 pt-4">
                                <p className="text-xs font-semibold">Delete database</p>
                                <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                                    Remove this saved connection from your workspace. The external database and its data will not be deleted.
                                </p>
                                <Button
                                    type="button"
                                    onClick={() => { setDeleteError(""); setDeleteOpen(true); }}
                                    disabled={deleting}
                                    className="flex h-7 items-center gap-1 border-0 bg-red-600 px-3 text-white shadow-none ring-1 ring-red-500 hover:bg-red-700 disabled:opacity-50 dark:text-zinc-100 !text-xs !font-semibold"
                                >
                                    <Trash2 size={12} />
                                    Delete database
                                </Button>
                            </div>
                        </form>
                    )}
                </section>
            </main>
            <AlertDialog open={deleteOpen} onOpenChange={(open) => { if (!deleting) setDeleteOpen(open); }}>
                <AlertDialogContent className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-sm font-semibold">Delete saved database?</AlertDialogTitle>
                        <AlertDialogDescription className="text-xs font-semibold">
                            This removes “{savedDbName}” and its saved connection from your workspace. The external database and its data will not be deleted.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting} className="!mt-0 h-6 border-0 bg-white p-1 px-2 text-black shadow-none ring-0 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900 !text-xs !font-semibold">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={deleting}
                            onClick={(event) => { event.preventDefault(); deleteDatabase(); }}
                            className="h-6 border-0 bg-red-600 p-1 px-2 text-white shadow-none ring-1 ring-red-500 hover:bg-red-700 disabled:opacity-50 dark:text-zinc-100 !text-xs !font-semibold"
                        >
                            {deleting ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

const mapStateToProps = (state) => ({ database: state.database, databases: state.databases });
export default connect(mapStateToProps, { setDatabase, setDatabases, setQueryTabs, setTables })(DatabaseSettingsPage);
