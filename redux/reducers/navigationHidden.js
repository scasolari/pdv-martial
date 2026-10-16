import { SET_NAVIGATION_HIDDEN } from "@/redux/types";

const navigationHidden = (state = false, action) => {
    switch (action.type) {
        case SET_NAVIGATION_HIDDEN:
            return Boolean(action.payload);
        default:
            return state;
    }
};

export default navigationHidden;
