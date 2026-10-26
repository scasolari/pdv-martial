import Image from "next/image";
import { useTheme } from "next-themes";
import { FaApple } from "react-icons/fa6";
import { Check } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const appFeatures = [
    "Opens as a native Electron app in its own macOS window.",
    "Runs its application services locally on this Mac.",
    "Stores the workspace database and SQLite uploads in local app storage.",
    "Protects the encryption key with macOS secure storage.",
    "Connects directly from this Mac to MySQL, MariaDB, PostgreSQL, SQL Server, and SQLite.",
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
            <div className="absolute right-5 top-5">
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
                <section aria-labelledby="features-title" className="w-80 max-w-[calc(100vw-2rem)]">
                    <h1 id="features-title" className="mb-3 text-center text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                        macOS desktop
                    </h1>
                    <ul className="space-y-2.5">
                        {appFeatures.map((feature) => (
                            <li key={feature} className="flex items-start gap-2.5 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
                                <Check aria-hidden="true" size={14} className="mt-0.5 shrink-0 text-zinc-900 dark:text-zinc-100" />
                                <span>{feature}</span>
                            </li>
                        ))}
                    </ul>
                </section>
            </div>
        </main>
    );
}
