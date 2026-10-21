import * as t from "../types";

export const setProfile = (profile) => dispatch => {
    dispatch({
        type: t.SET_PROFILE,
        payload: profile
    });
}

export const setToken = (token) => dispatch => {
    dispatch({
        type: t.SET_TOKEN,
        payload: token
    });
}

export const setDatabases = (databases) => dispatch => {
    dispatch({
        type: t.SET_DATABASES,
        payload: databases
    });
}

export const setDatabase = (database) => dispatch => {
    dispatch({
        type: t.SET_DATABASE,
        payload: database
    });
}

export const setQuery = (query) => dispatch => {
    dispatch({
        type: t.SET_QUERY,
        payload: query
    });
}

export const setTables = (tables) => dispatch => {
    dispatch({
        type: t.SET_TABLES,
        payload: tables
    });
}

export const setQueryTabs = (queryTabs) => dispatch => {
    dispatch({
        type: t.SET_QUERY_TABS,
        payload: queryTabs
    });
}

export const setQueryResults = (queryResults) => dispatch => {
    dispatch({
        type: t.SET_QUERY_RESULTS,
        payload: queryResults
    });
}

export const setNavigationHidden = (navigationHidden) => dispatch => {
    dispatch({
        type: t.SET_NAVIGATION_HIDDEN,
        payload: Boolean(navigationHidden),
    });
}
