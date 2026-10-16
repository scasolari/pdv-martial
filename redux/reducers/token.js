const initialState = {};

const token = (state = initialState, action) => {
    switch (action.type) {
        case 'SET_TOKEN':
            return {
                ...state,
                ...action.payload
            };
        // other cases
        case 'TOKEN_LOGOUT':
            return initialState;
        default:
            return state;
    }
}

export default token;
