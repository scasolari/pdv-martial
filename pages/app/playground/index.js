export async function getServerSideProps() {
    return {
        redirect: {
            destination: "/app/playground/play",
            permanent: false,
        },
    }
}

export default function LegacyPlaygroundRedirect() {
    return null
}
