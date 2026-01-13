const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;

// YOUR PASSWORD
const ADMIN_PASSWORD = "2015"; 

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let state = {
    currentBinary: "00000000",
    queue: [],
    lastSentChar: null,
    isWaitingForReset: false,
    shouldResetBoard: false // New flag for the "Received POST" trigger
};

/**
 * BUILD LOGIC WIKI MAPPING (Right to Left):
 * Bits 1-6: Character (0-63)
 * Bit 7: Shift (0 = Lower, 1 = Upper)
 * Bit 8: Next Pulse / Reset Pulse
 */
const getBinary = (char, pulse) => {
    let charCode = char.charCodeAt(0);
    let shift = "0";
    let val = 0;

    // Determine Shift (Bit 7) and Value (Bits 1-6)
    if (charCode >= 65 && charCode <= 90) { // Uppercase A-Z
        shift = "1";
        val = charCode - 64; 
    } else if (charCode >= 97 && charCode <= 122) { // Lowercase a-z
        shift = "0";
        val = charCode - 96;
    } else if (charCode >= 48 && charCode <= 57) { // Numbers 0-9
        val = charCode + 4; 
    } else if (char === " ") {
        val = 0;
    } else {
        // Mapping for symbols based on common Build Logic offsets
        switch (char) {
            case ".": val = 37; break;
            case ",": val = 38; break;
            case "!": val = 39; break;
            case "?": val = 40; break;
            case ":": val = 41; break;
            case "-": val = 42; break;
            case "'": val = 43; break;
            case '"': val = 44; break;
            default: val = 0; // Fallback to space for unknown chars
        }
    }

    const charBits = val.toString(2).padStart(6, '0');
    const nextBit = pulse ? "1" : "0";
    
    return nextBit + shift + charBits;
};

// READ: The Roblox Transmitter hits this
app.get('/typewriter/read', (req, res) => {
    // If the board needs a reset (New message started)
    if (state.shouldResetBoard) {
        state.shouldResetBoard = false;
        state.isWaitingForReset = true; // Force a 00000000 after the reset pulse
        // Sending 00000000 with Bit 8 high triggers the "Reset" on most Text Panel setups
        return res.json({ "value": "10000000", "next": true });
    }

    // If the last request was a letter or reset, we MUST return 0 now to finish the pulse
    if (state.isWaitingForReset) {
        state.isWaitingForReset = false;
        return res.json({ "value": "00000000", "next": false });
    }

    // If there's a letter in the queue, send it and mark that we need a reset next
    if (state.queue.length > 0) {
        const nextChar = state.queue.shift();
        state.isWaitingForReset = true; // Next request will be forced to 0
        
        const binary = getBinary(nextChar, true);
        return res.json({ "value": binary, "next": true });
    }

    // Default idle
    res.json({ "value": "00000000", "next": false });
});

// WEB INTERFACE
app.get('/typewriter/edit', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>TYPEWRITER | TERMINAL</title>
            <style>
                body { background: #000; color: #0f0; font-family: 'Courier New', monospace; padding: 20px; display: flex; justify-content: center; }
                .box { border: 2px solid #0f0; padding: 20px; width: 100%; max-width: 450px; box-shadow: 0 0 20px #0f0; }
                input { background: #000; color: #0f0; border: 1px solid #0f0; padding: 10px; width: 100%; box-sizing: border-box; margin-bottom: 10px; outline: none; }
                button { background: #0f0; color: #000; border: none; padding: 10px; width: 100%; cursor: pointer; font-weight: bold; }
                .status { margin-top: 15px; font-size: 12px; border-top: 1px solid #0f0; padding-top: 10px; }
            </style>
        </head>
        <body>
            <div class="box">
                <h2>TYPEWRITER OS</h2>
                <input type="password" id="pass" placeholder="PASSWORD">
                <input type="text" id="msg" placeholder="Type message..." autofocus>
                <button onclick="send()">SEND TO BUILD LOGIC</button>
                <div class="status" id="stat">STATUS: READY</div>
            </div>
            <script>
                const saved = localStorage.getItem('tp_pass');
                if (saved) document.getElementById('pass').value = saved;

                async function send() {
                    const p = document.getElementById('pass').value;
                    const m = document.getElementById('msg').value;
                    localStorage.setItem('tp_pass', p);
                    
                    const res = await fetch('/typewriter/api/type', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: m, password: p })
                    });
                    
                    if (res.ok) {
                        document.getElementById('msg').value = "";
                        document.getElementById('stat').innerText = "TRANSMITTING: " + m;
                    }
                }
                document.getElementById('msg').addEventListener('keypress', (e) => { if(e.key === 'Enter') send(); });
            </script>
        </body>
        </html>
    `);
});

app.post('/typewriter/api/type', (req, res) => {
    if (req.body.password !== ADMIN_PASSWORD) return res.status(403).send("NO");
    state.queue = req.body.message.split("");
    state.isWaitingForReset = false;
    state.shouldResetBoard = true; // Trigger the board clear before typing
    res.json({ success: true });
});

app.get('/', (req, res) => res.redirect('/typewriter/edit'));
app.listen(PORT, '0.0.0.0');
