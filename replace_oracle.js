
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

    content = content.replace(/>Oracle</g, ">VEYRO AI<");
    content = content.replace(/Ask Oracle/g, "Ask VEYRO AI");
    content = content.replace(/Oracle Intelligence/g, "VEYRO AI Intelligence");
    content = content.replace(/Oracle Memory/g, "VEYRO AI Memory");
    content = content.replace(/Oracle is thinking/g, "VEYRO AI is thinking");
    content = content.replace(/VEYRO Oracle/g, "VEYRO AI");
    content = content.replace(/Oracle AI/g, "VEYRO AI");
    content = content.replace(/the Oracle/gi, "VEYRO AI");
    content = content.replace(/your Oracle/gi, "VEYRO AI");
    
    if (content !== original) {
        try {
            fs.writeFileSync(filePath, content, "utf-8");
            count++;
        } catch (e) { }
    }
});

console.log(`Replaced Oracle UI text in ${count} files in src`);

