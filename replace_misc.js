
const fs = require("fs");
const path = require("path");

function walk(dir, callback) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
    });
}

let count = 0;
["src/data", "src/services", "src/stores", "src/types", "src/middleware.ts"].forEach(folder => {
    try {
        if (!fs.statSync(folder).isDirectory()) {
            // it s a file
            let filePath = folder;
            let content = fs.readFileSync(filePath, "utf-8");
            let original = content;
            content = content.replace(/GSTPilot Oracle™/g, "VEYRO AI");
            content = content.replace(/GSTPilot Oracle/g, "VEYRO AI");
            content = content.replace(/GSTPilot/g, "VEYRO");
            if (content !== original) {
                fs.writeFileSync(filePath, content, "utf-8");
                count++;
            }
            return;
        }
    } catch(e) {}
    walk(folder, function(filePath) {
        if (!filePath.endsWith(".tsx") && !filePath.endsWith(".ts")) return;
        
        let content = fs.readFileSync(filePath, "utf-8");
        let original = content;

        content = content.replace(/GSTPilot Oracle™/g, "VEYRO AI");
        content = content.replace(/GSTPilot Oracle/g, "VEYRO AI");
        content = content.replace(/GSTPilot/g, "VEYRO");
        
        if (content !== original) {
            try {
                fs.writeFileSync(filePath, content, "utf-8");
                count++;
            } catch (e) { }
        }
    });
});
console.log(`Replaced in ${count} files in misc folders`);

