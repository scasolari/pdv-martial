const initialState = [];

const databases = (state = initialState, action) => {
    switch (action.type) {
        case 'SET_DATABASES':
            return action.payload;
        // other cases
        case 'DATABASES_LOGOUT':
            return initialState;
        default:
            return state;
    }
}

export default databases;
