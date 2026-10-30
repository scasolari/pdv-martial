import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { FaApple, FaLinux, FaWindows } from "react-icons/fa6";
import { FaGithub } from "react-icons/fa";
import { ChevronDown, Download, ExternalLink, Heart } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getLatestRelease } from "@/lib/githubRelease";
import SiteTopbar from "@/components/siteTopbar";

export async function getStaticProps() {
    return {
        props: { release: await getLatestRelease() },
        revalidate: 300,
    };
}

export default function Home({ release }) {
    const [operatingSystem, setOperatingSystem] = useState("mac");

    useEffect(() => {
        const platform = `${navigator.userAgent} ${navigator.platform || ""}`.toLowerCase();
        if (platform.includes("win")) setOperatingSystem("windows");
        else if (platform.includes("linux") || platform.includes("x11")) setOperatingSystem("linux");
        else setOperatingSystem("mac");
    }, []);

    const downloadConfig = {
        mac: { label: "Download for Mac", icon: <FaApple aria-hidden="true" size={16} /> },
        windows: { label: "Download for Windows", icon: <FaWindows aria-hidden="true" size={16} />, url: release.windowsUrl },
        linux: { label: "Download for Linux", icon: <FaLinux aria-hidden="true" size={16} />, url: release.linuxUrl },
    }[operatingSystem];

    return (
        <main className="relative min-h-screen bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-100">
            <SiteTopbar stars={release.stars} />
            <div className="-mt-32 flex min-h-screen flex-col items-center justify-center gap-8 py-12">
                <div className="flex flex-col items-center gap-6 px-5">
                    <span className="flex size-16 items-center justify-center rounded-2xl bg-zinc-950 p-1 dark:ring-1 dark:ring-zinc-700">
                        <Image src="/placedv-query-desktop-icon.png" alt="" width={64} height={64} priority />
                    </span>
                    <div className="flex max-w-sm flex-col gap-1 text-center text-sm font-semibold leading-6 text-zinc-600 dark:text-zinc-400 mb-6">
                        <h3 className="text-xl text-primary">Open-source desktop database client.</h3>
                        <p>No AI. No hype. Just a focused, open-source workspace to connect, explore and manage your databases.</p>
                    </div>
                    {operatingSystem === "mac" ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    type="button"
                                    className="group inline-flex h-9 items-center gap-2 rounded-md bg-zinc-950 px-3 text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:bg-white dark:text-zinc-950 dark:focus-visible:ring-offset-zinc-950"
                                >
                                    {downloadConfig.icon}
                                    <span className="text-xs font-semibold">{downloadConfig.label}</span>
                                    <ChevronDown aria-hidden="true" className="size-4 opacity-70 transition-transform group-data-[state=open]:rotate-180" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="center" className="w-[var(--radix-dropdown-menu-trigger-width)]">
                                <DropdownMenuItem asChild className="text-xs font-semibold">
                                    <a href={release.appleSiliconUrl} target="_blank" rel="noreferrer" className="cursor-pointer" aria-label={`Download version ${release.version} for Apple silicon`}>
                                        <Download aria-hidden="true" className="mr-2 size-3.5" />
                                        Apple silicon
                                    </a>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild className="text-xs font-semibold">
                                    <a href={release.intelUrl} target="_blank" rel="noreferrer" className="cursor-pointer" aria-label={`Download version ${release.version} for Intel Mac`}>
                                        <Download aria-hidden="true" className="mr-2 size-3.5" />
                                        Intel Mac
                                    </a>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        <a
                            href={downloadConfig.url}
                            className="inline-flex h-9 items-center gap-2 rounded-md bg-zinc-950 px-3 text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:bg-white dark:text-zinc-950 dark:focus-visible:ring-offset-zinc-950"
                            aria-label={`${downloadConfig.label}, version ${release.version}`}
                        >
                            {downloadConfig.icon}
                            <span className="text-xs font-semibold">{downloadConfig.label}</span>
                            {operatingSystem === "linux" && <Download aria-hidden="true" className="size-3.5 opacity-70" />}
                        </a>
                    )}
                    <a
                        href={release.url}
                        target="_blank"
                        rel="noreferrer"
                        className="-mt-4 text-xs text-zinc-500 hover:underline dark:text-zinc-400"
                    >
                        Version {release.version}
                    </a>
                    <a
                        href="https://github.com/scasolari/pdv-martial/tree/feature/electron"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100"
                    >
                        <FaGithub aria-hidden="true" size={13} />
                        Steal our code (legally)
                        <ExternalLink aria-hidden="true" size={14} />
                    </a>
                </div>
            </div>
            <section aria-label="Placedv Query dashboard preview" className="relative z-10 mx-auto -mt-[26vh] w-full max-w-[1160px] px-4 pb-8">
                <Image
                    src="/placedv-query-dashboard-preview-light.png"
                    alt="Placedv Query database dashboard in light mode, with table navigation, filters, and records"
                    width={2000}
                    height={1356}
                    sizes="(max-width: 1192px) 100vw, 1128px"
                    quality={90}
                    className="h-auto w-full dark:hidden"
                />
                <Image
                    src="/placedv-query-dashboard-preview.png"
                    alt="Placedv Query database dashboard with table navigation, filters, and records"
                    width={2000}
                    height={1356}
                    sizes="(max-width: 1192px) 100vw, 1128px"
                    quality={90}
                    className="hidden h-auto w-full dark:block"
                />
            </section>
            <footer className="mx-auto flex w-full max-w-[1160px] items-center justify-center gap-2 px-4 pb-8 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                <Link href="/privacy" className="hover:text-zinc-950 dark:hover:text-zinc-100">Privacy</Link>
                <span aria-hidden="true">·</span>
                <Link href="/terms" className="hover:text-zinc-950 dark:hover:text-zinc-100">Terms</Link>
                <span aria-hidden="true">·</span>
                <a href="https://github.com/scasolari/pdv-martial/blob/feature/electron/LICENSE" target="_blank" rel="noreferrer" className="hover:text-zinc-950 dark:hover:text-zinc-100">MIT License</a>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1">
                    Built with <Heart aria-label="love" className="size-3 fill-rose-500 text-rose-500" /> by Sergio Casolari
                </span>
            </footer>
        </main>
    );
}
