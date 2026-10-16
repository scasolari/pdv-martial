import { useDispatch } from "react-redux";

export default function useClear() {
    const dispatch = useDispatch();
    return async () => {
        try {
            dispatch({ type: '' });
            dispatch({ type: 'DATABASE_CLEAR' });
            dispatch({ type: 'QUERY_CLEAR' });
            dispatch({ type: 'TABLES_CLEAR' });
            dispatch({ type: 'SET_QUERY_TABLE_CLEAR' });

        } catch (error) {
            console.error('Error during logout:', error);
        }
    };
}
