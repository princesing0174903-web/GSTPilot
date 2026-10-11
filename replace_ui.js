
const fs = require("fs");
const path = require("path");

function walk(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
    });
}

let count = 0;
walk("src/components", function(filePath) {
    if (!filePath.endsWith(".tsx") && !filePath.endsWith(".ts")) return;
    
    let content = fs.readFileSync(filePath, "utf-8");
    let original = content;

    content = content.replace(/GSTPilot/g, "VEYRO");
    content = content.replace(/gstpilot\.in/g, "veyro.com");
    content = content.replace(/GSTPilot™/g, "VEYRO™");
    content = content.replace(/GSTPilot Infinity™/g, "VEYRO");
    content = content.replace(/GSTPilot Infinity/g, "VEYRO");
    content = content.replace(/GSTPilot AI/g, "VEYRO AI");
    
    if (content !== original) {
        fs.writeFileSync(filePath, content, "utf-8");
        count++;
    }
});

console.log(`Replaced in ${count} files in src/components`);

