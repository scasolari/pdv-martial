import { toast as sonnerToast } from "sonner";

const toastMethods = {
    success: sonnerToast.success,
    info: sonnerToast.info,
    warning: sonnerToast.warning,
    error: sonnerToast.error,
    loading: sonnerToast.loading,
};

export const toast = {
    add({ title, description, type = "info", ...options }) {
        const showToast = toastMethods[type] || sonnerToast;
        return showToast(title, { description, ...options });
    },
};
