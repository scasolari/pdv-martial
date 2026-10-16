const initialState = [];

const queryTabs = (state = initialState, action) => {
    switch (action.type) {
        case 'SET_QUERY_TABS':
            return action.payload;
        // other cases
        case 'SET_QUERY_TABS_LOGOUT':
            return initialState;
        default:
            return state;
    }
}

export default queryTabs;
