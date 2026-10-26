import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import LocalAvatar from "@/components/localAvatar";
import { setNavigationHidden as setNavigationHiddenAction } from "@/redux/actions/main";

const NavigationVisibilityContext = createContext(null);

export function NavigationVisibilityProvider({ children }) {
    const dispatch = useDispatch();
    const navigationHidden = useSelector((state) => state.navigationHidden);
    const setNavigationHidden = useCallback((hidden) => dispatch(setNavigationHiddenAction(hidden)), [dispatch]);
    const [appSettingsOpen, setAppSettingsOpen] = useState(false);
    const value = useMemo(() => ({ navigationHidden, setNavigationHidden, appSettingsOpen, setAppSettingsOpen }), [navigationHidden, setNavigationHidden, appSettingsOpen]);

    return (
        <NavigationVisibilityContext.Provider value={value}>
            {children}
        </NavigationVisibilityContext.Provider>
    );
}

export function useNavigationVisibility() {
    const context = useContext(NavigationVisibilityContext);
    if (!context) throw new Error("useNavigationVisibility must be used within NavigationVisibilityProvider");
    return context;
}

export function ShowNavigationButton() {
    const { navigationHidden, setNavigationHidden, setAppSettingsOpen } = useNavigationVisibility();
    if (!navigationHidden) return null;

    return (
        <div className="flex items-center gap-2">
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            onClick={() => setNavigationHidden(false)}
                            aria-label="Show navigation"
                            className="h-6 w-6 border-0 bg-transparent p-1 text-zinc-700 shadow-none hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                            <PanelLeftOpen size={14} />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent className="mt-2 font-semibold border bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-100">
                        <p>Show navigator</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <Popover>
                <PopoverTrigger asChild>
                    <Button aria-label="Open account menu" className="h-6 w-6 rounded-full border-0 bg-transparent p-0 shadow-none hover:bg-zinc-100 dark:hover:bg-zinc-800">
                        <LocalAvatar size={24} />
                    </Button>
                </PopoverTrigger>
                <PopoverContent align="start" side="bottom" className="z-[99999999] w-[276px] rounded-lg border-zinc-200 p-0 dark:border-zinc-700">
                    <div className="p-3 pb-0 pt-2">
                        <p className="text-xs font-semibold text-zinc-500">Local desktop</p>
                    </div>
                    <ul className="p-1">
                        <li>
                            <button type="button" onClick={() => setAppSettingsOpen(true)} className="flex w-full rounded-md px-2 py-1 text-left !text-xs !font-semibold hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-900">
                                Settings
                            </button>
                        </li>
                        <li>
                        </li>
                    </ul>
                </PopoverContent>
            </Popover>
        </div>
    );
}
