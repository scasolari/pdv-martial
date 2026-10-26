import { signIn } from "next-auth/react";
import { PiGithubLogoBold } from "react-icons/pi";
import DashboardPreview from "@/components/landingPage/DashboardPreview";
import ProductOverview from "@/components/landingPage/ProductOverview";

export default function Home() {
    const login = () => signIn("github", { callbackUrl: "/app/playground/play" });

    return (
        <main className="min-h-screen bg-white text-zinc-950">
            <header className="mx-auto flex h-[72px] w-full max-w-[1280px] items-center justify-between px-4 sm:px-6 lg:px-8">
                <a href="#top" className="flex items-center text-sm font-semibold tracking-tight" aria-label="Placedv Query home">
                    <span>Placedv Query</span>
                </a>
                <button onClick={login} className="inline-flex h-8 items-center justify-center rounded-md bg-zinc-950 px-3 !text-xs !font-semibold text-white transition-colors hover:bg-zinc-700">
                    Get started
                </button>
            </header>

            <section id="top" className="mx-auto grid w-full max-w-[1280px] grid-cols-1 items-start gap-8 px-4 pb-10 pt-12 sm:px-6 md:grid-cols-2 md:gap-12 md:pt-16 lg:px-8">
                <div>
                    <h1 className="max-w-2xl text-4xl font-medium leading-[1.08] tracking-tight sm:text-5xl">
                        Your databases, in one focused workspace
                    </h1>
                    <div className="mt-6 flex flex-wrap items-center gap-3">
                        <button onClick={login} className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 !text-xs !font-semibold text-white transition-colors hover:bg-zinc-700">
                            <PiGithubLogoBold aria-hidden="true" size={14} />
                            Get started
                        </button>
                        <a href="#product" className="inline-flex h-9 items-center justify-center rounded-md border border-zinc-300 px-4 text-xs font-semibold text-zinc-900 transition-colors hover:bg-zinc-50">
                            Explore the product
                        </a>
                    </div>
                </div>
                <p className="max-w-xl pt-1 text-base leading-7 text-zinc-600 md:pt-2">
                    Placedv Query brings database connections, table browsing, SQL queries, and record management into
                    one clear interface, so your data work stays organized in one place.
                </p>
            </section>

            <section id="product" aria-label="Product preview" className="mx-auto w-full max-w-[1320px] px-4 sm:px-6 lg:px-8">
                <div className="overflow-hidden rounded-xl">
                    <DashboardPreview />
                </div>
            </section>

            <ProductOverview />
        </main>
    );
}
