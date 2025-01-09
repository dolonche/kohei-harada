import { defineConfig } from "astro/config";

import tailwind from "@astrojs/tailwind";

import relativeLinks from "astro-relative-links";
import basicSsl from "@vitejs/plugin-basic-ssl";

// https://astro.build/config
export default defineConfig({
  i18n: {
    locales: ["jp", "en"],
    defaultLocale: "en",
  },
  integrations: [tailwind(), relativeLinks()],
  vite: {
    plugins: [basicSsl()],
  },
});
