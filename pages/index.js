import Image from "next/image";
import { useTheme } from "next-themes";
import { FaApple } from "react-icons/fa6";
import { Github } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
        <main className="relative min-h-screen bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-100">
            <div className="fixed right-5 top-5 z-50">
                <ThemeSelector />
            </div>
            <div className="flex min-h-screen flex-col items-center justify-center gap-8 py-12">
                <div className="flex flex-col items-center gap-6 px-5">
                    <span className="flex size-16 items-center justify-center rounded-2xl bg-zinc-950 p-1 dark:ring-1 dark:ring-zinc-700">
                        <Image src="/placedv-query-desktop-icon.png" alt="" width={64} height={64} priority />
                    </span>
                    <p className="max-w-sm text-center text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                        Connect, explore and manage your databases from one focused workspace.
                    </p>
                    <div className="flex flex-col items-center gap-2 sm:flex-row">
                        <a
                            href="https://github.com/scasolari/pdv-martial/releases/download/v0.0.1/Placedv.Query-0.0.1-arm64.dmg"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 text-xs font-semibold text-white transition-colors hover:bg-zinc-700 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                        >
                            <FaApple aria-hidden="true" size={14} />
                            Apple silicon
                        </a>
                        <a
                            href="https://github.com/scasolari/pdv-martial/releases/download/v0.0.1/Placedv.Query-0.0.1.dmg"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-zinc-300 px-4 text-xs font-semibold text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
                        >
                            <FaApple aria-hidden="true" size={14} />
                            Intel
                        </a>
                    </div>
                    <p className="-mt-4 text-xs text-zinc-500 dark:text-zinc-400">Version 0.0.1</p>
                    <a
                        href="https://github.com/scasolari/pdv-martial"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100"
                    >
                        <Github aria-hidden="true" size={13} />
                        Steal our code (legally)
                    </a>
                </div>
            </div>
        </main>
    );
}
