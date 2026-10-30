const CONSENT_STORAGE_KEY = "placedv-usage-analytics-consent";
const EVENT_NAMES = new Set(["app_opened", "screen_viewed", "query_executed"]);

let posthogPromise;
let environmentAllowedPromise;

export function isAnalyticsEnabled() {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(CONSENT_STORAGE_KEY) === "enabled";
}

export function isAnalyticsConfigured() {
    return Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);
}

export function isAnalyticsEnvironmentAllowed() {
    if (!environmentAllowedPromise) {
        environmentAllowedPromise = (async () => {
            if (process.env.NODE_ENV !== "production" || typeof window === "undefined") return false;

            if (window.desktopUpdates?.getInfo) {
                try {
                    const info = await window.desktopUpdates.getInfo();
                    return Boolean(info?.supported);
                } catch {
                    return false;
                }
            }

            return !["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
        })();
    }
    return environmentAllowedPromise;
}

async function getPostHog() {
    if (!isAnalyticsConfigured()) return null;
    if (!posthogPromise) {
        posthogPromise = import("posthog-js/dist/module.no-external").then(({ default: posthog }) => {
            posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
                api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
                defaults: "2026-08-30",
                opt_out_capturing_by_default: true,
                opt_out_persistence_by_default: true,
                autocapture: false,
                capture_pageview: false,
                capture_pageleave: false,
                disable_session_recording: true,
                capture_exceptions: false,
                disableDeviceModel: true,
                capture_performance: false,
                disable_surveys: true,
                advanced_disable_feature_flags: true,
                persistence: "localStorage",
                property_denylist: [
                    "$current_url",
                    "$pathname",
                    "$host",
                    "$referrer",
                    "$initial_referrer",
                    "$initial_current_url",
                    "$set",
                    "$set_once",
                ],
            });
            return posthog;
        });
    }
    return posthogPromise;
}

export async function enableAnalytics() {
    if (!isAnalyticsConfigured()) return false;
    if (typeof window === "undefined") return false;
    if (!await isAnalyticsEnvironmentAllowed()) return false;
    window.localStorage.setItem(CONSENT_STORAGE_KEY, "enabled");
    try {
        const posthog = await getPostHog();
        if (!posthog) {
            window.localStorage.removeItem(CONSENT_STORAGE_KEY);
            return false;
        }
        posthog.opt_in_capturing({ captureEventName: false });
        return true;
    } catch (error) {
        window.localStorage.removeItem(CONSENT_STORAGE_KEY);
        throw error;
    }
}

export async function disableAnalytics() {
    if (typeof window !== "undefined") {
        window.localStorage.removeItem(CONSENT_STORAGE_KEY);
    }
    if (posthogPromise) {
        const posthog = await posthogPromise;
        posthog?.opt_out_capturing();
    }
}

export async function captureAnalyticsEvent(eventName, properties = {}) {
    if (!EVENT_NAMES.has(eventName) || !isAnalyticsEnabled() || !await isAnalyticsEnvironmentAllowed()) return;
    const posthog = await getPostHog();
    if (!posthog || !isAnalyticsEnabled() || !await isAnalyticsEnvironmentAllowed()) return;

    // Keep the event payload intentionally small and prevent callers from
    // attaching database names, SQL, connection details, or other user data.
    const safeProperties = {};
    if (typeof properties.screen === "string") {
        safeProperties.screen = properties.screen;
    }
    if (typeof properties.app_version === "string") {
        safeProperties.app_version = properties.app_version;
    }
    if (["darwin", "win32", "linux"].includes(properties.platform)) {
        safeProperties.platform = properties.platform;
    }

    posthog.capture(eventName, safeProperties);
}
