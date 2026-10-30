import LegalPageLayout from "@/components/legal-page-layout";
import { getGitHubStars } from "@/lib/githubRelease";

const updatedAt = "29 October 2026";

export async function getStaticProps() {
    return { props: { stars: await getGitHubStars() }, revalidate: 3600 };
}

export default function Terms({ stars }) {
    return (
        <LegalPageLayout title="Terms of Use" updatedAt={updatedAt} stars={stars}>
            <p>
                These terms describe use of Placedv Query, an open-source desktop database client published by Sergio Casolari.
                The app runs locally on your computer and connects to database services that you configure.
            </p>

            <section>
                <h2>1. Open-source license</h2>
                <p>
                    The source code and software are provided under the MIT License included in the repository. That license governs
                    your rights to use, copy, modify, and redistribute the software. If these terms conflict with the MIT License on
                    those rights, the MIT License controls.
                </p>
            </section>

            <section>
                <h2>2. Your use of connected databases</h2>
                <ul>
                    <li>Connect only to databases and data you are authorized to access.</li>
                    <li>Follow applicable laws, your organization&apos;s rules, and the database provider&apos;s terms.</li>
                    <li>You are responsible for the queries and changes you run, and for keeping appropriate backups before editing or deleting data.</li>
                    <li>Use database accounts with only the permissions needed for your work.</li>
                </ul>
            </section>

            <section>
                <h2>3. Local software and third-party services</h2>
                <p>
                    Placedv Query stores its app data on your computer and connects directly to the databases you configure. It is not
                    a hosted database service and the publisher does not operate a cloud account or synchronization service for the app.
                    GitHub distributes the source code and releases and may provide update downloads; your use of GitHub is subject to
                    GitHub&apos;s own terms.
                </p>
            </section>

            <section>
                <h2>4. No warranty and limitation of liability</h2>
                <p>
                    The software is provided under the warranty and liability terms in the MIT License, subject to rights and remedies
                    that cannot be excluded under applicable law. The publisher does not guarantee that the app will be uninterrupted,
                    error-free, compatible with every database, or suitable for a particular purpose. To the extent permitted by law,
                    the publisher is not responsible for data loss or damage resulting from your queries, database configuration, device,
                    or use of the software. Keep independent backups of important data.
                </p>
            </section>

            <section>
                <h2>5. Updates and availability</h2>
                <p>
                    Releases and update availability may change over time. Update checks are initiated by you from the app settings.
                    The publisher may maintain, change, or discontinue releases or support at any time, subject to the MIT License and
                    applicable law.
                </p>
            </section>

            <section>
                <h2>6. Contact</h2>
                <p>
                    Publisher: Sergio Casolari. Contact: <a href="mailto:info@placedv.com">info@placedv.com</a>.
                    For privacy requests, use a private contact channel and do not post personal information or database details in
                    public GitHub issues.
                </p>
            </section>
        </LegalPageLayout>
    );
}
