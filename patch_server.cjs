const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

if (!code.includes("import { GoogleGenAI }")) {
    code = "import { GoogleGenAI } from '@google/genai';\n" + code;
}

const endpointCode = `
  app.use(express.json());
  
  app.post("/api/analyze-receipt", async (req, res) => {
    try {
        const { imageUrl } = req.body;
        if (!imageUrl) return res.status(400).json({error: "No imageUrl provided"});
        
        const response = await fetch(imageUrl);
        const arrayBuffer = await response.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString('base64');
        const mimeType = response.headers.get('content-type') || 'image/jpeg';
        
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const geminiResponse = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: [
                {
                    role: 'user',
                    parts: [
                        { inlineData: { data: base64Data, mimeType } },
                        { text: "Analiziraj ta račun iz pošte. Poišči skupni znesek poštnine ali končni znesek za plačilo. Vrni izključno JSON objekt v obliki: {\\\"shipping_cost\\\": float, \\\"currency\\\": \\\"EUR\\\"}. Če zneska ne moreš z gotovostjo razbrati, vrni {\\\"shipping_cost\\\": null}." }
                    ]
                }
            ],
            config: {
                responseMimeType: "application/json"
            }
        });
        
        const resultText = geminiResponse.text;
        res.json(JSON.parse(resultText));
    } catch (e: any) {
        console.error("Gemini Vision error:", e);
        res.status(500).json({ error: e.message });
    }
  });
`;

if (!code.includes("/api/analyze-receipt")) {
    // Inject right after startServer declaration or after const PORT = 3000;
    // Actually we can inject it right before app.listen
    const target = 'app.listen(PORT, "0.0.0.0", () => {';
    code = code.replace(target, endpointCode + '\n  ' + target);
}

fs.writeFileSync('server.ts', code);
console.log("server.ts patched");
