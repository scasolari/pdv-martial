import { combineReducers } from "redux";
import { persistReducer } from "redux-persist";
import session from "redux-persist/lib/storage/session";
import profile from "@/redux/reducers/profile";
import token from "@/redux/reducers/token";
import databases from "@/redux/reducers/databases";
import database from "@/redux/reducers/database";
import query from "@/redux/reducers/query";
import tables from "@/redux/reducers/tables";
import queryTable from "@/redux/reducers/queryTable";
import queryTabs from "@/redux/reducers/queryTabs";
import queryResults from "@/redux/reducers/queryResults";
import navigationHidden from "@/redux/reducers/navigationHidden";

// WHITELIST
const persistConfig = {
    key: "root",
    // storage: new CookieStorage(Cookies), //session,
    storage: session,
    whitelist: ["profile", "databases", "database", "query", "tables", "queryTable", "queryTabs", "queryResults", "navigationHidden"]
};

const rootReducer = combineReducers({
    profile: profile,
    token: token,
    databases: databases,
    database: database,
    query: query,
    tables: tables,
    queryTable: queryTable,
    queryTabs: queryTabs,
    queryResults: queryResults,
    navigationHidden: navigationHidden
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export default persistedReducer;
