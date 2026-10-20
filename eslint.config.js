import globals from "globals";

export default [{
  files: ["src/**/*.{js,jsx}", "api/**/*.js", "server/**/*.js", "scripts/**/*.mjs", "tests/**/*.mjs"],
  languageOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
    globals: { ...globals.browser, ...globals.node, ...globals.es2022 }
  },
  rules: {
    // In particular, prevent runtime crashes from undefined menu/icons/components.
    "no-undef": "error"
  }
}];
