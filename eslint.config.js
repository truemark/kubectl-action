import eslintPlugin from "@typescript-eslint/eslint-plugin";
import eslintParser from "@typescript-eslint/parser";

export default [
  {
    ignores: ["node_modules", "dist"],
  },
  {
    languageOptions: {
      parser: eslintParser,
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    plugins: {
      "@typescript-eslint": eslintPlugin,
    },
    rules: {
      "no-console": "warn",
    },
  },
];
