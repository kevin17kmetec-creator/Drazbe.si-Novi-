const fs = require('fs');

let code = fs.readFileSync('App.tsx', 'utf8');

// Fix Promise.race bug
const target = `      const { error } = (await Promise.race([
        insertPromise,
        timeoutPromise,
      ])) as any;`;

const replacement = `      const { error } = (await Promise.race([
        insertPromise.then(() => ({ data: true, error: null })).catch((e: any) => ({ data: null, error: e })),
        timeoutPromise,
      ])) as any;`;

code = code.replace(target, replacement);

fs.writeFileSync('App.tsx', code);
console.log("App.tsx fixed");
