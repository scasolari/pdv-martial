import Image from "next/image";
import { useTheme } from "next-themes";
import { FaApple } from "react-icons/fa6";
import { Check } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const appFeatures = [
    {
        title: "Connect databases",
        description: "Connect to MySQL, MariaDB, PostgreSQL, Microsoft SQL Server, or SQLite. Test connections, use TLS/SSL, and configure SSH tunnels with passwords or private keys.",
    },
    {
        title: "Find databases and tables",
        description: "Search your saved databases and table names, refresh the database schema, and keep multiple tables open in tabs.",
    },
    {
        title: "Shape table views",
        description: "Filter with multiple conditions, group and sort records, choose visible columns, and set the number of rows per page.",
    },
    {
        title: "Edit database records",
        description: "Insert rows, edit cell values, and delete selected rows. Review pending changes before committing them to the database.",
    },
    {
        title: "Export table data",
        description: "Download table results as CSV or JSON, with sensitive columns masked according to your settings.",
    },
    {
        title: "Work with SQL",
        description: "Write SQL in a syntax-highlighted editor, keep multiple query tabs, run queries, browse paginated results, and export them as CSV or JSON.",
    },
    {
        title: "Review database activity",
        description: "Browse system and user events, filter or group history, inspect query status and duration, reopen queries in the editor, and export the log.",
    },
    {
        title: "Protect sensitive columns",
        description: "Choose columns to mask in table views and exports, and enable two-factor authentication for your account.",
    },
    {
        title: "Work with SQLite files",
        description: "Add a local SQLite database file and browse its tables alongside your other database connections.",
    },
    {
        title: "Keep workspace data local",
        description: "Store the workspace database and uploaded SQLite files in this Mac’s app storage. Saved connection strings are encrypted.",
    },
    {
        title: "Personalize your workspace",
        description: "Choose Light, Dark, or System appearance, set the default table page size, and show or hide database navigation.",
    },
    {
        title: "Manage account data",
        description: "Export your profile, saved connection settings, and retained activity history, or delete your account and its saved records.",
    },
    {
        title: "Navigate accessibly",
        description: "Use keyboard navigation and visible focus indicators across settings and table controls.",
    },
];

function ThemeSelector() {
    const { theme, setTheme } = useTheme();

    return (
        <Tabs aria-label="Theme" value={theme || "system"} onValueChange={setTheme}>
            <TabsList className="h-7 p-0.5">
                <TabsTrigger value="light" className="h-6 px-2 py-0 !text-xs !font-semibold">Light</TabsTrigger>
                <TabsTrigger value="dark" className="h-6 px-2 py-0 !text-xs !font-semibold">Dark</TabsTrigger>
                <TabsTrigger value="system" className="h-6 px-2 py-0 !text-xs !font-semibold">System</TabsTrigger>
            </TabsList>
        </Tabs>
    );
}

export default function Home() {
    return (
        <main className="relative flex min-h-screen items-center justify-center bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-100">
            <div className="fixed right-5 top-5 z-50">
                <ThemeSelector />
            </div>
            <div className="flex flex-col items-center gap-8 py-12">
                <span className="flex size-16 items-center justify-center rounded-2xl bg-zinc-950 p-1 dark:ring-1 dark:ring-zinc-700">
                    <Image src="/placedv-query-desktop-icon.png" alt="" width={64} height={64} priority />
                </span>
                <a
                    href="https://github.com/scasolari/pdv-martial/releases"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 text-xs font-semibold text-white transition-colors hover:bg-zinc-700 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                >
                    <FaApple aria-hidden="true" size={14} />
                    Download for Mac
                </a>
                <section aria-labelledby="features-title" className="w-[28rem] max-w-[calc(100vw-2rem)]">
                    <h1 id="features-title" className="mb-3 text-center text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                        Features
                    </h1>
                    <ul className="space-y-3">
                        {appFeatures.map(({ title, description }) => (
                            <li key={title} className="flex items-start gap-2.5 text-xs leading-5">
                                <Check aria-hidden="true" size={14} className="mt-0.5 shrink-0 text-zinc-900 dark:text-zinc-100" />
                                <div>
                                    <p className="font-semibold text-zinc-900 dark:text-zinc-100">{title}</p>
                                    <p className="text-zinc-600 dark:text-zinc-400">{description}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            </div>
        </main>
    );
}
