import {InputOTP, InputOTPGroup, InputOTPSlot} from "@/components/ui/input-otp";
import {useRef, useState} from "react";
import axios from "axios";
import {useRouter} from "next/router";
import {Button} from "@/components/ui/button";
import {toast} from "@/components/ui/base-toast";

export default function TwoFALogin() {
    const [value, setValue] = useState("")
    const [verifying, setVerifying] = useState(false)
    const verificationInFlight = useRef(false)
    const router = useRouter()

    const check2FA = (token = value) => {
        if (verificationInFlight.current || token.length !== 6) return
        verificationInFlight.current = true
        setVerifying(true)
        axios.post(`/api/2fa/check`, {
            token,
        })
            .then(() => {
                router.push("/app/playground/play")
            }).catch((err) => {
            const message = err.response?.data?.message || "Unable to verify the code. Please try again with a new code."
            toast.add({title: "Code verification failed", description: message, type: "error"})
            verificationInFlight.current = false
            setVerifying(false)
        })
    }

    return <>
        <div className="w-[400px] p-6 py-8 m-auto mt-7 flex flex-col gap-4">
            <div className="mb-4">
                <h3 className="font-semibold text-center mb-2 text-lg">Verify your identity</h3>
                <p className="text-sm text-center text-neutral-500">Enter the six-digit code from your two-factor authenticator app to continue.</p>
            </div>
            <div className="flex flex-col gap-3 items-center">
                <InputOTP maxLength={6} value={value} onChange={(nextValue) => {
                    setValue(nextValue)
                    if (nextValue.length === 6) check2FA(nextValue)
                }}>
                    <InputOTPGroup className="gap-1">
                        <InputOTPSlot index={0} className="rounded-md border shadow-none" />
                        <InputOTPSlot index={1} className="rounded-md border shadow-none" />
                        <InputOTPSlot index={2} className="rounded-md border shadow-none" />
                        <InputOTPSlot index={3} className="rounded-md border shadow-none" />
                        <InputOTPSlot index={4} className="rounded-md border shadow-none" />
                        <InputOTPSlot index={5} className="rounded-md border shadow-none" />
                    </InputOTPGroup>
                </InputOTP>
                <Button onClick={() => check2FA()} disabled={verifying || value.length !== 6} className="h-6 border-0 bg-blue-600 p-1 px-2 text-white shadow-none ring-1 ring-blue-500 hover:bg-blue-700 dark:text-zinc-100 !text-xs !font-semibold">{verifying ? "Loading..." : "Continue Login"}</Button>
            </div>
        </div>
    </>
}
