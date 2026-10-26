import { signIn } from "next-auth/react";
import { PiGithubLogoBold } from "react-icons/pi";

export default function Home() {
    return (
        <main className="flex min-h-screen items-center justify-center bg-white">
            <button
                type="button"
                onClick={() => signIn("github", { callbackUrl: "/app/playground/play" })}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 text-xs font-semibold text-white transition-colors hover:bg-zinc-700"
            >
                <PiGithubLogoBold aria-hidden="true" size={14} />
                Login with GitHub
            </button>
        </main>
    );
}
