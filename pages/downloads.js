import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { FaApple, FaLinux, FaWindows } from "react-icons/fa6";
import { Download } from "lucide-react";
import { getLatestRelease } from "@/lib/githubRelease";
import SiteTopbar from "@/components/siteTopbar";

export async function getStaticProps() {
    return {
        props: { release: await getLatestRelease() },
        revalidate: 300,
    };
}

function DownloadOption({ href, label, detail }) {
    return (
        <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between gap-4 text-xs font-semibold text-zinc-500 underline underline-offset-4 transition-colors hover:text-zinc-950 hover:no-underline dark:text-zinc-500 dark:hover:text-white"
        >
            <span>{label}<span className="ml-1 font-medium text-zinc-500 dark:text-zinc-400">{detail}</span></span>
            <Download aria-hidden="true" className="size-3.5 shrink-0 text-zinc-500" />
        </a>
    );
}

function PlatformCard({ icon: Icon, title, children }) {
    return (
        <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Icon aria-hidden="true" className="size-4" />
                {title}
            </h2>
            <div className="space-y-2">{children}</div>
        </section>
    );
}

export default function Downloads({ release }) {
    return (
        <main className="min-h-screen bg-white px-5 py-8 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-100 sm:px-8 sm:py-12">
            <SiteTopbar stars={release.stars} />
            <Head>
                <title>Downloads · Placedv Query</title>
                <meta name="description" content="Download Placedv Query for macOS, Windows, or Linux." />
            </Head>
            <header className="mx-auto h-8 w-full max-w-4xl">
                <Link href="/" aria-label="Placedv Query home" className="fixed left-5 top-5 z-50">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-zinc-950 p-0.5 dark:ring-1 dark:ring-zinc-700">
                        <Image src="/placedv-query-desktop-icon.png" alt="" width={28} height={28} priority />
                    </span>
                </Link>
            </header>
            <div className="mx-auto mt-20 w-full max-w-2xl sm:mt-28">
                <Link href="/" className="text-xs font-semibold text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-100">← Back to home</Link>
                <div className="mt-5 flex flex-wrap items-baseline justify-between gap-2">
                    <h1 className="text-3xl font-semibold tracking-tight">Downloads</h1>
                    <a href={release.url} target="_blank" rel="noreferrer" className="text-xs font-medium text-zinc-500 hover:underline dark:text-zinc-400">
                        Version {release.version}
                    </a>
                </div>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Choose a package for your operating system.</p>
                <div className="mt-8 space-y-8">
                    <PlatformCard icon={FaApple} title="macOS">
                        <DownloadOption href={release.appleSiliconUrl} label="Apple silicon" detail="(.dmg)" />
                        <DownloadOption href={release.intelUrl} label="Intel" detail="(.dmg)" />
                    </PlatformCard>
                    <PlatformCard icon={FaWindows} title="Windows">
                        <DownloadOption href={release.windowsUrl} label="x64 Installer" detail="(.exe)" />
                    </PlatformCard>
                    <PlatformCard icon={FaLinux} title="Linux">
                        <DownloadOption href={release.linuxUrl} label="AppImage" detail="(x64)" />
                        <DownloadOption href={release.linuxDebUrl} label="Debian / Ubuntu" detail="(.deb, x64)" />
                    </PlatformCard>
                </div>
                <footer className="mt-8 flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    <Link href="/privacy" className="hover:text-zinc-950 dark:hover:text-zinc-100">Privacy</Link>
                    <span aria-hidden="true">·</span>
                    <Link href="/terms" className="hover:text-zinc-950 dark:hover:text-zinc-100">Terms</Link>
                    <span aria-hidden="true">·</span>
                    <Link href="/" className="hover:text-zinc-950 dark:hover:text-zinc-100">Home</Link>
                </footer>
            </div>
        </main>
    );
}
