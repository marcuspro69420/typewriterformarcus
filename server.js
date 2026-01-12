const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;

// YOUR PASSWORD
const ADMIN_PASSWORD = "197312"; 

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let state = {
    currentBinary: "00000000",
    nextPulse: false,
    queue: [],
    lastMessage: ""
};

const charToBinary = (char) => {
    return char.charCodeAt(0).toString(2).padStart(8, '0');
};

// READ: Hits this every 0.5s from Roblox
app.get('/gemini/read', (req, res) => {
    if (state.queue.length > 0) {
        const nextChar = state.queue.shift();
        state.currentBinary = charToBinary(nextChar);
        state.nextPulse = true;
    } else {
        state.nextPulse = false;
    }

    res.json({
        "value": state.currentBinary,
        "next": state.nextPulse
    });
});

// TYPE: Internal API for the typewriter
app.post('/api/type', (req, res) => {
    const { message, password } = req.body;
    
    if (password !== ADMIN_PASSWORD) {
        return res.status(403).json({ error: "WRONG PASSWORD. MARCUS IS SLEEPING." });
    }

    if (!message) return res.status(400).json({ error: "Empty message" });

    state.lastMessage = message;
    state.queue = message.split("");
    
    console.log("Queued message:", message);
    res.json({ success: true, queued: message.length });
});

app.get('/gemini/edit', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>GEBIDI | TYPEWRITER</title>
            <style>
                body { background: #050505; color: #00ff41; font-family: monospace; padding: 20px; display: flex; justify-content: center; }
                .container { border: 1px solid #00ff41; padding: 20px; width: 100%; max-width: 500px; box-shadow: 0 0 15px #00ff41; }
                input { background: #111; color: #00ff41; border: 1px solid #00ff41; padding: 12px; width: 100%; box-sizing: border-box; margin-bottom: 10px; font-size: 16px; }
                button { background: #00ff41; color: #000; border: none; padding: 12px; width: 100%; cursor: pointer; font-weight: bold; font-size: 16px; transition: 0.2s; }
                button:active { background: #008f25; }
                .status-box { background: #111; padding: 10px; border-left: 3px solid cyan; margin: 15px 0; min-height: 40px; }
                h1 { margin-top: 0; font-size: 1.5rem; text-align: center; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>GEBIDI TYPEWRITER</h1>
                
                <input type="password" id="pass" placeholder="ENTER ADMIN PASS">
                <input type="text" id="msg" placeholder="Type message to Roblox..." autofocus>
                <button onclick="sendMsg()">SEND TO DISPLAY</button>

                <div class="status-box" id="status">Ready.</div>
            </div>

            <script>
                async function sendMsg() {
                    const pass = document.getElementById('pass').value;
                    const msg = document.getElementById('msg').value;
                    const status = document.getElementById('status');

                    status.innerText = "Sending...";

                    try {
                        const response = await fetch('/api/type', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ message: msg, password: pass })
                        });
                        
                        const data = await response.json();
                        
                        if (data.success) {
                            status.innerText = "Queued: " + msg;
                            document.getElementById('msg').value = ""; // Clear message box
                            document.getElementById('msg').focus();
                        } else {
                            status.innerText = "ERROR: " + data.error;
                        }
                    } catch (e) {
                        status.innerText = "Connection Error.";
                    }
                }

                // Press Enter to send
                document.getElementById('msg').addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') sendMsg();
                });
            </script>
        </body>
        </html>
    `);
});

app.get('/', (req, res) => res.redirect('/gemini/edit'));
app.listen(PORT, '0.0.0.0', () => console.log("TYPEWRITER ONLINE"));
