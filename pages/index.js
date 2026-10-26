import { signIn } from "next-auth/react";
import { PiGithubLogoBold } from "react-icons/pi";
import { Database } from "lucide-react";

export default function Home() {
    return (
        <main className="flex min-h-screen items-center justify-center bg-white">
            <div className="flex flex-col items-center gap-8">
                <div className="flex items-center gap-3">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-zinc-950 text-white">
                        <Database aria-hidden="true" size={22} strokeWidth={1.8} />
                    </span>
                    <span className="text-xl font-semibold tracking-tight text-zinc-950">Placedv Query</span>
                </div>
                <button
                    type="button"
                    onClick={() => signIn("github", { callbackUrl: "/app/playground/play" })}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 text-xs font-semibold text-white transition-colors hover:bg-zinc-700"
                >
                    <PiGithubLogoBold aria-hidden="true" size={14} />
                    Login with GitHub
                </button>
            </div>
        </main>
    );
}
