import Layout from "@/components/layout";
import LeftBar from "@/components/navigationBar/leftBar";
import { ShowNavigationButton } from "@/components/navigationBar/navigationVisibility";

export default function Settings() {
    return <>
        <LeftBar/>
        <div className="fixed left-3 top-3 z-50"><ShowNavigationButton /></div>
    </>
}
