const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;

// PASSWORDS
const ADMIN_PASSWORD = "2015"; 
const MARCUS_SECRET_KEY = "BUILDLOGICISFUN";

// YOUR TRUSTED DEVICES (Strictly for Marcus identities)
const TRUSTED_DEVICES = ["iPhone", "ProDesk", "Surface"]; 

// THE BAN HAMMER - IDs you provided
const BANNED_COOKIES = [
    "USER-CUY36L1", "USER-KONJQ7K", "USER-71BIHAM", "USER-W02YA6Q", 
    "USER-25B069J", "USER-HUSXBGJ", "USER-VIVY7LH", "USER-35PTBVZ", 
    "USER-9TWZ2HW", "USER-225NO4W", "USER-AU3X8KS", "USER-O7X5WDB", 
    "USER-XJ8QO87", "USER-JA6T9WE", "USER-N9PM9AZ", "USER-AOYEDIZ"
];

// LIST OF ADMIN IDENTITIES
const ADMIN_IDENTITIES = ["MARCUS", "MARCUSCABALUNA", "NATAL", "AISULTAN", "INTENS"];

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple Manual Cookie Parser Middleware
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
            default: val = 0;
        }
    }
    const charBits = val.toString(2).padStart(6, '0');
    const nextBit = pulse ? "1" : "0";
    return nextBit + shift + charBits;
};

// Middleware to handle identity, BANS, and DEVICE KICKS
app.use((req, res, next) => {
    let userCookie = req.cookies.user_cookie;
    const userAgent = req.headers['user-agent'] || "Unknown Device";

    // 1. Check if they are banned
    if (userCookie && BANNED_COOKIES.includes(userCookie)) {
        return res.redirect("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    }

    // 2. DEVICE KICK: Strictly enforce device for Marcus identities
    if (userCookie === "MARCUS" || userCookie === "MARCUSCABALUNA") {
        const isTrusted = TRUSTED_DEVICES.some(device => userAgent.includes(device));
        if (!isTrusted) {
            console.log(`SEC VIOLATION: ${userCookie} from unauthorized device: ${userAgent}`);
            return res.redirect("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
        }
    }
    
    // Note: NATAL, AISULTAN, and INTENS do NOT have device restrictions here yet.

    if (!userCookie) {
        userCookie = 'USER-' + Math.random().toString(36).substring(2, 9).toUpperCase();
        res.setHeader('Set-Cookie', `user_cookie=${userCookie}; Max-Age=900000; Path=/`);
    }
    
    state.activeUsers[userCookie] = {
        id: userCookie,
        device: userAgent.substring(0, 70), 
        lastSeen: new Date().toLocaleTimeString()
    };
    
    next();
});

// READ: For Roblox
app.get('/typewriter/read', (req, res) => {
    if (state.isPulsing) {
        state.isPulsing = false;
        return res.json({ "value": "00000000", "next": false });
    }
    if (state.queue.length > 0) {
        const nextChar = state.queue.shift();
        const binary = getBinary(nextChar, true);
        state.isPulsing = true;
        return res.json({ "value": binary, "next": true });
    }
    res.json({ "value": "00000000", "next": false });
});

// WEB INTERFACE
app.get('/typewriter/edit', (req, res) => {
    const userCookie = req.cookies.user_cookie || "Unknown";
    const isMarcus = ADMIN_IDENTITIES.includes(userCookie);
    
    const usersStr = Object.values(state.activeUsers).map(u => {
        const isBanned = BANNED_COOKIES.includes(u.id);
        const isAdmin = ADMIN_IDENTITIES.includes(u.id);
        return `
            <li style="border-bottom: 1px solid #222; margin-bottom: 5px; padding-bottom: 5px; list-style:none;">
                <span style="color: ${isAdmin ? 'cyan' : (isBanned ? 'red' : '#f0f')}">${u.id} ${isBanned ? '[BANNED]' : (isAdmin ? '[ADMIN]' : '')}</span>
                <br><span style="font-size: 10px; color: #666;">DEV: ${u.device}</span>
                <br><span style="font-size: 9px; color: #444;">LAST: ${u.lastSeen}</span>
            </li>`;
    }).join('');

    const userListHtml = isMarcus 
        ? `<div class="admin-panel">
            <h3 style="color:red; font-size:12px;">CABALUNA NETWORK MONITOR</h3>
            <ul style="max-height: 250px; overflow-y: auto; padding:0;">${usersStr}</ul>
           </div>` 
        : "";

    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>TYPEWRITER | TERMINAL</title>
            <style>
                body { background: #000; color: #0f0; font-family: 'Courier New', monospace; padding: 20px; display: flex; flex-direction: column; align-items: center; }
                .box { border: 2px solid #0f0; padding: 20px; width: 100%; max-width: 450px; box-shadow: 0 0 20px #0f0; background: #000; }
                input { background: #000; color: #0f0; border: 1px solid #0f0; padding: 10px; width: 100%; box-sizing: border-box; margin-bottom: 10px; outline: none; }
                button { background: #0f0; color: #000; border: none; padding: 10px; width: 100%; cursor: pointer; font-weight: bold; }
                .status { margin-top: 15px; font-size: 12px; border-top: 1px solid #0f0; padding-top: 10px; }
                .cookie-info { margin-bottom: 10px; font-size: 14px; color: cyan; }
                .admin-panel { margin-top: 20px; border: 1px dashed red; padding: 10px; width: 100%; max-width: 450px; background: #050000; }
                .auth-grid { margin-top:10px; display: grid; grid-template-columns: repeat(5, 1fr); gap: 5px; }
                .auth-btn { background: #111; color: #222; font-size: 8px; border: none; padding: 5px; cursor: crosshair; }
            </style>
        </head>
        <body>
            <div class="box">
                <h2>TYPEWRITER OS</h2>
                <div class="cookie-info">IDENTITY: <span id="id-display">${userCookie}</span></div>
                <input type="password" id="pass" placeholder="PASSWORD">
                <input type="text" id="msg" placeholder="Type message..." autofocus>
                <button onclick="send()">SEND TO BUILD LOGIC</button>
                <div class="status" id="stat">STATUS: READY</div>
                
                <div class="auth-grid">
                    <button class="auth-btn" onclick="setMarcus('MARCUS')">M1</button>
                    <button class="auth-btn" onclick="setMarcus('MARCUSCABALUNA')">M2</button>
                    <button class="auth-btn" onclick="setMarcus('NATAL')">N</button>
                    <button class="auth-btn" onclick="setMarcus('AISULTAN')">A</button>
                    <button class="auth-btn" onclick="setMarcus('INTENS')">I</button>
                </div>
            </div>

            ${userListHtml}

            <script>
                const saved = localStorage.getItem('tp_pass');
                if (saved) document.getElementById('pass').value = saved;

                async function setMarcus(identity) {
                    const key = prompt("Enter Marcus Authorization Key:");
                    const res = await fetch('/typewriter/api/marcus-auth', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ key: key, identity: identity })
                    });
                    if (res.ok) { location.reload(); } 
                    else { window.location.href = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"; }
                }

                async function send() {
                    const p = document.getElementById('pass').value;
                    const m = document.getElementById('msg').value;
                    const res = await fetch('/typewriter/api/type', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: m, password: p })
                    });
                    if (res.status === 403) {
                        window.location.href = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
                    } else if (res.ok) {
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

app.post('/typewriter/api/marcus-auth', (req, res) => {
    const { key, identity } = req.body;
    const userAgent = req.headers['user-agent'] || "";

    if (key === MARCUS_SECRET_KEY) {
        // Enforce device strictly for Marcus IDs
        if (identity === "MARCUS" || identity === "MARCUSCABALUNA") {
            const isTrusted = TRUSTED_DEVICES.some(device => userAgent.includes(device));
            if (!isTrusted) return res.status(401).json({ success: false });
        }

        if (ADMIN_IDENTITIES.includes(identity)) {
            res.setHeader('Set-Cookie', `user_cookie=${identity}; Max-Age=31536000; Path=/`);
            return res.json({ success: true });
        }
    }
    res.status(401).json({ success: false });
});

app.post('/typewriter/api/type', (req, res) => {
    const { message, password } = req.body;
    const userCookie = req.cookies.user_cookie;
    const userAgent = req.headers['user-agent'] || "";

    if (BANNED_COOKIES.includes(userCookie)) return res.status(403).json({ redirect: true });

    if (userCookie === "MARCUS" || userCookie === "MARCUSCABALUNA") {
        const isTrusted = TRUSTED_DEVICES.some(device => userAgent.includes(device));
        if (!isTrusted) return res.status(403).json({ redirect: true });
    }

    if (!password || password !== ADMIN_PASSWORD) return res.status(403).json({ redirect: true });
    
    state.queue = message.split("");
    state.isPulsing = false;
    res.json({ success: true });
});

app.get('/', (req, res) => res.redirect('/typewriter/edit'));
app.listen(PORT, '0.0.0.0');
