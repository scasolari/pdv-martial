import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { FaApple, FaLinux, FaWindows } from "react-icons/fa6";
import { FaGithub } from "react-icons/fa";
import { Download, ExternalLink, Heart } from "lucide-react";
import { getLatestRelease } from "@/lib/githubRelease";
import SiteTopbar from "@/components/siteTopbar";

const themePreviews = [
    { id: "graphite", src: "/placedv-query-theme-graphite.webp", alt: "Database workspace with the graphite dark theme", swatch: "radial-gradient(circle at 32% 26%, #686868 0%, #252525 58%, #090909 100%)" },
    { id: "olive", src: "/placedv-query-theme-olive.webp", alt: "Database workspace with an olive theme", swatch: "radial-gradient(circle at 32% 26%, #c4ceb0 0%, #858b70 58%, #505744 100%)" },
    { id: "green", src: "/placedv-query-theme-green.webp", alt: "Database workspace with a green theme", swatch: "radial-gradient(circle at 32% 26%, #72e3b7 0%, #00a979 58%, #006548 100%)" },
    { id: "red", src: "/placedv-query-theme-red.webp", alt: "Database workspace with a red theme", swatch: "radial-gradient(circle at 32% 26%, #ff91a8 0%, #e11d48 58%, #98102e 100%)" },
    { id: "blue", src: "/placedv-query-theme-blue.webp", alt: "Database workspace with a blue theme", swatch: "radial-gradient(circle at 32% 26%, #8bb5ff 0%, #315fc1 58%, #1b3473 100%)" },
];

export async function getStaticProps() {
    return {
        props: { release: await getLatestRelease() },
        revalidate: 300,
    };
}

export default function Home({ release }) {
    const { resolvedTheme } = useTheme();
    const [operatingSystem, setOperatingSystem] = useState("mac");
    const [macDownloadUrl, setMacDownloadUrl] = useState(release.url);
    const [activePreviewId, setActivePreviewId] = useState("graphite");
    const activePreview = themePreviews.find(({ id }) => id === activePreviewId) || themePreviews[0];

    useEffect(() => {
        const platform = `${navigator.userAgent} ${navigator.platform || ""}`.toLowerCase();
        if (platform.includes("win")) setOperatingSystem("windows");
        else if (platform.includes("linux") || platform.includes("x11")) setOperatingSystem("linux");
        else setOperatingSystem("mac");

        // User-Agent Client Hints exposes the CPU architecture in Chromium browsers.
        // Safari and Firefox may not expose it, so send those users to the release
        // page where both Mac builds are listed instead of guessing incorrectly.
        const userAgentData = navigator.userAgentData;
        if (typeof userAgentData?.getHighEntropyValues === "function") {
            userAgentData.getHighEntropyValues(["architecture"])
                .then(({ architecture }) => {
                    if (/^(arm|aarch64)/i.test(architecture || "")) setMacDownloadUrl(release.appleSiliconUrl);
                    else if (/^x86/i.test(architecture || "")) setMacDownloadUrl(release.intelUrl);
                })
                .catch(() => {});
        }
    }, [release.appleSiliconUrl, release.intelUrl, release.url]);

    const downloadConfig = {
        mac: { label: "Download for Mac", icon: <FaApple aria-hidden="true" size={16} />, url: macDownloadUrl },
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
                    <a
                        href={downloadConfig.url}
                        className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 hover:bg-blue-700 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-700 dark:focus-visible:ring-offset-zinc-950"
                        aria-label={`${downloadConfig.label}, version ${release.version}`}
                    >
                        {downloadConfig.icon}
                        <span className="text-xs font-semibold">{downloadConfig.label}</span>
                        {operatingSystem === "linux" && <Download aria-hidden="true" className="size-3.5 opacity-70" />}
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
                {resolvedTheme === "dark" ? (
                    <Image
                        key={activePreviewId}
                        src={activePreview.src}
                        alt={activePreview.alt}
                        width={2000}
                        height={1356}
                        sizes="(max-width: 1192px) 100vw, 1128px"
                        quality={90}
                        priority
                        className="landing-preview-image-change h-auto w-full"
                    />
                ) : (
                    <Image
                        src="/placedv-query-dashboard-preview-light-v2.webp"
                        alt="Placedv Query database dashboard in light mode, with table navigation, filters, and records"
                        width={2000}
                        height={1356}
                        sizes="(max-width: 1192px) 100vw, 1128px"
                        quality={90}
                        priority
                        className="h-auto w-full"
                    />
                )}
                {resolvedTheme === "dark" && (
                    <div role="group" aria-label="Choose a dashboard color theme" className="mt-4 flex items-center justify-center gap-2">
                        {themePreviews.map(({ id, swatch }) => (
                            <button
                                key={id}
                                type="button"
                                aria-label={`Show ${id} theme`}
                                aria-pressed={activePreviewId === id}
                                onClick={() => setActivePreviewId(id)}
                                className={`group flex size-8 items-center justify-center rounded-full transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007aff] focus-visible:ring-offset-1 focus-visible:ring-offset-zinc-950 ${activePreviewId === id ? "ring-2 ring-[#007aff] ring-offset-1 ring-offset-zinc-950" : ""}`}
                            >
                                <span aria-hidden="true" className="size-6 rounded-full border border-black/10 shadow-[inset_0_1px_2px_rgba(255,255,255,0.55),0_1px_3px_rgba(0,0,0,0.35)] transition-[filter] group-hover:brightness-110 dark:border-white/20" style={{ background: swatch }} />
                            </button>
                        ))}
                    </div>
                )}
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
