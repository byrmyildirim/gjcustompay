import { installGlobals } from "@remix-run/node";
import { run } from "@remix-run/serve";

installGlobals();

// Hostinger portu otomatik atayabilir veya 3000 üzerinden çalışabilir.
const port = process.env.PORT || 3000;

console.log(`Uygulama ${port} portu üzerinde başlatılıyor...`);

// Remix serve klasörünü hedef gösteriyoruz
process.argv.push("./build/server/index.js");

run();
