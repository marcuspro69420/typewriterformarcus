const express = require('express');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const app = express();
const PORT = process.env.PORT || 10000;

// CHANGE THIS TO YOUR OWN PASSWORD
const ADMIN_PASSWORD = "197312"; 

const apiKey = "AIzaSyDF5CSGJVA0ys7rjMZOQB4r1CIijviUYLE"; 
const genAI = new GoogleGenerativeAI(apiKey);

// FIXED: Updated model string to avoid the v1 404 error
const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash-latest",
    systemInstruction: "You are Gebidi, an unhinged AI for a Roblox Build Logic server. Your output MUST be under 16 characters. Be blunt and short."
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let panelState = {
    "value": "00000000",
    "next": false,
    "lastResponse": ""
};

const charToBinary = (char) => {
    return char.charCodeAt(0).toString(2).padStart(8, '0');
};

app.get('/gemini/read', (req, res) => {
    res.json({
        "value": panelState.value,
        "next": panelState.next
    });
    
    if (panelState.next) {
        setTimeout(() => { panelState.next = false; }, 50);
    }
});

app.post('/gemini/api/chat', async (req, res) => {
    const { prompt, password } = req.body;
    
    // Security Check
    if (password !== ADMIN_PASSWORD) {
        return res.status(403).send("GET OUT OF MY SITE AISULTAN OR INTENS IM SLEEPING");
    }

    if (!prompt) return res.status(400).send("Empty prompt");
    try {
        console.log("Sending to Gemini:", prompt);
        const result = await model.generateContent(prompt);
        const responseText = result.response.text().trim().substring(0, 16); 
        panelState.lastResponse = responseText;
        
        panelState.value = charToBinary(responseText[0] || " ");
        panelState.next = true;
        
        res.redirect('/gemini/edit?status=ai_replied');
    } catch (error) {
        console.error("GEMINI API ERROR:", error.message);
        res.status(500).send("AI Error: " + error.message);
    }
});

app.get('/gemini/edit', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>GEBIDI | AI INTERFACE</title>
            <style>
                body { background: #050505; color: #00ff41; font-family: monospace; padding: 20px; }
                .container { border: 1px solid #00ff41; padding: 20px; max-width: 500px; margin: auto; box-shadow: 0 0 10px #00ff41; }
                input { background: #111; color: #00ff41; border: 1px solid #00ff41; padding: 10px; width: 100%; box-sizing: border-box; margin-bottom: 10px; }
                button { background: #00ff41; color: #000; border: none; padding: 10px; width: 100%; cursor: pointer; font-weight: bold; }
                .response { background: #111; padding: 10px; border-left: 3px solid cyan; margin: 15px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>GEBIDI TERMINAL</h1>
                <form action="/gemini/api/chat" method="POST">
                    <input type="password" name="password" placeholder="ENTER ADMIN PASS" required>
                    <input type="text" name="prompt" placeholder="Message AI..." required>
                    <button type="submit">AI GENERATE</button>
                </form>
                <div class="response">
                    <strong>AI Output:</strong> \${panelState.lastResponse || "None"}
                </div>
            </div>
        </body>
        </html>
    `);
});

app.get('/', (req, res) => res.redirect('/gemini/edit'));
app.listen(PORT, '0.0.0.0', () => console.log("GEBIDI ONLINE"));
