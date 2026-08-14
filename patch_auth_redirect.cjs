const fs = require('fs');

// Patch App.tsx
let appCode = fs.readFileSync('App.tsx', 'utf8');
appCode = appCode.replace(/  \/\/ Redirect to home if logged in and on login page\n  useEffect\(\(\) => \{\n    if \(isLoggedIn && activeView === "login"\) \{\n      setActiveView\("grid"\);\n      setSelectedRegion\(null\);\n      setSelectedCategory\(null\);\n      setSearchQuery\(""\);\n      window\.scrollTo\(\{ top: 0, behavior: "instant" \}\);\n    \}\n  \}, \[isLoggedIn, activeView\]\);\n/g, "");
fs.writeFileSync('App.tsx', appCode);

// Patch AuthView.tsx
let authCode = fs.readFileSync('src/components/AuthView.tsx', 'utf8');
authCode = authCode.replace(/        await setDoc\(userRef, \{\n          id: result\.user\.uid,/g, "        await setDoc(userRef, {\n          id: result.user.uid,");

if (authCode.includes('setAppLoggedIn(true);\n      onLoginSuccess();\n    } catch (error: any) {') === false) {
    authCode = authCode.replace(/      setAppLoggedIn\(true\);\n    \} catch \(error: any\) \{/, "      setAppLoggedIn(true);\n      onLoginSuccess();\n    } catch (error: any) {");
}

fs.writeFileSync('src/components/AuthView.tsx', authCode);
console.log("Auth redirect patched");
