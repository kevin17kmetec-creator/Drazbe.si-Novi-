const fs = require('fs');
let code = fs.readFileSync('src/components/AuthView.tsx', 'utf8');

// Add imports
if (!code.includes('getDoc')) {
    code = code.replace(
        "import { setDoc, doc } from 'firebase/firestore';", 
        "import { setDoc, doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';"
    );
}

const targetGoogle = `  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      await setDoc(doc(db, "users", result.user.uid), { id: result.user.uid, email: result.user.email, is_verified: false }, { merge: true });
      onLoginSuccess();
    } catch (error: any) {
      toast.error(\`\${t("googleLoginError")} \${error.message}\`);
      setLoading(false);
    }
  };`;

const replacementGoogle = `  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      const email = result.user.email;
      
      // Check if user already has a password provider linked
      const hasPassword = result.user.providerData.some(p => p.providerId === 'password');
      if (hasPassword) {
          await signOut(auth);
          toast.error("Ta e-mail je že registriran. Prosimo, prijavite se z e-mailom in geslom.");
          setLoading(false);
          return;
      }
      
      // Check if another user document exists with the same email
      const q = query(collection(db, "users"), where("email", "==", email));
      const querySnapshot = await getDocs(q);
      
      let passwordAccountExists = false;
      querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.id !== result.user.uid && data.auth_provider !== 'google') {
              passwordAccountExists = true;
          }
      });
      
      if (passwordAccountExists) {
          await signOut(auth);
          toast.error("Ta e-mail je že registriran. Prosimo, prijavite se z e-mailom in geslom.");
          setLoading(false);
          return;
      }
      
      const userRef = doc(db, "users", result.user.uid);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
          await setDoc(userRef, { 
              id: result.user.uid, 
              email: result.user.email, 
              is_verified: false,
              auth_provider: 'google'
          }, { merge: true });
      } else {
          // Update only auth_provider if not set, DO NOT overwrite is_verified
          await setDoc(userRef, { auth_provider: 'google' }, { merge: true });
      }
      
      onLoginSuccess();
    } catch (error: any) {
      if (error.code === 'auth/account-exists-with-different-credential') {
          toast.error("Ta e-mail je že registriran. Prosimo, prijavite se z e-mailom in geslom.");
      } else {
          toast.error(\`\${t("googleLoginError")} \${error.message}\`);
      }
      setLoading(false);
    }
  };`;

code = code.replace(targetGoogle, replacementGoogle);

fs.writeFileSync('src/components/AuthView.tsx', code);
console.log("Done patching AuthView handleGoogleLogin");
