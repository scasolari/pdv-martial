import "@/styles/globals.css";
import dynamic from "next/dynamic";
import {Provider} from "react-redux";
import {PersistGate} from "redux-persist/integration/react";
import {store, persistor} from "@/redux";
import {ThemeProvider} from "next-themes";
import {NavigationVisibilityProvider, useNavigationVisibility} from "@/components/navigationBar/navigationVisibility";
import {Toaster} from "@/components/ui/base-toast";
import {useEffect, useRef} from "react";
import {useRouter} from "next/router";
import {useTheme} from "next-themes";
import GlobalCommandSearch from "@/components/globalCommandSearch";
import {captureAnalyticsEvent, isAnalyticsEnabled} from "@/lib/analytics";

const AppSettingsDialog = dynamic(() => import("@/components/appSettingsDialog"));

function GlobalSettingsDialog() {
    const {appSettingsOpen, setAppSettingsOpen} = useNavigationVisibility();
    if (!appSettingsOpen) return null;
    return <AppSettingsDialog open={appSettingsOpen} onOpenChange={setAppSettingsOpen} />;
}

function NativeThemeSync() {
    const {theme} = useTheme();

    useEffect(() => {
        if (theme && typeof window !== "undefined") {
            window.desktopTheme?.setTheme(theme);
        }
    }, [theme]);

    return null;
}

function AnalyticsStartup() {
    const {pathname} = useRouter();
    const appOpened = useRef(false);
    const lastScreen = useRef(null);

    useEffect(() => {
        const syncAnalytics = () => {
            if (!isAnalyticsEnabled()) {
                appOpened.current = false;
                lastScreen.current = null;
                return;
            }

            const screen = getAnalyticsScreen(pathname);
            if (!appOpened.current) {
                appOpened.current = true;
                window.desktopUpdates?.getInfo()
                    .then((info) => captureAnalyticsEvent("app_opened", {
                        app_version: info.version,
                        platform: info.platform,
                    }))
                    .catch(() => captureAnalyticsEvent("app_opened"));
                if (!window.desktopUpdates) captureAnalyticsEvent("app_opened");
            }
            if (screen && lastScreen.current !== screen) {
                lastScreen.current = screen;
                captureAnalyticsEvent("screen_viewed", {screen});
            }
        };

        syncAnalytics();
        window.addEventListener("placedv-analytics-consent-changed", syncAnalytics);
        return () => window.removeEventListener("placedv-analytics-consent-changed", syncAnalytics);
    }, [pathname]);

    return null;
}

function getAnalyticsScreen(pathname) {
    if (pathname === "/app/dashboard") return "dashboard";
    if (pathname === "/app/playground") return "playground";
    if (pathname.startsWith("/app/playground/play/") && pathname.endsWith("/activity")) return "activity_history";
    if (pathname.startsWith("/app/playground/play/") && pathname.endsWith("/settings")) return "database_settings";
    if (pathname.startsWith("/app/playground/play/")) return "table_browser";
    if (pathname === "/app/settings") return "application_settings";
    if (pathname === "/app/add/dataset") return "add_database";
    return null;
}

export default function App({Component, pageProps}) {
    return <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
            <ThemeProvider attribute="class" disableTransitionOnChange>
                <NativeThemeSync />
                <AnalyticsStartup />
                <NavigationVisibilityProvider>
                    <Component {...pageProps} />
                    <GlobalCommandSearch />
                    <GlobalSettingsDialog />
                    <Toaster />
                </NavigationVisibilityProvider>
            </ThemeProvider>
        </PersistGate>
    </Provider>;
}
