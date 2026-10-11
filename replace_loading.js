
const fs = require("fs");
let content = fs.readFileSync("src/components/ui/premium-loading.tsx", "utf-8");

content = content.replace(/GSTPilot/g, "VEYRO");
content = content.replace(/<svg[\s\S]*?<\/svg>/g, `<img src="/icon.png" width={size} height={size} alt="VEYRO" className={className} style={{ objectFit: "contain" }} />`);

fs.writeFileSync("src/components/ui/premium-loading.tsx", content, "utf-8");
console.log("Replaced in premium-loading.tsx");

