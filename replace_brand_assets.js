
const fs = require("fs");
let content = fs.readFileSync("src/components/brand/BrandLogo.tsx", "utf-8");

content = content.replace(/\/brand\/gstpilot-icon-white\.png/g, "/icon.png");
content = content.replace(/\/brand\/gstpilot-icon\.png/g, "/icon.png");
content = content.replace(/\/brand\/gstpilot-logo-full\.png/g, "/logo.png");
content = content.replace(/\/brand\/gstpilot-logo-full-transparent\.png/g, "/logo.png");
content = content.replace(/\/brand\/gstpilot-splash\.png/g, "/logo.png");
content = content.replace(/iconTransparent/g, "iconSrc"); // fix the reference

fs.writeFileSync("src/components/brand/BrandLogo.tsx", content, "utf-8");
console.log("Replaced assets in BrandLogo.tsx");

