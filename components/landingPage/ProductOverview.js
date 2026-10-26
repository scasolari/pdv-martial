import DatabaseEngineIcon from "@/components/databaseEngineIcon";
import { FaMicrosoft } from "react-icons/fa6";
import { SiMariadb, SiMysql, SiPostgresql, SiSqlite } from "react-icons/si";
import { Code2, History, Table as TableIcon } from "lucide-react";

const databaseEngines = [
    { name: "MySQL", icon: SiMysql, color: "#00758F" },
    { name: "MariaDB", icon: SiMariadb, color: "#003545" },
    { name: "PostgreSQL", icon: SiPostgresql, color: "#336791" },
    { name: "SQL Server", icon: FaMicrosoft, color: "#737373" },
    { name: "SQLite", icon: SiSqlite, color: "#0F80CC" },
];

const connectionTypes = [
    { name: "MySQL & MariaDB", detail: "Connect to popular relational databases.", engines: ["mysql", "mariadb"] },
    { name: "PostgreSQL & SQL Server", detail: "Use your existing database connections.", engines: ["postgres", "mssql"] },
    { name: "SQLite", detail: "Upload a local database file.", engines: ["sqlite"] },
];

const workspaceTools = [
    { title: "Table exploration", detail: "Browse, filter, group, and sort records.", icon: TableIcon },
    { title: "SQL workspace", detail: "Run queries and inspect the results.", icon: Code2 },
    { title: "Change history", detail: "Review edits and database activity.", icon: History },
];

function ProductOverview() {
    return <section id="features" className="mx-auto w-full max-w-[1280px] px-4 pb-20 pt-8 sm:px-6 lg:px-8">
        <div className="pt-2">
            <div className="text-center">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Works with your database</p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
                    {databaseEngines.map(({ name, icon: Icon, color }) => <div key={name} className="flex items-center gap-2 text-sm font-semibold tracking-tight text-zinc-700">
                        <Icon aria-hidden="true" size={22} color={color} />
                        <span>{name}</span>
                    </div>)}
                </div>
            </div>

            <div className="mx-auto mt-16 max-w-3xl text-center">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">A workspace for database work</p>
                <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
                    From a database connection to the data you need
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-zinc-600">
                    Placedv Query brings connections, table exploration, and SQL into one interface, with tools to
                    filter records, review edits, and keep track of database activity.
                </p>
            </div>

            <div className="mx-auto mt-12 grid max-w-[1100px] grid-cols-1 items-center gap-6 lg:grid-cols-[1fr_1.35fr_1fr] lg:gap-8">
                <div className="space-y-3">
                    <p className="mb-4 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 lg:text-left">Database connections</p>
                    {connectionTypes.map(({ name, detail, engines }) => <div key={name} className="flex flex-col items-start rounded-2xl bg-zinc-100 p-3 text-left transition-colors hover:bg-zinc-200/70">
                        <div className="flex h-5 shrink-0 items-center justify-start gap-1">
                            {engines.map((engine) => <DatabaseEngineIcon key={engine} dialect={engine} size={15} />)}
                        </div>
                        <div className="mt-1 min-w-0 w-full">
                            <p className="truncate text-xs font-semibold">{name}</p>
                            <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-zinc-500">{detail}</p>
                        </div>
                    </div>)}
                </div>

                <div className="rounded-2xl bg-zinc-900 p-6 text-white sm:p-8">
                    <p className="text-center text-sm font-semibold">Placedv Query</p>
                    <div className="relative mx-auto my-12 flex h-48 w-48 items-center justify-center rounded-full border-[5px] border-zinc-700 sm:h-52 sm:w-52">
                        <span className="max-w-[100px] text-center text-sm font-semibold leading-tight text-zinc-200">Your database workspace</span>
                        <span className="absolute left-1/2 top-0 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-violet-200 text-xs font-bold text-zinc-900">1</span>
                        <span className="absolute right-0 top-1/2 flex h-8 w-8 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full bg-violet-200 text-xs font-bold text-zinc-900">2</span>
                        <span className="absolute bottom-0 left-1/2 flex h-8 w-8 -translate-x-1/2 translate-y-1/2 items-center justify-center rounded-full bg-violet-200 text-xs font-bold text-zinc-900">3</span>
                        <span className="absolute left-0 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-violet-200 text-xs font-bold text-zinc-900">4</span>
                        <span className="absolute -top-9 left-1/2 w-36 -translate-x-1/2 text-center text-[10px] font-semibold text-zinc-300">Connect database</span>
                        <span className="absolute -right-[112px] top-1/2 w-20 -translate-y-1/2 text-left text-[10px] font-semibold leading-tight text-zinc-300">Explore<br />tables</span>
                        <span className="absolute -bottom-9 left-1/2 w-32 -translate-x-1/2 text-center text-[10px] font-semibold text-zinc-300">Run SQL</span>
                        <span className="absolute -left-[112px] top-1/2 w-20 -translate-y-1/2 text-right text-[10px] font-semibold leading-tight text-zinc-300">Review<br />changes</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-semibold leading-tight">
                        <div className="rounded-lg bg-white px-2 py-3 text-zinc-900">Connect</div>
                        <div className="rounded-lg bg-white px-2 py-3 text-zinc-900">Explore</div>
                        <div className="rounded-lg bg-white px-2 py-3 text-zinc-900">Query &amp; review</div>
                    </div>
                </div>

                <div className="space-y-3">
                    <p className="mb-4 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 lg:text-left">Tools in one place</p>
                    {workspaceTools.map(({ title, detail, icon: Icon }) => <div key={title} className="flex flex-col items-start rounded-2xl bg-zinc-100 p-3 text-left transition-colors hover:bg-zinc-200/70">
                        <div className="flex h-5 shrink-0 items-center justify-start"><Icon size={20} className="text-zinc-800" /></div>
                        <div className="mt-1 min-w-0 w-full"><p className="truncate text-xs font-semibold">{title}</p><p className="mt-0.5 line-clamp-2 text-xs leading-4 text-zinc-500">{detail}</p></div>
                    </div>)}
                </div>
            </div>
        </div>
    </section>;
}

export default ProductOverview;
