const fs = require('fs');

let code = fs.readFileSync('src/lib/supabaseClient.ts', 'utf8');

const target = `  insert(data: any): any {
    const p = (async () => {
       const ref = await addDoc(collection(db, this.table), data);
       const snapshot = await getDoc(ref);
       return { data: { id: snapshot.id, ...(snapshot.data() as any) }, error: null };
    })();`;

const replacement = `  insert(data: any): any {
    const p = (async () => {
       if (data.id) {
           await setDoc(doc(db, this.table, data.id), data);
           const snapshot = await getDoc(doc(db, this.table, data.id));
           return { data: { id: snapshot.id, ...(snapshot.data() as any) }, error: null };
       } else {
           const ref = await addDoc(collection(db, this.table), data);
           const snapshot = await getDoc(ref);
           return { data: { id: snapshot.id, ...(snapshot.data() as any) }, error: null };
       }
    })();`;

code = code.replace(target, replacement);

fs.writeFileSync('src/lib/supabaseClient.ts', code);
