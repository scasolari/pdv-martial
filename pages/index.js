import Image from "next/image";
import { useTheme } from "next-themes";
import { FaApple } from "react-icons/fa6";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardPreview from "@/components/landingPage/DashboardPreview";

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
            <div className="mx-auto flex w-full max-w-[1440px] flex-col items-center gap-12 px-4 pb-12 pt-24 sm:px-6 lg:px-8">
                <div className="flex flex-col items-center gap-8">
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
                </div>
                <section aria-label="Product preview" className="w-full">
                    <DashboardPreview />
                </section>
            </div>
        </main>
    );
}
