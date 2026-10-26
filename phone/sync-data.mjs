// Copies the surah names and verse counts from ../surahs.js so the phone page and the
// server's checks use the same numbers as the extension. Run by `npm run dev|deploy`.
import { readFileSync, writeFileSync } from "node:fs";

const src = readFileSync(new URL("../surahs.js", import.meta.url), "utf8");
writeFileSync(new URL("./public/surahs.js", import.meta.url), src);
writeFileSync(new URL("./src/surahs.mjs", import.meta.url), src + "\nexport { SURAH_NAMES, SURAH_VERSES };\n");
console.log("copied surahs.js");
