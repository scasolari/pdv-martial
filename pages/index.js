import {Button} from "@/components/ui/button";
import {signIn} from "next-auth/react";
import {PiGithubLogoBold} from "react-icons/pi";

export default function Home() {
    return <>
        <div className="w-[900px] h-[100vh] flex items-center justify-center m-auto border-r border-l">
            <div className="py-12 text-center flex flex-col gap-4 items-center border-b border-t w-full">
                <h1 className="text-5xl font-serif">Placedv Query</h1>
                <h3 className="text-lg">
                    Just another database query tool (but better)
                </h3>
                <Button className="w-fit !font-semibold !text-sm" onClick={() => signIn("github", {callbackUrl: "/app/playground/play"})}>
                    Try now for free
                </Button>
            </div>
        </div>
    </>
}
