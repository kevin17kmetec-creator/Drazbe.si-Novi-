const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

const target = `const MainApp: React.FC = () => {
  const [language, setLanguage] = useState(() => {`;
  
const replacement = `const MainApp: React.FC = () => {
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const allowed = localStorage.getItem('is_allowed_developer') === 'true';
      if (allowed) {
        setIsAllowed(true);
      } else {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('preview') === 'open') {
          localStorage.setItem('is_allowed_developer', 'true');
          setIsAllowed(true);
        } else {
          setIsAllowed(false);
        }
      }
    }
  }, []);

  const [language, setLanguage] = useState(() => {`;

code = code.replace(target, replacement);

const returnTarget = `  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#f3f4f6] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#FEBA4F] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }`;

const returnReplacement = `  if (isAllowed === false) {
    return (
      <div className="min-h-screen bg-[#f3f4f6] flex items-center justify-center font-sans">
        <h1 className="text-3xl font-black text-[#0A1128] uppercase tracking-widest">Stran je trenutno v pripravi.</h1>
      </div>
    );
  }

  if (isAuthLoading || isAllowed === null) {
    return (
      <div className="min-h-screen bg-[#f3f4f6] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#FEBA4F] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }`;

code = code.replace(returnTarget, returnReplacement);
fs.writeFileSync('App.tsx', code);
