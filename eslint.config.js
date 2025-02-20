module.exports = [
  {
    ignores: ["dist", "lib", "node_modules"],
  },
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: require("@typescript-eslint/parser"),
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    plugins: {
      "@typescript-eslint": require("@typescript-eslint/eslint-plugin"),
    },
    rules: {
      "no-console": "warn",
    },
  },
];
