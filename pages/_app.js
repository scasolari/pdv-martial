import "@/styles/globals.css";
import {SessionProvider, useSession} from "next-auth/react";
import dynamic from "next/dynamic";
import {useRouter} from "next/router";
import {Provider} from "react-redux";
import {PersistGate} from "redux-persist/integration/react";
import {store, persistor} from "@/redux";
import {ThemeProvider} from "next-themes";
import {NavigationVisibilityProvider, useNavigationVisibility} from "@/components/navigationBar/navigationVisibility";
import {Toaster} from "@/components/ui/base-toast";

const AppSettingsDialog = dynamic(() => import("@/components/appSettingsDialog"));

function GlobalSettingsDialog() {
    const {appSettingsOpen, setAppSettingsOpen} = useNavigationVisibility();
    if (!appSettingsOpen) return null;
    return <AppSettingsDialog open={appSettingsOpen} onOpenChange={setAppSettingsOpen} />;
}

function AuthenticatedPage({Component, pageProps}) {
    const router = useRouter();
    const {status} = useSession();
    const isAppRoute = router.pathname === "/app" || router.pathname.startsWith("/app/");

    if (isAppRoute && status === "loading") {
        return <div className="flex min-h-screen items-center justify-center bg-background text-xs font-semibold text-muted-foreground">Loading…</div>;
    }

    return <Component {...pageProps} />;
}

export default function App({Component, pageProps}) {
    return <Provider store={store}>
        <SessionProvider>
            <PersistGate loading={null} persistor={persistor}>
                <ThemeProvider attribute="class" disableTransitionOnChange>
                    <NavigationVisibilityProvider>
                        <AuthenticatedPage Component={Component} pageProps={pageProps} />
                        <GlobalSettingsDialog />
                        <Toaster />
                    </NavigationVisibilityProvider>
                </ThemeProvider>
            </PersistGate>
        </SessionProvider>
    </Provider>;
}
