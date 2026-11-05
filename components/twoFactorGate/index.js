import { useEffect, useState } from "react";
import axios from "axios";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/base-toast";

function TwoFactorGate({ children }) {
    const [state, setState] = useState("checking");
    const [code, setCode] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const checkStatus = async () => {
            if (!window.desktopUpdates) {
                if (!cancelled) setState("unlocked");
                return;
            }
            try {
                const { data } = await axios.get("/api/2fa/status");
                if (!cancelled) setState(data.enabled && !data.unlocked ? "locked" : "unlocked");
            } catch (requestError) {
                if (!cancelled) {
                    toast.add({ title: "Unable to check app security", description: requestError.response?.data?.error || "Unable to check the app lock.", type: "error" });
                    setState("error");
                }
            }
        };

        checkStatus();
        const onFocus = () => checkStatus();
        window.addEventListener("focus", onFocus);
        const interval = window.setInterval(onFocus, 60_000);
        return () => {
            cancelled = true;
            window.removeEventListener("focus", onFocus);
            window.clearInterval(interval);
        };
    }, []);

    const submitCode = async (event) => {
        event.preventDefault();
        if (code.length !== 6 || submitting) return;
        setSubmitting(true);
        try {
            await axios.post("/api/2fa/verify", { token: code });
            setState("unlocked");
        } catch (requestError) {
            toast.add({ title: "Unable to unlock app", description: requestError.response?.data?.error || "The authenticator code could not be verified.", type: "error" });
            setCode("");
        } finally {
            setSubmitting(false);
        }
    };

    if (state === "unlocked") return children;

    return (
        <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-zinc-50 p-4 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-100">
            <form onSubmit={submitCode} className="w-full max-w-xs space-y-5 text-center">
                <div className="space-y-1">
                    <h1 className="text-sm font-semibold">{state === "checking" ? "Checking app security…" : state === "error" ? "App is locked" : "Unlock Placedv Query"}</h1>
                    <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                        {state === "checking" ? "Checking the local security status." : state === "error" ? "The security status could not be checked. Retry to continue." : "Enter the six-digit code from your authenticator app."}
                    </p>
                </div>
                {state === "locked" && (
                    <div className="flex justify-center">
                        <InputOTP maxLength={6} value={code} onChange={setCode} aria-label="Authenticator code">
                            <InputOTPGroup>{[0, 1, 2].map((index) => <InputOTPSlot key={index} index={index} className="shadow-none ring-blue-500" />)}</InputOTPGroup>
                            <span aria-hidden="true" className="px-1 text-xs font-semibold text-zinc-500">-</span>
                            <InputOTPGroup>{[3, 4, 5].map((index) => <InputOTPSlot key={index} index={index} className="shadow-none ring-blue-500" />)}</InputOTPGroup>
                        </InputOTP>
                    </div>
                )}
                {state === "locked" ? (
                    <Button type="submit" disabled={code.length !== 6 || submitting} className="flex h-6 w-full items-center justify-center gap-1 border-0 bg-blue-600 p-1 px-2 text-white shadow-none ring-1 ring-blue-500 hover:bg-blue-700 disabled:opacity-50 dark:text-zinc-100 !text-xs !font-semibold">
                        {submitting ? "Checking code…" : "Unlock"}
                    </Button>
                ) : state === "error" ? (
                    <Button type="button" onClick={() => window.location.reload()} className="flex h-6 w-full items-center justify-center gap-1 border-0 bg-blue-600 p-1 px-2 text-white shadow-none ring-1 ring-blue-500 hover:bg-blue-700 dark:text-zinc-100 !text-xs !font-semibold">Retry</Button>
                ) : null}
            </form>
        </div>
    );
}

export default TwoFactorGate;
