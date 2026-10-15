import { defineConfig } from "oxlint";

export default defineConfig({
  ignorePatterns: ["**/*.gen.*", "dist", "public/plugins"],
  rules: {
    // Reze refs assign `let el` from JSX (`ref={el}`) — invisible to a static
    // assignment check, so the rule misfires on the standard idiom.
    "no-unassigned-vars": "off",
  },
});
