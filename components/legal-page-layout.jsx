import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import SiteTopbar from "@/components/siteTopbar";

export default function LegalPageLayout({ title, updatedAt, stars = 0, children }) {
    return (
        <main className="min-h-screen bg-white px-5 py-10 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-100 sm:py-16">
            <SiteTopbar stars={stars} />
            <Head>
                <title>{title} · Placedv Query</title>
                <meta name="description" content={`${title} for Placedv Query, the open-source desktop database client.`} />
            </Head>
            <article className="mx-auto max-w-3xl">
                <header className="mb-10 h-8">
                    <Link href="/" aria-label="Placedv Query home" className="fixed left-5 top-5 z-50">
                        <span className="flex size-8 items-center justify-center rounded-lg bg-zinc-950 p-0.5 dark:ring-1 dark:ring-zinc-700">
                            <Image src="/placedv-query-desktop-icon.png" alt="" width={28} height={28} priority />
                        </span>
                    </Link>
                </header>
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
                <p className="mt-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">Last updated: {updatedAt}</p>
                <div className="mt-8 space-y-8 text-sm leading-7 text-zinc-700 dark:text-zinc-300 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-zinc-950 dark:[&_h2]:text-zinc-100 [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-zinc-950 dark:[&_a:hover]:text-white [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
                    {children}
                </div>
            </article>
        </main>
    );
}
