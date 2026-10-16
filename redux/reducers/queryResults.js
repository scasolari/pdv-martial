const initialState = [];

const queryResults = (state = initialState, action) => {
    switch (action.type) {
        case 'SET_QUERY_RESULTS':
            return action.payload;
        // other cases
        case 'TABLES_LOGOUT':
            return initialState;
        case 'TABLES_CLEAR':
            return initialState;
        default:
            return state;
    }
}

export default queryResults;
