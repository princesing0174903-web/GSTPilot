
const fs = require("fs");
let content = fs.readFileSync("src/components/brand/BrandLogo.tsx", "utf-8");

content = content.replace(/The Financial Brain of India/g, "The AI Operating System for Business");
content = content.replace(/\/brand\/gstpilot-icon-transparent\.png/g, "/icon.png");
content = content.replace(/\/brand\/gstpilot-logo-dark\.png/g, "/logo.png");
content = content.replace(/\/brand\/gstpilot-icon\.svg/g, "/icon.png");
content = content.replace(/\/brand\/gstpilot-logo-full-dark\.png/g, "/logo.png");

// Replace Image component rendering the SVG with native img tag or just fix the src.
// Since we used next/image maybe I don t need to change the component.
// Wait, the SVG was an inline SVG previously? Let us check later.

fs.writeFileSync("src/components/brand/BrandLogo.tsx", content, "utf-8");
console.log("Replaced in BrandLogo.tsx");

