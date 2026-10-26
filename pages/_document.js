import { Html, Head, Main, NextScript } from "next/document";
import Document from "next/document";

export default function AppDocument({ nonce }) {
  const isMacDesktopApp = process.env.PDV_DESKTOP_APP === "1" && process.platform === "darwin";

  return (
    <Html lang="en" data-electron-platform={isMacDesktopApp ? "darwin" : undefined}>
      <Head />
      <body className="antialiased">
        <Main />
        <NextScript nonce={nonce} />
      </body>
    </Html>
  );
}

AppDocument.getInitialProps = async (context) => {
  const initialProps = await Document.getInitialProps(context);
  return {
    ...initialProps,
    nonce: context.req?.headers["x-nonce"],
  };
};
