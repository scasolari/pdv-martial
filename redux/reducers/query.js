// redux/reducers/query.js

const initialState = "";  // stato come semplice stringa

const query = (state = initialState, action) => {
    switch (action.type) {
        case 'SET_QUERY':
            return action.payload;  // payload deve essere una stringa
        case 'QUERY_LOGOUT':
            return initialState;
        case 'QUERY_CLEAR':
            return initialState;
        default:
            return state;
    }
};

export default query;
