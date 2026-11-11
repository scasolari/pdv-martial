import {
    MIGRATE_LEGACY_SETTINGS,
    SET_ANALYTICS_PREFERENCE,
    SET_COLOR_THEME_PREFERENCE,
    SET_NAVIGATION_HIDDEN,
    SET_SIDEBAR_WIDTH,
    SET_THEME_PREFERENCE,
} from "@/redux/types";

const initialState = {
    theme: "system",
    colorTheme: "olive",
    analyticsEnabled: false,
    navigationHidden: false,
    sidebarWidth: null,
    legacySettingsMigrated: false,
};

export default function settings(state = initialState, action) {
    switch (action.type) {
        case SET_THEME_PREFERENCE:
            return { ...state, theme: action.payload };
        case SET_COLOR_THEME_PREFERENCE:
            return { ...state, colorTheme: action.payload };
        case SET_ANALYTICS_PREFERENCE:
            return { ...state, analyticsEnabled: Boolean(action.payload) };
        case SET_NAVIGATION_HIDDEN:
            return { ...state, navigationHidden: Boolean(action.payload) };
        case SET_SIDEBAR_WIDTH:
            return { ...state, sidebarWidth: Number.isFinite(action.payload) ? action.payload : null };
        case MIGRATE_LEGACY_SETTINGS:
            if (state.legacySettingsMigrated) return state;
            return {
                ...state,
                ...(state.theme === "system" && action.payload?.theme ? { theme: action.payload.theme } : {}),
                ...(action.payload?.analyticsEnabled ? { analyticsEnabled: true } : {}),
                ...(state.sidebarWidth === null && Number.isFinite(action.payload?.sidebarWidth)
                    ? { sidebarWidth: action.payload.sidebarWidth }
                    : {}),
                legacySettingsMigrated: true,
            };
        default:
            return state;
    }
}
