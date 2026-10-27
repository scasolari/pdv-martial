import Image from "next/image";
import { useTheme } from "next-themes";
import { FaApple } from "react-icons/fa6";
import { ExternalLink, Github } from "lucide-react";
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
            <div className="fixed right-5 top-5 z-50 flex items-center gap-3">
                <a
                    href="https://github.com/scasolari/pdv-martial/tree/feature/electron"
                    target="_blank"
                    rel="noreferrer"
                    aria-label="View Placedv Query GitHub stars"
                    className="inline-flex h-7 items-center rounded-md transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950"
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="https://img.shields.io/github/stars/scasolari/pdv-martial?style=flat&label=Stars"
                        alt="GitHub stars"
                        className="h-5 w-auto"
                    />
                </a>
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
                            aria-label="Download Placedv Query for Apple silicon"
                            className="group inline-flex h-12 w-52 items-center gap-3 rounded-lg bg-zinc-950 px-3 text-left text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-zinc-800 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 dark:focus-visible:ring-offset-zinc-950"
                        >
                            <span className="flex size-8 shrink-0 items-center justify-center">
                                <FaApple aria-hidden="true" size={16} />
                            </span>
                            <span className="flex min-w-0 flex-col">
                                <span className="text-xs font-semibold leading-4">Download for Mac</span>
                                <span className="text-[10px] font-medium leading-3 opacity-70">Apple silicon</span>
                            </span>
                        </a>
                        <a
                            href="https://github.com/scasolari/pdv-martial/releases/download/v0.0.1/Placedv.Query-0.0.1.dmg"
                            target="_blank"
                            rel="noreferrer"
                            aria-label="Download Placedv Query for Intel Mac"
                            className="group inline-flex h-12 w-52 items-center gap-3 rounded-lg bg-zinc-950 px-3 text-left text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-zinc-800 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 dark:focus-visible:ring-offset-zinc-950"
                        >
                            <span className="flex size-8 shrink-0 items-center justify-center">
                                <FaApple aria-hidden="true" size={16} />
                            </span>
                            <span className="flex min-w-0 flex-col">
                                <span className="text-xs font-semibold leading-4">Download for Mac</span>
                                <span className="text-[10px] font-medium leading-3 opacity-70">Intel processor</span>
                            </span>
                        </a>
                    </div>
                    <p className="-mt-4 text-xs text-zinc-500 dark:text-zinc-400">Version 0.0.1</p>
                    <a
                        href="https://github.com/scasolari/pdv-martial/tree/feature/electron"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100"
                    >
                        <Github aria-hidden="true" size={13} />
                        Steal our code (legally)
                        <ExternalLink aria-hidden="true" size={14} />
                    </a>
                </div>
            </div>
        </main>
    );
}
