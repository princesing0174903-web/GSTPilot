
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
    if (!filePath.endsWith(".tsx") && !filePath.endsWith(".ts")) return;
    
    let content = fs.readFileSync(filePath, "utf-8");
    let original = content;

    content = content.replace(/The Financial Brain of India/gi, "The AI Operating System for Business");
    content = content.replace(/The Financial Brain/g, "The AI Operating System");
    
    if (content !== original) {
        fs.writeFileSync(filePath, content, "utf-8");
        count++;
    }
});

console.log(`Replaced tagline in ${count} files in src`);

