// eslint.config.mjs
import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "module",
      globals: {
        process: "readonly",
        module: "readonly",
        require: "readonly",
        __dirname: "readonly",
        setTimeout: "readonly",
        console: "readonly",

        describe: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        jest: "readonly",
      },
    },
  },
];
