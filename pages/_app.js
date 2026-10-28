import "@/styles/globals.css";
import dynamic from "next/dynamic";
import {Provider} from "react-redux";
import {PersistGate} from "redux-persist/integration/react";
import {store, persistor} from "@/redux";
import {ThemeProvider} from "next-themes";
import {NavigationVisibilityProvider, useNavigationVisibility} from "@/components/navigationBar/navigationVisibility";
import {Toaster} from "@/components/ui/base-toast";
import {useEffect} from "react";
import {useTheme} from "next-themes";
import GlobalCommandSearch from "@/components/globalCommandSearch";

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

export default function App({Component, pageProps}) {
    return <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
            <ThemeProvider attribute="class" disableTransitionOnChange>
                <NativeThemeSync />
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
