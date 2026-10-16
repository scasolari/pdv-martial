import axios from "axios";
import { setTables } from "./main";

export const fetchTablesForDb = (db_id) => async (dispatch) => {
    if (!db_id) return;

    try {
        const res = await axios.get(
            `/api/playground/db/table?db_id=${db_id}`
        );

        dispatch(setTables(res.data));
    } catch (err) {
        console.error("Errore fetch tabelle:", err);
        dispatch(setTables(null));
    }
};
