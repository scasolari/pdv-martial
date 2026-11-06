import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useRouter } from "next/router";
import AddDatabase from "@/components/addDatabase";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { setDatabase } from "@/redux/actions/main";

function DesktopSqliteOpener() {
    const dispatch = useDispatch();
    const router = useRouter();
    const [file, setFile] = useState(null);

    useEffect(() => {
        return window.desktopFiles?.onOpenSqliteFile(setFile);
    }, []);

    if (!file) return null;

    const datasetName = file.name.replace(/\.(db|sqlite3?)$/i, "") || file.name;
    const close = () => setFile(null);

    return (
        <AlertDialog open onOpenChange={(open) => { if (!open) close(); }}>
            <AlertDialogContent className="z-[1000] max-h-[90vh] overflow-y-auto bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-sm font-semibold">Open SQLite database</AlertDialogTitle>
                    <AlertDialogDescription className="text-xs font-semibold text-muted-foreground">
                        Review the dataset name and confirm you are authorised to open this file.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AddDatabase
                    key={file.path}
                    sqliteFilePath={file.path}
                    sqliteFileName={file.name}
                    initialDatabaseName={datasetName}
                    onClose={close}
                    onSuccess={(dataset) => {
                        dispatch(setDatabase({
                            db_id: dataset.id,
                            db_name: dataset.db_name,
                            dialect: dataset.dialect,
                        }));
                        close();
                        router.push(`/app/playground/play/${encodeURIComponent(dataset.id)}`);
                    }}
                />
            </AlertDialogContent>
        </AlertDialog>
    );
}

export default DesktopSqliteOpener;
