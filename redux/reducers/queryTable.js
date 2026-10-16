const initialState = [];

const queryTable = (state = initialState, action) => {
    switch (action.type) {
        case 'SET_QUERY_TABLE':
            return action.payload;
        // other cases
        case 'SET_QUERY_TABLE_LOGOUT':
            return initialState;
        case 'SET_QUERY_TABLE_CLEAR':
            return initialState;
        default:
            return state;
    }
}

export default queryTable;
