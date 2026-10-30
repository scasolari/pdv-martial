import Link from "next/link";
import { useTheme } from "next-themes";
import { Star } from "lucide-react";
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

export default function SiteTopbar({ stars = 0 }) {
    const starsLabel = stars >= 1000 ? `${Math.floor(stars / 1000)}k+` : stars.toLocaleString("en-US");

    return (
        <nav aria-label="Main navigation" className="fixed right-5 top-5 z-50 flex flex-row items-center gap-3">
            <Link href="/downloads" className="inline-flex h-7 items-center text-xs font-semibold text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100">
                Downloads
            </Link>
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
        </nav>
    );
}
