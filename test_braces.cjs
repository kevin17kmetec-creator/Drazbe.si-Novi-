const fs = require('fs');
const code = fs.readFileSync('App.tsx', 'utf8');

function getMismatched(text) {
    let count = 0;
    for(let i=0; i<text.length; i++) {
        if(text[i] === '{') count++;
        else if(text[i] === '}') count--;
    }
    return count;
}
console.log(getMismatched(code));
