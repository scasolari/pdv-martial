import { useDispatch } from "react-redux";
import { signOut } from "next-auth/react";
import {useRouter} from "next/router";

export default function useLogout() {
    const dispatch = useDispatch();
    const router = useRouter();

    return async () => {
        try {

            await router.replace("/logout")

            // Chiama la tua API per eliminare il cookie server-side
            await fetch('/api/auth/custom-signout', { method: 'POST' });

            // Dispatch Redux
            dispatch({ type: 'PROFILE_LOGOUT' });
            dispatch({ type: 'DATABASE_LOGOUT' });
            dispatch({ type: 'DATABASES_LOGOUT' });
            dispatch({ type: 'QUERY_LOGOUT' });
            dispatch({ type: 'TABLES_LOGOUT' });
            dispatch({ type: 'TOKEN_LOGOUT' });
            dispatch({ type: 'SET_QUERY_TABS_LOGOUT' });

            // SignOut
            await signOut({ callbackUrl: "/" });

        } catch (error) {
            console.error('Error during logout:', error);
        }
    };
}
