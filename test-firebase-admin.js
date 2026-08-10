try {
  const { applicationDefault } = require('firebase-admin/app');
  applicationDefault();
  console.log("applicationDefault success");
} catch (e) {
  console.error("applicationDefault error", e.message);
}
