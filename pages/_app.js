import "@/styles/globals.css";
import {SessionProvider} from "next-auth/react";
import {Provider} from "react-redux";
import {PersistGate} from "redux-persist/integration/react";
import {store, persistor} from "@/redux";
import {ThemeProvider} from "next-themes";
import {NavigationVisibilityProvider, useNavigationVisibility} from "@/components/navigationBar/navigationVisibility";
import AppSettingsDialog from "@/components/appSettingsDialog";

function GlobalSettingsDialog() {
    const {appSettingsOpen, setAppSettingsOpen} = useNavigationVisibility();
    return <AppSettingsDialog open={appSettingsOpen} onOpenChange={setAppSettingsOpen} />;
}

export default function App({Component, pageProps}) {
    return <Provider store={store}>
        <SessionProvider>
            <PersistGate loading={null} persistor={persistor}>
                <ThemeProvider attribute="class" disableTransitionOnChange>
                    <NavigationVisibilityProvider>
                        <Component {...pageProps} />
                        <GlobalSettingsDialog />
                    </NavigationVisibilityProvider>
                </ThemeProvider>
            </PersistGate>
        </SessionProvider>
    </Provider>;
}
