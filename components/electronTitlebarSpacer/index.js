export default function ElectronTitlebarSpacer() {
    const handleDoubleClick = () => {
        window.desktopWindow?.toggleMaximize?.();
    };

    return (
        <div
            aria-hidden="true"
            className="electron-titlebar-drag-region h-full min-w-8 flex-1 select-none"
            onDoubleClick={handleDoubleClick}
        />
    );
}
