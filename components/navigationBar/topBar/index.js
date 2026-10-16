import Link from "next/link";
import {useRouter} from "next/router";
import {IoPlanetSharp} from "react-icons/io5";
import { Button } from "@/components/ui/button";
import { useNavigationVisibility } from "@/components/navigationBar/navigationVisibility";

export default function TopBarNavigation() {
    const router = useRouter();
    const {setAppSettingsOpen} = useNavigationVisibility();
    const linkActive = (path) => {
        return router.pathname === path;
    };
    return <>
        <div className="p-4 flex items-center gap-3">
            <div className="font-semibold">
                <IoPlanetSharp size={24}/>
            </div>
            <ul className="flex flex-row gap-1">
                <li>
                    <Link
                        href="/app/dashboard"
                        className={`flex w-full p-3 py-1.5 rounded-md font-semibold hover:bg-neutral-100 hover:dark:bg-neutral-900 ${linkActive(`/app/dashboard`) ? `!bg-blue-100 dark:!bg-neutral-800` : null}`}
                    >
                        Dashboard
                    </Link>
                </li>
                <li>
                    <Link
                        href="/app/playground"
                        className={`flex items-center gap-2 w-full p-3 py-1.5 rounded-md font-semibold hover:bg-neutral-100 hover:dark:bg-neutral-900 ${linkActive(`/app/playground`) ? `!bg-blue-100 dark:!bg-neutral-800` : null}`}
                    >
                        Playground
                    </Link>
                </li>
                <li>
                    <Button type="button" onClick={() => setAppSettingsOpen(true)} className="flex h-auto items-center gap-2 w-full p-3 py-1.5 rounded-md bg-transparent text-left font-semibold shadow-none hover:bg-neutral-100 hover:dark:bg-neutral-900 dark:bg-transparent dark:text-neutral-100">
                        Settings
                    </Button>
                </li>
            </ul>
        </div>
    </>
}
