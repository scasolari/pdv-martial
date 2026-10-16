const initialState = {};

const database = (state = initialState, action) => {
    switch (action.type) {
        case 'SET_DATABASE':
            if (state.db_id && action.payload?.db_id && state.db_id !== action.payload.db_id) {
                const databaseWithoutPreviousPreferences = { ...state };
                delete databaseWithoutPreviousPreferences.preferences;
                return {
                    ...databaseWithoutPreviousPreferences,
                    ...action.payload,
                };
            }
            return {
                ...state,
                ...action.payload
            };
        case 'DATABASE_LOGOUT':
            return initialState;
        case 'DATABASE_CLEAR':
            return initialState;
        default:
            return state;
    }
}

export default database;
