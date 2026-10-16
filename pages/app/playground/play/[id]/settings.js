import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { connect } from "react-redux";
import axios from "axios";
import { ArrowLeft, Settings2 } from "lucide-react";
import LeftBar from "@/components/navigationBar/leftBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setDatabase, setDatabases, setQueryTabs } from "@/redux/actions/main";
import { ShowNavigationButton, useNavigationVisibility } from "@/components/navigationBar/navigationVisibility";

function DatabaseSettingsPage({ database, databases, setDatabase, setDatabases, setQueryTabs }) {
    const router = useRouter();
    const { navigationHidden } = useNavigationVisibility();
    const databaseId = router.query.id;
    const [dbName, setDbName] = useState("");
    const [savedDbName, setSavedDbName] = useState("");
    const [createdAt, setCreatedAt] = useState(null);
    const [updatedAt, setUpdatedAt] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [saved, setSaved] = useState(false);

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
                setDatabase({ db_id: data.id, db_name: data.db_name });
            })
            .catch((requestError) => {
                if (!cancelled) setError(requestError.response?.data?.error || "Unable to load database settings.");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, [router.isReady, databaseId, setDatabase]);

    const saveSettings = async (event) => {
        event.preventDefault();
        const nextName = dbName.trim();
        if (!nextName || nextName === savedDbName) return;

        setSaving(true);
        setError("");
        setSaved(false);
        try {
            const { data } = await axios.patch(`/api/database/${encodeURIComponent(databaseId)}`, { db_name: nextName });
            setDbName(data.db_name);
            setSavedDbName(data.db_name);
            setUpdatedAt(data.updatedAt);
            setDatabase({ ...database, db_id: data.id, db_name: data.db_name });
            setDatabases((databases || []).map((item) => item.id === data.id ? { ...item, db_name: data.db_name } : item));
            setSaved(true);
        } catch (requestError) {
            setError(requestError.response?.data?.error || "Unable to save database settings.");
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

    return (
        <>
            <LeftBar openTab={openTable} openSqlTab={openSql} />
            <main className={`${navigationHidden ? "ml-0" : "ml-[240px]"} min-h-screen transition-[margin] duration-200`}>
                <div className="sticky top-0 z-40 flex h-[53px] items-center justify-between border-b bg-zinc-50 px-4 dark:bg-zinc-950">
                    <div className="flex items-center gap-2">
                    <ShowNavigationButton />
                    <Button
                        onClick={() => router.push(`/app/playground/play/${encodeURIComponent(databaseId)}`)}
                        className="h-6 border-0 bg-white p-1 px-2 text-black shadow-none ring-1 ring-zinc-300 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-900 !text-xs !font-semibold"
                    >
                        <ArrowLeft size={12} className="mr-1" /> Back to database
                    </Button>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
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
                        <p role="alert" className="text-xs font-semibold text-red-600 dark:text-red-400">{error}</p>
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

                            <div className="space-y-2">
                                <p className="text-xs font-semibold">Connection string</p>
                                <div className="w-[400px] rounded-md border bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
                                    Stored encrypted. Credentials are not displayed.
                                </div>
                            </div>

                            <div className="space-y-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                                <p>Created: {createdAt ? new Date(createdAt).toLocaleString() : "—"}</p>
                                <p>Last updated: {updatedAt ? new Date(updatedAt).toLocaleString() : "—"}</p>
                            </div>

                            {error && <p role="alert" className="text-xs font-semibold text-red-600 dark:text-red-400">{error}</p>}
                            {saved && <p role="status" className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Settings saved.</p>}

                            <Button
                                type="submit"
                                disabled={saving || !dbName.trim() || dbName.trim() === savedDbName}
                                className="h-7 border-0 bg-blue-600 px-3 text-white shadow-none hover:bg-blue-700 disabled:opacity-50 dark:text-zinc-100 !text-xs !font-semibold"
                            >
                                {saving ? "Saving..." : "Save changes"}
                            </Button>
                        </form>
                    )}
                </section>
            </main>
        </>
    );
}

const mapStateToProps = (state) => ({ database: state.database, databases: state.databases });
export default connect(mapStateToProps, { setDatabase, setDatabases, setQueryTabs })(DatabaseSettingsPage);
