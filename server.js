import { installGlobals } from "@remix-run/node";
import { run } from "@remix-run/serve";
import { execSync } from "child_process";

installGlobals();

// Hostinger ortamında bazen build sonrası prisma generate gerekebilir
try {
  console.log("Prisma client oluşturuluyor...");
  execSync("npx prisma generate", { stdio: "inherit" });
} catch (e) {
  console.error("Prisma generate hatası (atlanıyor):", e);
}

const port = process.env.PORT || 3000;
console.log(`Uygulama ${port} portu üzerinde başlatılıyor...`);

process.argv.push("./build/server/index.js");
run();
