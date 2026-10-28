import Link from "next/link";
import {BiCode, BiPlus} from "react-icons/bi";
import { useRouter } from "next/router";
import { connect } from "react-redux";
import {useEffect} from "react";
import Image from "next/image";
import {setProfile} from "@/redux/actions/main";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {useTheme} from "next-themes";
import {
    Tooltip,
    TooltipContent, TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import {LuCircleUserRound} from "react-icons/lu";
import { useNavigationVisibility } from "@/components/navigationBar/navigationVisibility";
import LocalAvatar from "@/components/localAvatar";



function NavigationBar(props) {
    const { profile, setProfile } = props;
    const router = useRouter();
    const {theme, setTheme} = useTheme()
    const {setAppSettingsOpen} = useNavigationVisibility();

    const linkActive = (path) => {
        return router.pathname === path || router.pathname.startsWith(`${path}/`);
    };

    useEffect(() => {
        setProfile({ user: { id: "placedv-local-user", name: "Local user", email: "Local desktop" } });
    }, [setProfile]);

    return <div className="h-[100vh] fixed top-0 px-3 py-4 border-r">
        <div className="flex flex-col items-center gap-3">
            <Popover>
                <PopoverTrigger asChild>
                    <button type="button" aria-label="Open local profile menu" className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                        {profile?.user?.image ? <Image className="h-6 w-6 rounded-full border object-cover" src={profile.user.image} height={24} width={24} alt={profile?.user?.name || "Account"} unoptimized /> : <LocalAvatar size={24} />}
                    </button>
                </PopoverTrigger>
                <PopoverContent align="start" side="right" className="w-[276px] p-0 rounded-lg">
                    <div className="p-3 pb-0 pt-2">
                        <p className="text-sm text-zinc-500 !font-semibold">{profile?.user?.email}</p>
                    </div>
                    <ul className="p-1">
                        <li className="font-semibold">
                            <button type="button" onClick={() => setAppSettingsOpen(true)} className="!text-sm flex w-full text-left hover:cursor-pointer dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 px-2 py-1 rounded-lg">
                                Settings
                            </button>
                        </li>
                        <li className="!text-sm w-full font-semibold dark:text-neutral-100">
                            <button type="button" className="w-full text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 px-2 py-1 rounded-lg" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
                                {theme === "light" ? "Dark theme" : "Light theme"}
                            </button>
                        </li>
                    </ul>
                </PopoverContent>
            </Popover>
            <TooltipProvider>
                <ul className="flex flex-col items-center gap-1">
                    <li className="mb-3">
                        <Tooltip>
                            <TooltipTrigger>
                                <Link href="/app/add/dataset" className="flex text-center justify-center items-center p-0 h-[32px] w-[32px] bg-blue-600 text-white shadow-none hover:bg-blue-700 rounded-lg">
                                    <BiPlus size={24}/>
                                </Link>
                            </TooltipTrigger>
                            <TooltipContent side="right">
                                <p>Add Dataset</p>
                            </TooltipContent>
                        </Tooltip>
                    </li>
                    <li className="flex items-center">
                        <Tooltip>
                            <TooltipTrigger>
                                <Link
                                    href="/app/dashboard"
                                    className={`flex items-center rounded-md p-1 h-[32px] w-[32px] hover:bg-neutral-100 hover:dark:bg-neutral-900 ${linkActive(`/app/dashboard`) ? `!bg-blue-100 dark:!bg-neutral-800` : null}`}
                                >
                                    <LuCircleUserRound size={30} />
                                </Link>
                            </TooltipTrigger>
                            <TooltipContent side="right">
                                <p>For you</p>
                            </TooltipContent>
                        </Tooltip>
                    </li>
                    <li className="flex items-center">
                        <Tooltip>
                            <TooltipTrigger>
                                <Link
                                    href="/app/playground/play"
                                    className={`flex items-center rounded-md p-1 h-[32px] w-[32px] hover:bg-neutral-100 hover:dark:bg-neutral-900 ${linkActive(`/app/playground/play`) ? `!bg-blue-100 dark:!bg-neutral-800` : null}`}
                                >
                                    <BiCode size={30}/>
                                </Link>
                            </TooltipTrigger>
                            <TooltipContent side="right">
                                <p>Playground</p>
                            </TooltipContent>
                        </Tooltip>
                    </li>
                </ul>
            </TooltipProvider>
        </div>
    </div>
}

const mapStateToProps = (state) => {
    return {
        profile: state.profile,
    };
};

const mapDispatchToProps = {
    setProfile,
};

export default connect(mapStateToProps, mapDispatchToProps)(NavigationBar);
