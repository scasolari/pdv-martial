import { useRouter } from "next/router";
import AppSettingsDialog from "@/components/appSettingsDialog";

export default function SettingsPage() {
    const router = useRouter();
    return <AppSettingsDialog open onOpenChange={(open) => { if (!open) router.back(); }} />;
}
