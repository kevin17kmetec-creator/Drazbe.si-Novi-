import * as fs from 'fs';
let code = fs.readFileSync('src/server/app.ts', 'utf8');
code = code.replace(
  "  getDocSnapshotData\n} from '../lib/firebase-admin';",
  "  getDocSnapshotData,\n  FieldValue\n} from '../lib/firebase-admin';"
);
if (!code.includes("FieldValue\n} from '../lib/firebase-admin';")) {
  code = code.replace(
    "  getDocSnapshotData\r\n} from '../lib/firebase-admin';",
    "  getDocSnapshotData,\n  FieldValue\n} from '../lib/firebase-admin';"
  );
}
fs.writeFileSync('src/server/app.ts', code);
