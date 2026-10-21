import {Button} from "@/components/ui/button";
import {Label} from "@/components/ui/label";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import axios from "axios";
import {useState} from "react";
import {setDatabases} from "@/redux/actions/main";
import {connect} from "react-redux";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronRight } from "lucide-react";
import { toast } from "@/components/ui/base-toast";


function AddDatabase(props) {
    const {databases, setDatabases, onSuccess, onClose} = props
    const [connectionMode, setConnectionMode] = useState("remote");
    const [sqliteFile, setSqliteFile] = useState(null);
    const [form, setForm] = useState({
        db_name: "",
        url_connection: "",
        authorizationConfirmed: false,
        ssl: { enabled: false, mode: "verify-full" },
        ssh: { enabled: false, host: "", port: "22", username: "", authType: "password", password: "", privateKey: "", passphrase: "", hostFingerprint: "" },
    })
    const [loadingCheckConnection, setLoadingCheckConnection] = useState(false);
        const [connectionResponse, setConnectionResponse] = useState({
        status: "",
        message: ""
    });
    const add_database = (e) => {
        e.preventDefault();
        const request = connectionMode === "sqlite"
            ? (() => {
                if (!sqliteFile) {
                    toast.add({ title: "Select a SQLite file", description: "Choose a database file before saving.", type: "warning" });
                    return Promise.reject(new Error("SQLite file is required."));
                }
                const upload = new FormData();
                upload.append("db_name", form.db_name);
                upload.append("authorizationConfirmed", String(form.authorizationConfirmed));
                upload.append("file", sqliteFile);
                return axios.post("/api/database/add/sqlite", upload);
            })()
            : axios.post(`/api/database/add`, { form });
        request.then((res) => {
            setDatabases([res.data, ...databases])
            toast.add({ title: "Dataset added", description: "The database is ready to use.", type: "success" });
            if (onSuccess) {
                onSuccess();
            }
        }).catch((err) => {
            const message = err.response?.data?.error || "Unable to save dataset.";
            if (err.message !== "SQLite file is required.") toast.add({ title: "Unable to add dataset", description: message, type: "error" });
        })
    }
    const test_db_connection = () => {
        if(form.url_connection.length === 0) return null
        setLoadingCheckConnection(true)
        setConnectionResponse({
            status: "",
            message: ""
        })
        axios.post(`/api/database/check-database`, { form }).then((res) => {
            setLoadingCheckConnection(false)
            setConnectionResponse({
                status: true,
                message: res.data.message,
            })
            toast.add({ title: "Connection successful", description: res.data.message, type: "success" });
        }).catch((e) => {
            setLoadingCheckConnection(false)
            const message = e.response?.data?.message || "Unable to connect to the database.";
            setConnectionResponse({
                status: false,
                message,
            })
            toast.add({ title: "Connection failed", description: message, type: "error" });
        })
    }
    return <form onSubmit={add_database} className="flex flex-col gap-3">
        <div>
            <Label className="text-xs font-semibold text-zinc-500">Dataset name</Label>
            <Input
                required
                value={form.db_name}
                onChange={(e) => setForm({
                    ...form,
                    db_name: e.target.value
                })}
                placeholder="Enter dataset name..."
                className="shadow-none border-0 ring-1 ring-zinc-200 px-2 h-8 !text-xs !font-semibold dark:ring-zinc-700 focus-visible:dark:!ring-blue-500"
            />
        </div>
        <Tabs value={connectionMode} onValueChange={setConnectionMode} className="w-fit">
            <TabsList className="h-7 p-0.5">
                <TabsTrigger value="remote" className="h-6 px-2 py-0 !text-xs !font-semibold">Connection string</TabsTrigger>
                <TabsTrigger value="sqlite" className="h-6 px-2 py-0 !text-xs !font-semibold">SQLite file</TabsTrigger>
            </TabsList>
        </Tabs>
        {connectionMode === "remote" ? <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
                <Label className="text-xs text-zinc-500 font-semibold">Database connection string</Label>
                        <Button
                    type="button"
                            variant="ghost"
                            size="sm"
                    disabled={loadingCheckConnection || !form.url_connection || !form.authorizationConfirmed}
                            className={`!h-6 !px-1.5 !py-0 !text-xs !font-semibold text-zinc-500 shadow-none hover:text-zinc-950 dark:hover:text-neutral-300 disabled:cursor-not-allowed ${loadingCheckConnection ? "!text-zinc-500" : ""}`}
                    onClick={test_db_connection}
                >
                    <span className="flex items-center gap-1.5">
                        {loadingCheckConnection &&
                            <svg className="size-3 animate-spin text-blue-600"
                                 xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor"
                                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        }
                        <span>Test connection</span>
                    </span>
                </Button>
            </div>
            <Input
                required
                disabled={loadingCheckConnection}
                value={form.url_connection}
                onChange={(e) => setForm({
                    ...form,
                    url_connection: e.target.value
                })}
                placeholder="mysql://, mariadb://, postgresql:// or mssql://"
                className="shadow-none border-0 ring-1 ring-zinc-200 px-2 h-8 !text-xs !font-semibold dark:ring-zinc-700 focus-visible:dark:!ring-blue-500"
            />
            <div>
                {connectionResponse &&
                    <p className={`text-xs font-semibold ${connectionResponse.status ? `text-green-600` : `text-red-600`}`}>{connectionResponse.message}</p>}
            </div>
            <details className="group mt-2 p-2">
                <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-semibold [&::-webkit-details-marker]:hidden">
                    <ChevronRight size={14} className="shrink-0 transition-transform group-open:rotate-90" />
                    Advanced connection options
                </summary>
                <div className="mt-3 flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-xs font-semibold">
                        <Checkbox checked={form.ssl.enabled} onCheckedChange={(checked) => setForm({ ...form, ssl: { ...form.ssl, enabled: Boolean(checked) } })} className="h-3.5 w-3.5 border-zinc-400 data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600" />
                        Use SSL/TLS encryption
                    </div>
                    {form.ssl.enabled && <div className="flex flex-col gap-1">
                        <Label className="text-xs font-semibold text-zinc-500">Certificate verification</Label>
                        <Select value={form.ssl.mode} onValueChange={(value) => setForm({ ...form, ssl: { ...form.ssl, mode: value } })}>
                            <SelectTrigger className="h-8 !text-xs !font-semibold"><SelectValue /></SelectTrigger>
                            <SelectContent className="z-[1100] !text-xs !font-semibold">
                                <SelectItem value="verify-full" className="!text-xs !font-semibold">Verify certificate and hostname</SelectItem>
                                <SelectItem value="verify-ca" className="!text-xs !font-semibold">Verify certificate</SelectItem>
                                <SelectItem value="require" className="!text-xs !font-semibold">Encrypt without certificate verification</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>}
                    <div className="flex items-center gap-2 text-xs font-semibold">
                        <Checkbox checked={form.ssh.enabled} onCheckedChange={(checked) => setForm({ ...form, ssh: { ...form.ssh, enabled: Boolean(checked) } })} className="h-3.5 w-3.5 border-zinc-400 data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600" />
                        Connect through an SSH tunnel
                    </div>
                    {form.ssh.enabled && <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1"><Label className="text-xs font-semibold text-zinc-500">SSH host</Label><Input required value={form.ssh.host} onChange={(event) => setForm({ ...form, ssh: { ...form.ssh, host: event.target.value } })} placeholder="bastion.example.com" className="h-8 !text-xs !font-semibold" /></div>
                        <div className="flex flex-col gap-1"><Label className="text-xs font-semibold text-zinc-500">SSH port</Label><Input required type="number" min="1" max="65535" value={form.ssh.port} onChange={(event) => setForm({ ...form, ssh: { ...form.ssh, port: event.target.value } })} className="h-8 !text-xs !font-semibold" /></div>
                        <div className="flex flex-col gap-1"><Label className="text-xs font-semibold text-zinc-500">SSH username</Label><Input required value={form.ssh.username} onChange={(event) => setForm({ ...form, ssh: { ...form.ssh, username: event.target.value } })} autoComplete="off" className="h-8 !text-xs !font-semibold" /></div>
                        <div className="flex flex-col gap-1"><Label className="text-xs font-semibold text-zinc-500">Authentication</Label><Select value={form.ssh.authType} onValueChange={(value) => setForm({ ...form, ssh: { ...form.ssh, authType: value } })}><SelectTrigger className="h-8 !text-xs !font-semibold"><SelectValue /></SelectTrigger><SelectContent className="z-[1100] !text-xs !font-semibold"><SelectItem value="password" className="!text-xs !font-semibold">Password</SelectItem><SelectItem value="privateKey" className="!text-xs !font-semibold">Private key</SelectItem></SelectContent></Select></div>
                        {form.ssh.authType === "password" ? <div className="col-span-2 flex flex-col gap-1"><Label className="text-xs font-semibold text-zinc-500">SSH password</Label><Input required type="password" value={form.ssh.password} onChange={(event) => setForm({ ...form, ssh: { ...form.ssh, password: event.target.value } })} autoComplete="new-password" className="h-8 !text-xs !font-semibold" /></div> : <>
                            <div className="col-span-2 flex flex-col gap-1"><Label className="text-xs font-semibold text-zinc-500">SSH private key</Label><Textarea required value={form.ssh.privateKey} onChange={(event) => setForm({ ...form, ssh: { ...form.ssh, privateKey: event.target.value } })} rows={4} autoComplete="off" className="min-h-0 resize-y rounded-md border-0 bg-white p-2 !text-xs !font-semibold shadow-none ring-1 ring-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-0 dark:bg-zinc-950 dark:ring-zinc-700" /></div>
                            <div className="col-span-2 flex flex-col gap-1"><Label className="text-xs font-semibold text-zinc-500">Key passphrase (if required)</Label><Input type="password" value={form.ssh.passphrase} onChange={(event) => setForm({ ...form, ssh: { ...form.ssh, passphrase: event.target.value } })} autoComplete="new-password" className="h-8 !text-xs !font-semibold" /></div>
                        </>}
                        <div className="col-span-2 flex flex-col gap-1"><Label className="text-xs font-semibold text-zinc-500">SSH server SHA-256 fingerprint</Label><Input required value={form.ssh.hostFingerprint} onChange={(event) => setForm({ ...form, ssh: { ...form.ssh, hostFingerprint: event.target.value } })} placeholder="SHA256:..." className="h-8 !text-xs !font-semibold" /><p className="text-xs font-semibold text-zinc-500">Used to verify the SSH server identity before sending credentials.</p></div>
                    </div>}
                </div>
            </details>
        </div> : <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold text-zinc-500">SQLite database file</Label>
            <Input
                type="file"
                accept=".db,.sqlite,.sqlite3,application/vnd.sqlite3"
                disabled={loadingCheckConnection}
                onChange={(event) => setSqliteFile(event.target.files?.[0] || null)}
                className="h-8 px-2 py-1 !text-xs !font-semibold shadow-none ring-1 ring-zinc-200 dark:ring-zinc-700"
            />
            <p className="text-xs font-semibold text-zinc-500">The file is copied to private app storage for this account. Maximum size: 512 MB.</p>
        </div>}
        <div className="flex items-start gap-2 text-xs font-semibold leading-relaxed text-zinc-600 dark:text-zinc-300">
            <Checkbox id="database-authorization-confirmation" checked={form.authorizationConfirmed} onCheckedChange={(checked) => setForm({ ...form, authorizationConfirmed: checked === true })} className="mt-0.5 h-3.5 w-3.5 shrink-0 border-zinc-400 data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600" />
            <label htmlFor="database-authorization-confirmation" className="cursor-pointer">I confirm that I own this database or am authorised by its owner to connect it and process its contents through Placedv Query. If I act for a client, I have obtained any required written approval, including approval for Placedv Query and its listed sub-processors.</label>
        </div>
        <div className="mt-2 flex items-center justify-end gap-3">
            <Button type="button"
                    onClick={() => {
                        if (onClose) {
                            onClose();
                        }
                    }}
                    className="flex h-6 items-center gap-1 border-0 bg-white p-1 px-2 text-black shadow-none ring-0 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900 !text-xs !font-semibold"
            >
                Cancel
            </Button>
            <Button type="submit" disabled={!form.authorizationConfirmed || (connectionMode === "sqlite" && !sqliteFile)}
                    className="flex items-center gap-1 ring-1 ring-blue-500 bg-blue-600 hover:bg-blue-700 border-0 p-1 px-2 h-6 shadow-none text-white dark:text-zinc-100 !text-xs !font-semibold"
            >
                Add dataset
            </Button>
        </div>
    </form>
}

const mapStateToProps = (state) => {
    return {
        databases: state.databases,
    };
};

const mapDispatchToProps = {
    setDatabases
};

export default connect(mapStateToProps, mapDispatchToProps)(AddDatabase);
