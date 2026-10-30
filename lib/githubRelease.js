const RELEASE_FALLBACK = {
    version: "0.0.3",
    url: "https://github.com/scasolari/pdv-martial/releases/tag/v0.0.3",
    appleSiliconUrl: "https://github.com/scasolari/pdv-martial/releases/download/v0.0.3/Placedv-Query-0.0.3-arm64.dmg",
    intelUrl: "https://github.com/scasolari/pdv-martial/releases/download/v0.0.3/Placedv-Query-0.0.3.dmg",
    windowsUrl: "https://github.com/scasolari/pdv-martial/releases/latest",
    linuxUrl: "https://github.com/scasolari/pdv-martial/releases/latest",
    linuxDebUrl: "https://github.com/scasolari/pdv-martial/releases/latest",
    stars: 0,
};

export async function getGitHubStars() {
    try {
        const response = await fetch("https://api.github.com/repos/scasolari/pdv-martial", {
            headers: {
                Accept: "application/vnd.github+json",
                "User-Agent": "Placedv-Query-website",
            },
            signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) return 0;
        const repository = await response.json();
        return Number.isInteger(repository.stargazers_count) ? repository.stargazers_count : 0;
    } catch (error) {
        console.error("Unable to load GitHub star count:", error);
        return 0;
    }
}

export async function getLatestRelease() {
    try {
        const response = await fetch("https://api.github.com/repos/scasolari/pdv-martial/releases/latest", {
            headers: {
                Accept: "application/vnd.github+json",
                "User-Agent": "Placedv-Query-website",
            },
            signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) throw new Error(`GitHub release lookup failed: ${response.status}`);

        const latestRelease = await response.json();
        const assets = Array.isArray(latestRelease.assets) ? latestRelease.assets : [];
        const appleSiliconAsset = assets.find(({ name }) => /(?:arm64|aarch64).*\.dmg$/i.test(name));
        const intelAsset = assets.find(({ name }) => /\.dmg$/i.test(name) && !/(?:arm64|aarch64)/i.test(name));
        const windowsAsset = assets.find(({ name }) => /\.exe$/i.test(name) && !/\.blockmap$/i.test(name));
        const linuxAsset = assets.find(({ name }) => /\.appimage$/i.test(name));
        const linuxDebAsset = assets.find(({ name }) => /\.deb$/i.test(name));

        if (!latestRelease.tag_name || !appleSiliconAsset || !intelAsset) {
            throw new Error("Latest GitHub release is missing a Mac DMG asset.");
        }

        const stars = await getGitHubStars();

        return {
            version: latestRelease.tag_name.replace(/^v/i, ""),
            url: latestRelease.html_url,
            appleSiliconUrl: appleSiliconAsset.browser_download_url,
            intelUrl: intelAsset.browser_download_url,
            windowsUrl: windowsAsset?.browser_download_url || latestRelease.html_url,
            linuxUrl: linuxAsset?.browser_download_url || latestRelease.html_url,
            linuxDebUrl: linuxDebAsset?.browser_download_url || latestRelease.html_url,
            stars,
        };
    } catch (error) {
        console.error("Unable to load the latest GitHub release:", error);
        return RELEASE_FALLBACK;
    }
}
