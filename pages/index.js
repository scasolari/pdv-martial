import Image from "next/image";
import { FaApple } from "react-icons/fa6";

export default function Home() {
    return (
        <main className="flex min-h-screen items-center justify-center bg-white">
            <div className="flex flex-col items-center gap-8">
                <span className="flex size-16 items-center justify-center rounded-2xl bg-zinc-950 p-1">
                    <Image src="/placedv-query-desktop-icon.png" alt="" width={64} height={64} priority />
                </span>
                <a
                    href="https://github.com/scasolari/pdv-martial/releases"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 text-xs font-semibold text-white transition-colors hover:bg-zinc-700"
                >
                    <FaApple aria-hidden="true" size={14} />
                    Download for Mac
                </a>
            </div>
        </main>
    );
}
