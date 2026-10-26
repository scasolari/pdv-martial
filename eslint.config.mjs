import js from "@eslint/js";
import globals from "globals";
import nextPlugin from "@next/eslint-plugin-next";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";

const sourceFiles = ["**/*.{js,jsx,mjs}"];

const eslintConfig = [
    {
        ignores: ["**/.next/**", "**/node_modules/**", "**/out/**", "**/build/**", "generated/test-auth-client/**"],
    },
    {
        ...js.configs.recommended,
        files: sourceFiles,
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            parserOptions: { ecmaFeatures: { jsx: true } },
            globals: { ...globals.browser, ...globals.node },
        },
    },
    {
        ...react.configs.flat.recommended,
        files: sourceFiles,
        settings: { react: { version: "detect" } },
    },
    {
        ...react.configs.flat["jsx-runtime"],
        files: sourceFiles,
    },
    {
        ...reactHooks.configs.flat.recommended,
        files: sourceFiles,
    },
    {
        ...jsxA11y.flatConfigs.recommended,
        files: sourceFiles,
    },
    {
        ...nextPlugin.configs["core-web-vitals"],
        files: sourceFiles,
    },
    {
        files: sourceFiles,
        rules: {
            // The app uses plain JavaScript with Redux-connected components and
            // does not declare runtime PropTypes; keep lint focused on actionable checks.
            "react/prop-types": "off",
            // The app predates React Compiler and intentionally uses refs/effects
            // for imperative integrations such as CodeMirror and table editors.
            "react-hooks/refs": "off",
            "react-hooks/purity": "off",
            "react-hooks/set-state-in-effect": "off",
            "react-hooks/static-components": "off",
            "react-hooks/use-memo": "off",
            "react-hooks/preserve-manual-memoization": "off",
            "react-hooks/immutability": "off",
            "react-hooks/globals": "off",
            "react-hooks/error-boundaries": "off",
            "react-hooks/set-state-in-render": "off",
            // React Compiler is not enabled in this app; TanStack's table instance is intentionally imperative.
            "react-hooks/incompatible-library": "off",
        },
    },
];

export default eslintConfig;
