const fs = require("fs");
let content = fs.readFileSync("src/app/layout.tsx", "utf-8");

content = content.replace(/GSTPilot/g, "VEYRO");
content = content.replace(/GSTPilot™/g, "VEYRO™");
content = content.replace(/The Financial Brain of India/g, "The AI Operating System for Business");
content = content.replace(/the world's most premium Financial Operating System for Chartered Accountants and Indian Businesses\. GST, Banking, Invoicing, Reconciliation and an AI CFO in one brain\./g, "VEYRO is an AI operating system for modern businesses, combining financial intelligence, operations, invoicing, banking, reporting, automation and compliance in one platform.");
content = content.replace(/The world's most premium Financial Operating System for Chartered Accountants and Indian Businesses\./g, "VEYRO is an AI operating system for modern businesses, combining financial intelligence, operations, invoicing, banking, reporting, automation and compliance in one platform.");
content = content.replace(/A globally premium AI financial brain designed for India\. Manage GST, banking, invoices, and reconciliation with an AI CFO that actually thinks\./g, "VEYRO is an AI operating system for modern businesses, combining financial intelligence, operations, invoicing, banking, reporting, automation and compliance in one platform.");
content = content.replace(/gstpilot\.in/g, "veyro.com");
content = content.replace(/"GST software",\s*"Chartered Accountant software",\s*"India GST filing",\s*"AI CFO",\s*"financial operating system",\s*"GST reconciliation",\s*"invoice engine",\s*"India fintech",/g, `"AI Operating System",\n    "Business Intelligence",\n    "Finance",\n    "Invoicing",\n    "Banking",\n    "Compliance",`);
content = content.replace(/\/brand\/gstpilot-icon\.svg/g, "/icon.png");
content = content.replace(/VEYRO Infinity™/g, "VEYRO");
content = content.replace(/VEYRO,/g, "VEYRO");

fs.writeFileSync("src/app/layout.tsx", content, "utf-8");
console.log("Replaced in layout.tsx");
