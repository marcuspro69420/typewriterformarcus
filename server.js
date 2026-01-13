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
    isPulsing: false
};

/**
 * BUILD LOGIC WIKI MAPPING (Right to Left):
 * Bits 1-6: Character (0-63)
 * Bit 7: Shift (0 = Lower, 1 = Upper)
 * Bit 8: Next Pulse
 */
const getBinary = (char, pulse) => {
    let charCode = char.charCodeAt(0);
    let shift = "0";
    let val = 0;

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
        switch (char) {
            case "!": val = 33; break;
            case ".": val = 34; break;
            case "?": val = 35; break;
            case ",": val = 36; break;
            case ":": val = 37; break;
            case "-": val = 38; break;
            case "'": val = 39; break;
            case '"': val = 40; break;
            default: val = 0;
        }
    }

    const charBits = val.toString(2).padStart(6, '0');
    const nextBit = pulse ? "1" : "0";
    
    return nextBit + shift + charBits;
};

// READ: The Roblox Transmitter hits this
app.get('/typewriter/read', (req, res) => {
    if (state.isPulsing) {
        return res.json({ "value": "00000000", "next": false });
    }

    if (state.queue.length > 0) {
        const nextChar = state.queue.shift();
        const binary = getBinary(nextChar, true);
        
        state.isPulsing = true;
        setTimeout(() => {
            state.isPulsing = false;
        }, 150); 

        return res.json({ "value": binary, "next": true });
    }

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
                    
                    const res = await fetch('/typewriter/api/type', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: m, password: p })
                    });
                    
                    if (res.status === 302 || res.status === 403) {
                        window.location.href = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
                        return;
                    }

                    if (res.ok) {
                        localStorage.setItem('tp_pass', p);
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
    const { message, password } = req.body;
    if (!password || password !== ADMIN_PASSWORD) {
        // We return 403 which the frontend script now catches to redirect to Rickroll
        return res.status(403).json({ redirect: true });
    }
    state.queue = message.split("");
    state.isPulsing = false;
    res.json({ success: true });
});

app.get('/', (req, res) => res.redirect('/typewriter/edit'));
app.listen(PORT, '0.0.0.0');
