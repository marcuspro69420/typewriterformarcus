const express = require('express');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const app = express();
const PORT = process.env.PORT || 10000;

// API KEY INTEGRATED
const apiKey = "AIzaSyDF5CSGJVA0ys7rjMZOQB4r1CIijviUYLE"; 
const genAI = new GoogleGenerativeAI(apiKey);

// UPDATED TO GEMINI 1.5 FLASH (Standard Default Project Model)
const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    systemInstruction: "You are Gebidi, an AI that doesn't swear for a Roblox Build Logic server. Your output MUST be under 32 characters. Be nice and short."
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
    res.json(panelState);
    if (panelState.next) {
        setTimeout(() => { panelState.next = false; }, 50);
    }
});

app.post('/gemini/api/chat', async (req, res) => {
    const userPrompt = req.body.prompt;
    if (!userPrompt) return res.status(400).send("Empty prompt");
    try {
        const result = await model.generateContent(userPrompt);
        const responseText = result.response.text().trim().substring(0, 16); 
        panelState.lastResponse = responseText;
        panelState.value = charToBinary(responseText[0] || " ");
        panelState.next = true;
        res.redirect('/gemini/edit?status=ai_replied');
    } catch (error) {
        console.error("Gemini Error:", error);
        res.status(500).send("AI Error - Check logs");
    }
});

app.post('/gemini/api/update', (req, res) => {
    const { value, triggerNext } = req.body;
    if (value !== undefined) {
        panelState.value = String(value).substring(0, 8).padEnd(8, '0');
        panelState.next = (triggerNext === 'true' || triggerNext === true);
        return res.redirect('/gemini/edit?status=updated');
    }
    res.status(400).send("Invalid Data");
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
                .container { border: 1px solid #00ff41; padding: 20px; max-width: 500px; margin: auto; }
                input[type="text"] { background: #111; color: #00ff41; border: 1px solid #00ff41; padding: 10px; width: 100%; box-sizing: border-box; margin-bottom: 10px; }
                button { background: #00ff41; color: #000; border: none; padding: 10px; width: 100%; cursor: pointer; font-weight: bold; margin-bottom: 15px; }
                .response { background: #111; padding: 10px; border-left: 3px solid cyan; margin-bottom: 15px; }
                .url-box { font-size: 0.8rem; background: #222; padding: 5px; color: #aaa; margin-top: 10px; word-break: break-all; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>GEBIDI TERMINAL</h1>
                <label>Talk to Gemini AI:</label>
                <form action="/gemini/api/chat" method="POST">
                    <input type="text" name="prompt" placeholder="Ask something..." required autofocus>
                    <button type="submit">GENERATE AI RESPONSE</button>
                </form>
                <div class="response">
                    <strong>Current Text:</strong> \${panelState.lastResponse || "None"}
                </div>
                <hr style="border:0.5px solid #333">
                <label>Manual Binary Input:</label>
                <form action="/gemini/api/update" method="POST">
                    <input type="text" name="value" maxlength="8" value="\${panelState.value}">
                    <button type="submit" style="background:#333; color:#00ff41;">SEND MANUAL BITS</button>
                </form>
                <div class="url-box">
                    <strong>Roblox Read URL (Copy this into HTTP Transmitter):</strong><br>
                    <span id="readUrl"></span>
                </div>
            </div>
            <script>
                document.getElementById('readUrl').innerText = window.location.origin + '/gemini/read';
            </script>
        </body>
        </html>
    `);
});

app.get('/', (req, res) => res.redirect('/gemini/edit'));
app.listen(PORT, '0.0.0.0', () => console.log("GEBIDI ONLINE"));
