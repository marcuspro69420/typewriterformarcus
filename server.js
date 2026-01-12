const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;

// YOUR PASSWORD
const ADMIN_PASSWORD = "197312"; 

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let state = {
    currentBinary: "00000000",
    queue: [],
    lastMessage: "",
    isPulsing: false
};

// Standard 7-bit ASCII for Pins 1-7, 8th bit is the Next Pulse
const getBinary = (char, pulse) => {
    const charCode = char.charCodeAt(0);
    const bin = charCode.toString(2).padStart(7, '0');
    return bin + (pulse ? "1" : "0");
};

// READ: Hits this every time the Transmitter pings
app.get('/gemini/read', (req, res) => {
    // If we are currently in the middle of a 10ms pulse, return the active state
    if (state.isPulsing) {
        return res.json({
            "value": state.currentBinary,
            "next": true
        });
    }

    // If there is something in the queue, start a new pulse
    if (state.queue.length > 0) {
        const nextChar = state.queue.shift();
        state.isPulsing = true;
        
        // Immediate set to Letter + Pulse High
        state.currentBinary = getBinary(nextChar, true);

        // Crucial: Clear EVERYTHING to 0 after 10ms
        setTimeout(() => {
            state.currentBinary = "00000000"; 
            state.isPulsing = false;
        }, 10); 

        return res.json({
            "value": state.currentBinary,
            "next": true
        });
    }

    // Otherwise, dead silence (00000000)
    res.json({
        "value": "00000000",
        "next": false
    });
});

// TYPE: Internal API for the typewriter
app.post('/api/type', (req, res) => {
    const { message, password } = req.body;
    
    if (password !== ADMIN_PASSWORD) {
        return res.status(403).json({ error: "WRONG PASSWORD." });
    }

    if (!message) return res.status(400).json({ error: "Empty message" });

    state.lastMessage = message;
    state.queue = message.split("");
    state.isPulsing = false;
    
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
                button { background: #00ff41; color: #000; border: none; padding: 12px; width: 100%; cursor: pointer; font-weight: bold; font-size: 16px; }
                .status-box { background: #111; padding: 10px; border-left: 3px solid cyan; margin: 15px 0; min-height: 40px; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>GEBIDI TYPEWRITER</h1>
                <input type="password" id="pass" placeholder="PASSWORD">
                <input type="text" id="msg" placeholder="Type here..." autofocus>
                <button onclick="sendMsg()">SEND</button>
                <div class="status-box" id="status">Ready.</div>
            </div>
            <script>
                const savedPass = localStorage.getItem('gebidi_pass');
                if (savedPass) document.getElementById('pass').value = savedPass;

                async function sendMsg() {
                    const pass = document.getElementById('pass').value;
                    const msg = document.getElementById('msg').value;
                    localStorage.setItem('gebidi_pass', pass);
                    try {
                        await fetch('/api/type', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ message: msg, password: pass })
                        });
                        document.getElementById('msg').value = "";
                        document.getElementById('status').innerText = "Sent: " + msg;
                    } catch (e) { console.error(e); }
                }
                document.getElementById('msg').addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMsg(); });
            </script>
        </body>
        </html>
    `);
});

app.get('/', (req, res) => res.redirect('/gemini/edit'));
app.listen(PORT, '0.0.0.0');
