
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
walk("src", function(filePath) {
    if (!filePath.endsWith(".tsx") && !filePath.endsWith(".ts") && !filePath.endsWith(".css")) return;
    
    let content = fs.readFileSync(filePath, "utf-8");
    let original = content;

    content = content.replace(/VEYRO Infinity™/g, "VEYRO");
    content = content.replace(/VEYRO Infinity/g, "VEYRO");
    
    if (content !== original) {
        try {
            fs.writeFileSync(filePath, content, "utf-8");
            count++;
        } catch (e) { }
    }
});

console.log(`Replaced Infinity in ${count} files in src`);

