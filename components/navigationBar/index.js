import Link from "next/link";
import {BiCode, BiCollection, BiPlus} from "react-icons/bi";
import { useRouter } from "next/router";
import { connect } from "react-redux";
import {useEffect, useState} from "react";
import {setDatabase, setDatabases, setProfile, setQuery, setTables} from "@/redux/actions/main";
import {useSession} from "next-auth/react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import axios from "axios";
import {useTheme} from "next-themes";
import {
    Tooltip,
    TooltipContent, TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import useLogout from "@/lib/logout";
import {LuCircleUserRound} from "react-icons/lu";
import { useNavigationVisibility } from "@/components/navigationBar/navigationVisibility";



function NavigationBar(props) {
    const logout = useLogout()
    const { profile, setProfile, setDatabases, setQuery, setTables, setDatabase } = props;
    const [open, setOpen] = useState(false);
    const { data: session } = useSession();
    const router = useRouter();
    const {theme, setTheme} = useTheme()
    const {setAppSettingsOpen} = useNavigationVisibility();

    const linkActive = (path) => {
        return router.pathname === path;
    };

    const fetchDatabases = () => {
        axios.get("/api/database")
            .then((response) => {
                setDatabases(response.data);
            })
    }

    useEffect(() => {
        fetchDatabases()
        setProfile(session);
    }, [session]);

    if(!session) return null;

    return <div className="h-[100vh] fixed top-0 px-3 py-4 border-r">
        <div className="flex flex-col items-center gap-3">
            <Popover>
                <PopoverTrigger>
                    <img className="bg-neutral-100 dark:bg-neutral-800 rounded-full border" src={profile?.user?.image} height={36} width={36} alt={profile?.user?.name} onClick={() => setOpen(true)}/>
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
                        <li className="!text-sm w-full font-semibold flex hover:cursor-pointer dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 px-2 py-1 rounded-lg">
                            {theme === "light"
                                ? <p className="w-full" onClick={() => setTheme('dark')}>Dark theme</p>
                                : <p className="w-full" onClick={() => setTheme('light')}>Light theme</p>
                            }
                        </li>
                        <li
                            className="!text-sm hover:cursor-pointer  dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 px-2 py-1 rounded-lg font-semibold"
                            onClick={logout}
                        >Logout</li>
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
                                    href="/app/playground"
                                    className={`flex items-center rounded-md p-1 h-[32px] w-[32px] hover:bg-neutral-100 hover:dark:bg-neutral-900 ${linkActive(`/app/playground`) ? `!bg-blue-100 dark:!bg-neutral-800` : null}`}
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
    setDatabases,
    setDatabase,
    setQuery,
    setTables
};

export default connect(mapStateToProps, mapDispatchToProps)(NavigationBar);
