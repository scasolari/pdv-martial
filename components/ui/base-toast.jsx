import { Toast as ToastPrimitive } from "@base-ui/react/toast";
import { CheckCircle2, Info, LoaderCircle, OctagonX, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const toast = ToastPrimitive.createToastManager();

function ToastIcon({ type }) {
    const icons = {
        success: <CheckCircle2 className="text-green-600" aria-hidden="true" />,
        info: <Info aria-hidden="true" />,
        warning: <TriangleAlert className="text-amber-600" aria-hidden="true" />,
        error: <OctagonX className="text-destructive" aria-hidden="true" />,
        loading: <LoaderCircle className="animate-spin" aria-hidden="true" />,
    };
    return icons[type] ? <span className="shrink-0 [&_svg]:size-3.5">{icons[type]}</span> : null;
}

function ToastItem({ item }) {
    return <ToastPrimitive.Root toast={item} className={cn(
        "electron-toast-no-drag pointer-events-auto relative flex w-full items-start gap-2.5 rounded-xl border bg-background p-3 text-foreground shadow-lg outline-none",
        "data-[starting-style]:translate-y-2 data-[starting-style]:opacity-0 data-[ending-style]:translate-y-2 data-[ending-style]:opacity-0 transition-all"
    )} data-toast-root="">
        <ToastIcon type={item.type} />
        <ToastPrimitive.Content className="min-w-0 flex-1">
            <ToastPrimitive.Title className="text-xs font-semibold" />
            <ToastPrimitive.Description className="mt-0.5 text-xs text-muted-foreground" />
        </ToastPrimitive.Content>
        {item.actionProps && <ToastPrimitive.Action {...item.actionProps} />}
        <ToastPrimitive.Close type="button" className="-mr-2 -mt-2 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" aria-label="Close notification">
            <X className="size-4" aria-hidden="true" />
        </ToastPrimitive.Close>
    </ToastPrimitive.Root>;
}

function ToastList() {
    const { toasts } = ToastPrimitive.useToastManager();
    return <ToastPrimitive.Portal>
        <ToastPrimitive.Viewport className="electron-toast-no-drag pointer-events-none fixed inset-x-4 top-4 z-[100000000] mx-auto flex w-auto max-w-xs flex-col gap-1.5 outline-none">
            {toasts.map((item) => <ToastItem key={item.id} item={item} />)}
        </ToastPrimitive.Viewport>
    </ToastPrimitive.Portal>;
}

export function Toaster({ children }) {
    return <ToastPrimitive.Provider toastManager={toast}>
        {children}
        <ToastList />
    </ToastPrimitive.Provider>;
}
