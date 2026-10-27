import Image from "next/image";
import { useTheme } from "next-themes";
import { FaApple } from "react-icons/fa6";
import { FaGithub } from "react-icons/fa";
import { ChevronDown, Download, ExternalLink, Star } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const RELEASE_FALLBACK = {
    version: "0.0.3",
    url: "https://github.com/scasolari/pdv-martial/releases/tag/v0.0.3",
    appleSiliconUrl: "https://github.com/scasolari/pdv-martial/releases/download/v0.0.3/Placedv-Query-0.0.3-arm64.dmg",
    intelUrl: "https://github.com/scasolari/pdv-martial/releases/download/v0.0.3/Placedv-Query-0.0.3.dmg",
    stars: 0,
};

export async function getStaticProps() {
    try {
        const response = await fetch("https://api.github.com/repos/scasolari/pdv-martial/releases/latest", {
            headers: {
                Accept: "application/vnd.github+json",
                "User-Agent": "Placedv-Query-website",
            },
            signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) throw new Error(`GitHub release lookup failed: ${response.status}`);

        const latestRelease = await response.json();
        const assets = Array.isArray(latestRelease.assets) ? latestRelease.assets : [];
        const appleSiliconAsset = assets.find(({ name }) => /(?:arm64|aarch64).*\.dmg$/i.test(name));
        const intelAsset = assets.find(({ name }) => /\.dmg$/i.test(name) && !/(?:arm64|aarch64)/i.test(name));

        if (!latestRelease.tag_name || !appleSiliconAsset || !intelAsset) {
            throw new Error("Latest GitHub release is missing a Mac DMG asset.");
        }

        let stars = 0;
        try {
            const repositoryResponse = await fetch("https://api.github.com/repos/scasolari/pdv-martial", {
                headers: {
                    Accept: "application/vnd.github+json",
                    "User-Agent": "Placedv-Query-website",
                },
                signal: AbortSignal.timeout(5000),
            });
            if (repositoryResponse.ok) {
                const repository = await repositoryResponse.json();
                stars = Number.isInteger(repository.stargazers_count) ? repository.stargazers_count : 0;
            }
        } catch (error) {
            console.error("Unable to load GitHub star count:", error);
        }

        return {
            props: {
                release: {
                    version: latestRelease.tag_name.replace(/^v/i, ""),
                    url: latestRelease.html_url,
                    appleSiliconUrl: appleSiliconAsset.browser_download_url,
                    intelUrl: intelAsset.browser_download_url,
                    stars,
                },
            },
            revalidate: 300,
        };
    } catch (error) {
        console.error("Unable to load the latest GitHub release:", error);

        return {
            props: { release: RELEASE_FALLBACK },
            revalidate: 300,
        };
    }
}

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

export default function Home({ release }) {
    const starsLabel = release.stars >= 1000
        ? `${Math.floor(release.stars / 1000)}k+`
        : release.stars.toLocaleString("en-US");

    return (
        <main className="relative min-h-screen bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-100">
            <div className="fixed right-5 top-5 z-50 flex flex-row items-center gap-3">
                <ThemeSelector />
                <a
                    href="https://github.com/scasolari/pdv-martial/tree/feature/electron"
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${starsLabel} GitHub stars`}
                    className="inline-flex h-7 items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-2 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
                >
                    <Star aria-hidden="true" className="size-3.5 fill-amber-400 text-amber-400" />
                    <span className="font-semibold text-zinc-950 dark:text-zinc-100">{starsLabel}</span>
                    <span>GitHub stars</span>
                </a>
            </div>
            <div className="flex min-h-screen flex-col items-center justify-center gap-8 py-12">
                <div className="flex flex-col items-center gap-6 px-5">
                    <span className="flex size-16 items-center justify-center rounded-2xl bg-zinc-950 p-1 dark:ring-1 dark:ring-zinc-700">
                        <Image src="/placedv-query-desktop-icon.png" alt="" width={64} height={64} priority />
                    </span>
                    <div className="flex max-w-sm flex-col gap-1 text-center text-sm font-semibold leading-6 text-zinc-600 dark:text-zinc-400 mb-6">
                        <h3 className="text-xl text-primary">Open-source desktop database client.</h3>
                        <p>Connect, explore and manage your databases from one focused, open-source workspace.</p>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                className="group inline-flex h-9 items-center gap-2 rounded-md bg-zinc-950 px-3 text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:bg-white dark:text-zinc-950 dark:focus-visible:ring-offset-zinc-950"
                            >
                                <FaApple aria-hidden="true" size={16} />
                                <span className="text-xs font-semibold">Download for Mac</span>
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
        </main>
    );
}
