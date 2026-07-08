const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

const target1 = `  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);

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

`;

code = code.replace(target1, '');

const target2 = `  if (isAllowed === false) {
    return (
      <div className="min-h-screen bg-[#f3f4f6] flex items-center justify-center font-sans">
        <h1 className="text-3xl font-black text-[#0A1128] uppercase tracking-widest">Stran je trenutno v pripravi.</h1>
      </div>
    );
  }

  if (isHydrating || isAllowed === null) {`;

const replacement2 = `  if (isHydrating) {`;

code = code.replace(target2, replacement2);

fs.writeFileSync('App.tsx', code);
