import LegalPageLayout from "@/components/legal-page-layout";
import { getGitHubStars } from "@/lib/githubRelease";

const updatedAt = "30 October 2026";

export async function getStaticProps() {
    return { props: { stars: await getGitHubStars() }, revalidate: 3600 };
}

export default function Privacy({ stars }) {
    return (
        <LegalPageLayout title="Privacy Policy" updatedAt={updatedAt} stars={stars}>
            <p>
                This notice explains how Placedv Query handles information when you use the desktop application and this website.
                Placedv Query is an open-source desktop database client published by Sergio Casolari. It runs on your computer
                and is not a hosted database service.
            </p>

            <section>
                <h2>1. Who publishes the app and how to contact us</h2>
                <p>
                    Publisher: Sergio Casolari. Privacy contact: <a href="mailto:info@placedv.com">info@placedv.com</a>.
                    Do not send database contents, credentials, or other sensitive information in a public GitHub issue.
                </p>
            </section>

            <section>
                <h2>2. Information handled on your computer</h2>
                <p>
                    The app creates a local SQLite database in Electron&apos;s per-user application data directory. It stores app settings,
                    saved connection details, and activity history there. SQLite files you import are also stored on your computer.
                    The app does not upload this local data to a Placedv Query server, and it does not provide cloud sync, user accounts,
                    analytics, telemetry, or remote crash reporting.
                </p>
                <p>
                    During use, the app also keeps workspace state in the local Electron session storage. This can include the current
                    SQL editor contents and table or query results displayed in the workspace. This is local browser storage, not a
                    Placedv Query server upload, and it is not protected by the app&apos;s database-credential encryption. Do not rely on
                    closing the app as secure erasure; protect access to your device and its user account.
                </p>
                <p>
                    Saved database connection details and SQL text in activity history are encrypted by the app. The encryption key is
                    protected with the operating system&apos;s secure storage in packaged builds. Other local database fields, including
                    activity metadata such as database and table names, operation type, status, and timestamps, are not encrypted by this
                    application layer. Imported SQLite files and the local SQLite database are not encrypted as complete files by the app;
                    protect your device account and use full-disk encryption where available.
                </p>
                <p>
                    Activity history is stored locally. History for a database is cleared after 90 days without activity when that
                    database or its history is accessed again; this cleanup does not run in the background while the app is closed.
                    Other local data remains until you remove it in the app or delete the app&apos;s local data directory. Uninstalling the
                    app may not remove that directory automatically.
                </p>
            </section>

            <section>
                <h2>3. Connections to databases</h2>
                <p>
                    When you connect to a database, the app connects directly from your computer to the database endpoint you configure.
                    Queries and any data returned are handled by the app on your device; they are not routed through a Placedv Query
                    server. The database provider may receive connection and query traffic as part of that connection. You choose the
                    endpoint and any available TLS or SSH settings.
                </p>
                <p>
                    Only connect to databases you are authorized to access. You are responsible for having the required authority and
                    legal basis to access and process data in those databases, including personal or sensitive data.
                </p>
            </section>

            <section>
                <h2>4. GitHub and software updates</h2>
                <p>
                    The website retrieves public release information and the public star count from GitHub during server-side page
                    generation or revalidation. Placedv Query does not use GitHub for sign-in or user accounts, and you do not need a
                    GitHub account to use the app. GitHub is used to host public source code and releases. The app checks for updates
                    only when you request a check in its settings, and downloads releases from GitHub. When your device contacts GitHub,
                    GitHub may process standard request information such as your IP address, request time, device or application details,
                    and the requested release or asset, under its own
                    <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noreferrer">Privacy Statement</a>.
                    Opening GitHub links or downloading a release also takes you to GitHub and is subject to its terms and privacy notice.
                </p>
            </section>

            <section>
                <h2>5. Website hosting</h2>
                <p>
                    This website is hosted by Railway. Railway may process technical request, device, and operational data to provide,
                    secure, and maintain the hosting service. For details about its collection, use, retention, and international
                    processing of personal data, see the
                    <a href="https://railway.com/legal/privacy" target="_blank" rel="noreferrer">Railway Privacy Policy</a>.
                    This website does not include analytics or advertising trackers in the application code.
                </p>
            </section>

            <section>
                <h2>6. Legal basis, recipients, and international transfers</h2>
                <p>
                    The publisher does not receive database contents or connection credentials through the desktop app. GitHub and Railway
                    may process technical information when your device or browser communicates with their services, under their respective
                    privacy notices. If you
                    contact the publisher directly, the information you include will be used to respond to your request and retained only
                    as needed for that purpose or to meet legal obligations. No personal information is sold by the publisher.
                </p>
                <p>
                    GitHub and Railway may process information in countries outside your own. Review their notices for the locations and
                    safeguards that apply to their services.
                </p>
            </section>

            <section>
                <h2>7. Your rights and complaints</h2>
                <p>
                    Rights concerning information stored in your local app data can generally be exercised directly on your device by
                    editing or deleting that data. The publisher cannot remotely access or change it. Where the publisher processes
                    personal information about you, you may request access, correction, deletion, restriction, or object to processing
                    by contacting the privacy address above, subject to applicable law. You may also lodge a complaint with your
                    supervisory authority; in Italy, this is the <a href="https://www.garanteprivacy.it/" target="_blank" rel="noreferrer">Garante per la protezione dei dati personali</a>.
                </p>
            </section>

            <section>
                <h2>8. Changes to this notice</h2>
                <p>
                    This notice may be updated when the app&apos;s data handling changes. The date at the top indicates the latest revision.
                </p>
            </section>
        </LegalPageLayout>
    );
}
