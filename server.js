const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;

/**
 * SECURITY NOTICE: 
 * Set these in your Render.com Environment Variables.
 */
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD; 
const MARCUS_SECRET_KEY = process.env.MARCUS_SECRET_KEY;

let BANNED_COOKIES = [];
let KICKED_COOKIES = []; // New list for the kick feature
const ADMIN_IDENTITIES = ["MARCUS", "MARCUSCABALUNA", "NATAL", "AISULTAN", "INTENS"];

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie Parser for sessions
app.use((req, res, next) => {
    const list = {};
    const rc = req.headers.cookie;
    if (rc) {
        rc.split(';').forEach(cookie => {
            const parts = cookie.split('=');
            if (parts.length > 1) {
                list[parts.shift().trim()] = decodeURI(parts.join('='));
            }
        });
    }
    req.cookies = list;
    next();
});

let state = {
    currentBinary: "00000000",
    queue: [],
    isPulsing: false,
    activeUsers: {} 
};

/**
 * Binary Mapper
 * Pin 8 (MSB) = Pulse (HIGH during letter transmission)
 * Pin 7 = Shift (1 for Upper, 0 for Lower)
 * Pins 1-6 = Character Index
 */
const getBinary = (char, pulse) => {
    let charCode = char.charCodeAt(0);
    let shift = "0";
    let val = 0;

    if (charCode >= 65 && charCode <= 90) { 
        shift = "1";
        val = charCode - 64; 
    } else if (charCode >= 97 && charCode <= 122) { 
        shift = "0";
        val = charCode - 96;
    } else if (charCode >= 48 && charCode <= 57) { 
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
            case "[": val = 41; break;
            case "]": val = 42; break;
            case "(": val = 43; break;
            case ")": val = 44; break;
            default: val = 0;
        }
    }
    const charBits = val.toString(2).padStart(6, '0');
    const pulseBit = pulse ? "1" : "0";
    return pulseBit + shift + charBits;
};

// Security and User Tracking
app.use((req, res, next) => {
    let userCookie = req.cookies.user_cookie;

    // Check if Banned or Kicked
    if (userCookie && (BANNED_COOKIES.includes(userCookie) || KICKED_COOKIES.includes(userCookie))) {
        return res.send(`<html><body style="background:black; color:red; display:flex; justify-content:center; align-items:center; height:100vh; font-family:monospace;"><h1>ACCESS TERMINATED</h1></body></html>`);
    }

    if (!userCookie) {
        userCookie = 'USER-' + Math.random().toString(36).substring(2, 9).toUpperCase();
        res.setHeader('Set-Cookie', `user_cookie=${userCookie}; Max-Age=900000; Path=/`);
    }

    state.activeUsers[userCookie] = {
        id: userCookie,
        device: (req.headers['user-agent'] || "Unknown").substring(0, 50),
        lastSeen: new Date().toLocaleTimeString()
    };
    next();
});

// ROBLOX READ ENDPOINT
app.get('/typewriter/read', (req, res) => {
    if (state.queue.length === 0 && !state.isPulsing) {
        state.currentBinary = "00000000";
    }
    
    if (state.queue.length > 0 && !state.isPulsing) {
        const nextChar = state.queue.shift();
        state.isPulsing = true;
        
        state.currentBinary = getBinary(nextChar, true);

        // FORCE RESET TO 00000000 after 50ms so pins don't overlap
        setTimeout(() => {
            state.currentBinary = "00000000"; 
            state.isPulsing = false;
        }, 50); 
    }

    res.json({
        "value": state.currentBinary,
        "next": state.currentBinary.startsWith("1")
    });
});

// WEB UI
app.get('/typewriter/edit', (req, res) => {
    const userCookie = req.cookies.user_cookie || "Unknown";
    const isMarcus = ADMIN_IDENTITIES.includes(userCookie);
    const isRandomUser = userCookie.startsWith("USER-");
    
    const usersStr = Object.values(state.activeUsers).map(u => {
        const isAdmin = ADMIN_IDENTITIES.includes(u.id);
        return `
        <li style="border-bottom: 1px solid #222; padding: 10px 0; font-size: 12px; list-style:none; display:flex; justify-content:space-between; align-items:center; gap: 10px;">
            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"><b style="color: ${isAdmin ? 'cyan' : '#f0f'}">${u.id}</b></span>
            <div style="display:flex; gap:5px;">
                ${(!isAdmin) ? `
                    <button onclick="kickUser('${u.id}')" style="background:orange; color:black; border:none; padding:3px 8px; cursor:pointer; font-weight:900;">KICK</button>
                    <button onclick="banUser('${u.id}')" style="background:red; color:white; border:none; padding:3px 8px; cursor:pointer; font-weight:900;">BAN</button>
                ` : '<span style="color:cyan; font-size:10px;">[ADMIN]</span>'}
            </div>
        </li>`;
    }).join('');

    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>TERMINAL</title>
            <style>
                body { background: #000; color: #00ff41; font-family: monospace; padding: 20px; display: flex; flex-direction: column; align-items: center; }
                .box { border: 2px solid #00ff41; padding: 20px; width: 100%; max-width: 500px; background: #000; box-shadow: 0 0 20px rgba(0,255,65,0.4); }
                textarea { background: #000; color: #fff; border: 2px solid #00ff41; padding: 15px; width: 100%; height: 160px; box-sizing: border-box; margin-bottom: 15px; outline: none; resize: none; font-size: 18px; font-weight: 900; text-transform: uppercase; }
                input { background: #000; color: #fff; border: 2px solid #00ff41; padding: 15px; width: 100%; box-sizing: border-box; margin-bottom: 15px; font-size: 18px; font-weight: 900; }
                button { background: #00ff41; color: #000; border: none; padding: 18px; width: 100%; cursor: pointer; font-weight: 900; font-size: 20px; text-transform: uppercase; }
                button:hover { background: #fff; }
                .admin-panel { margin-top: 20px; border: 2px solid red; padding: 15px; width: 100%; max-width: 500px; background: #0a0000; }
            </style>
        </head>
        <body>
            <div class="box">
                <h2>TYPEWRITER TERMINAL</h2>
                <div style="color:cyan; margin-bottom:10px; font-weight:900; text-align:center;">SESSION: ${userCookie}</div>
                ${isRandomUser ? `<input type="password" id="pass" placeholder="ENTER ACCESS CODE">` : `<input type="hidden" id="pass" value="BYPASS">`}
                <textarea id="msg" placeholder="MESSAGE..."></textarea>
                <button onclick="send()">EXECUTE</button>
                <div id="stat" style="text-align:center; margin-top:10px;">READY</div>
            </div>

            ${isMarcus ? `
            <div class="admin-panel">
                <h3 style="color:red; margin:0 0 10px 0; font-weight:900;">SECURITY FEED</h3>
                <ul style="padding:0; margin:0;">${usersStr}</ul>
            </div>
            ` : ''}

            <script>
                async function kickUser(id) {
                    await fetch('/typewriter/api/kick', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ target: id })
                    });
                    location.reload();
                }
                async function banUser(id) {
                    if(!confirm("BAN " + id + " FOREVER?")) return;
                    await fetch('/typewriter/api/ban', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ target: id })
                    });
                    location.reload();
                }
                async function send() {
                    const p = document.getElementById('pass').value;
                    const m = document.getElementById('msg').value;
                    if(!m) return;
                    const res = await fetch('/typewriter/api/type', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: m, password: p })
                    });
                    if (res.ok) {
                        document.getElementById('msg').value = "";
                        document.getElementById('stat').innerText = "SENDING " + m.length + " CHARS...";
                    }
                }
            </script>
        </body>
        </html>
    `);
});

app.post('/typewriter/api/kick', (req, res) => {
    const userCookie = req.cookies.user_cookie || "Unknown";
    if (!ADMIN_IDENTITIES.includes(userCookie)) return res.status(403).send();
    const { target } = req.body;
    if (target && !ADMIN_IDENTITIES.includes(target)) {
        KICKED_COOKIES.push(target);
        delete state.activeUsers[target];
        return res.json({ success: true });
    }
    res.status(400).send();
});

app.post('/typewriter/api/ban', (req, res) => {
    const userCookie = req.cookies.user_cookie || "Unknown";
    if (!ADMIN_IDENTITIES.includes(userCookie)) return res.status(403).send();
    const { target } = req.body;
    if (target && !ADMIN_IDENTITIES.includes(target)) {
        BANNED_COOKIES.push(target);
        delete state.activeUsers[target];
        return res.json({ success: true });
    }
    res.status(400).send();
});

app.post('/typewriter/api/type', (req, res) => {
    const { message, password } = req.body;
    const userCookie = req.cookies.user_cookie || "Unknown";
    if (!ADMIN_IDENTITIES.includes(userCookie)) {
        if (password !== ADMIN_PASSWORD) return res.status(403).send();
    }
    state.queue = [...message.split("")];
    state.isPulsing = false; 
    res.json({ success: true });
});

app.listen(PORT, '0.0.0.0');
