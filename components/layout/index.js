import NavigationBar from "@/components/navigationBar";

export default function Layout({ children, title }) {
    return <div>
        <NavigationBar/>
        <div className="ml-[64px] flex items-center h-16">
            <span className="text-lg font-semibold px-2">{title}</span>
        </div>
        <div className="ml-[64px] px-2 pr-4">
            {children}
        </div>
    </div>
}
