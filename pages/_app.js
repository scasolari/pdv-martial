import "@/styles/globals.css";
import dynamic from "next/dynamic";
import {Provider} from "react-redux";
import {PersistGate} from "redux-persist/integration/react";
import {store, persistor} from "@/redux";
import {ThemeProvider} from "next-themes";
import {NavigationVisibilityProvider, useNavigationVisibility} from "@/components/navigationBar/navigationVisibility";
import {Toaster} from "@/components/ui/base-toast";
import {useEffect, useRef} from "react";
import {useDispatch, useSelector} from "react-redux";
import {useRouter} from "next/router";
import {useTheme} from "next-themes";
import GlobalCommandSearch from "@/components/globalCommandSearch";
import TwoFactorGate from "@/components/twoFactorGate";
import {captureAnalyticsEvent, isAnalyticsEnabled} from "@/lib/analytics";
import {migrateLegacySettings} from "@/redux/actions/main";
import DesktopSqliteOpener from "@/components/desktopSqliteOpener";

const AppSettingsDialog = dynamic(() => import("@/components/appSettingsDialog"));

function GlobalSettingsDialog() {
    const {appSettingsOpen, setAppSettingsOpen} = useNavigationVisibility();
    if (!appSettingsOpen) return null;
    return <AppSettingsDialog open={appSettingsOpen} onOpenChange={setAppSettingsOpen} />;
}

function NativeThemeSync() {
    const {setTheme} = useTheme();
    const dispatch = useDispatch();
    const theme = useSelector((state) => state.settings.theme);
    const colorTheme = useSelector((state) => state.settings.colorTheme);
    const legacySettingsMigrated = useSelector((state) => state.settings.legacySettingsMigrated);

    useEffect(() => {
        if (typeof window === "undefined") return;
        let nextTheme = theme;
        if (!legacySettingsMigrated) {
            const legacyTheme = window.localStorage.getItem("theme");
            const legacyWidth = Number.parseFloat(window.localStorage.getItem("placedv-query-sidebar-width"));
            const legacyAnalytics = window.localStorage.getItem("placedv-usage-analytics-consent") === "enabled";
            const validLegacyTheme = ["light", "dark", "system"].includes(legacyTheme) ? legacyTheme : null;
            dispatch(migrateLegacySettings({
                theme: validLegacyTheme,
                analyticsEnabled: legacyAnalytics,
                sidebarWidth: Number.isFinite(legacyWidth) ? legacyWidth : null,
            }));
            if (validLegacyTheme) nextTheme = validLegacyTheme;
            window.localStorage.removeItem("placedv-query-sidebar-width");
            window.localStorage.removeItem("placedv-usage-analytics-consent");
        }
        if (nextTheme) {
            setTheme(nextTheme);
            window.desktopTheme?.setTheme(nextTheme);
        }
    }, [dispatch, legacySettingsMigrated, setTheme, theme]);

    useEffect(() => {
        if (typeof document === "undefined") return;
        const allowedColorThemes = ["zinc", "olive", "neutral", "emerald", "teal", "indigo", "rose", "slate", "gray"];
        document.documentElement.dataset.colorTheme = allowedColorThemes.includes(colorTheme)
            ? colorTheme
            : "olive";
    }, [colorTheme]);

    return null;
}

function AnalyticsStartup() {
    const {pathname} = useRouter();
    const analyticsEnabled = useSelector((state) => state.settings.analyticsEnabled);
    const appOpened = useRef(false);
    const lastScreen = useRef(null);

    useEffect(() => {
        const syncAnalytics = () => {
            if (!analyticsEnabled || !isAnalyticsEnabled()) {
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
    }, [analyticsEnabled, pathname]);

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
                    <TwoFactorGate>
                        <Component {...pageProps} />
                        <GlobalCommandSearch />
                        <GlobalSettingsDialog />
                        <DesktopSqliteOpener />
                    </TwoFactorGate>
                    <Toaster />
                </NavigationVisibilityProvider>
            </ThemeProvider>
        </PersistGate>
    </Provider>;
}
