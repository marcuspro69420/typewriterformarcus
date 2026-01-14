const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;

/**
 * SECURITY CONFIG: 
 * Set ADMIN_PASSWORD and MARCUS_SECRET_KEY in Render Env Vars.
 */
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD; 
const MARCUS_SECRET_KEY = process.env.MARCUS_SECRET_KEY;

// Persistence lists (In-memory)
let BANNED_COOKIES = [];
let KICKED_COOKIES = [];
let BANNED_IPS = new Set();
const ADMIN_IDENTITIES = ["MARCUS", "MARCUSCABALUNA", "NATAL", "AISULTAN", "INTENS"];

// ANTI-DOS: Leaky Bucket Rate Limiting
const ipRequestCount = new Map();
const DOS_THRESHOLD = 15; // Max 15 requests per 2 seconds
const BAN_THRESHOLD = 50; // Auto-ban IP if they hit 50+ requests

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Custom Cookie Parser
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
 * Character to Binary Mapper
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
            default: val = 0;
        }
    }
    const charBits = val.toString(2).padStart(6, '0');
    const pulseBit = pulse ? "1" : "0";
    return pulseBit + shift + charBits;
};

/**
 * ANTI-DOS & SECURITY MIDDLEWARE
 */
app.use((req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userCookie = req.cookies.user_cookie;

    // 1. IP Blacklist check
    if (BANNED_IPS.has(ip)) {
        return res.status(403).send("<h1>FUCK YOU</h1><p>IP BANNED FOR BEING A PUSSY DOSER.</p>");
    }

    // 2. Cookie Blacklist check
    if (userCookie && (BANNED_COOKIES.includes(userCookie) || KICKED_COOKIES.includes(userCookie))) {
        return res.status(403).send("<h1>FUCK YOU</h1><p>ACCESS TERMINATED.</p>");
    }

    // 3. Rate Limiting Logic
    const now = Date.now();
    let logs = ipRequestCount.get(ip) || { lastReset: now, count: 0 };
    
    if (now - logs.lastReset > 2000) { 
        logs.count = 1;
        logs.lastReset = now;
    } else {
        logs.count++;
    }
    ipRequestCount.set(ip, logs);

    if (logs.count > BAN_THRESHOLD) {
        BANNED_IPS.add(ip);
        return res.status(403).send("<h1>FUCK YOU</h1><p>DOS DETECTED. IP BLACKLISTED.</p>");
    }
    if (logs.count > DOS_THRESHOLD) {
        return res.status(429).send("<h1>FUCK YOU</h1><p>SLOW DOWN OR GET BANNED.</p>");
    }

    // 4. Honeypot check
    const badPaths = ['/phpmyadmin', '/wp-admin', '/.env', '/config', '/admin'];
    if (badPaths.includes(req.path.toLowerCase())) {
        BANNED_IPS.add(ip);
        if (userCookie) BANNED_COOKIES.push(userCookie);
        return res.status(403).send("<h1>FUCK YOU</h1><p>HONEYPOT TRAP SPRUNG. BYE BYE.</p>");
    }

    if (!userCookie) {
        const newCookie = 'USER-' + Math.random().toString(36).substring(2, 9).toUpperCase();
        res.setHeader('Set-Cookie', `user_cookie=${newCookie}; Max-Age=900000; Path=/`);
    } else {
        state.activeUsers[userCookie] = {
            id: userCookie,
            lastSeen: new Date().toLocaleTimeString(),
            ip: ip
        };
    }
    next();
});

// ROBLOX READ ENDPOINT
app.get('/typewriter/read', (req, res) => {
    // Force a clear state if nothing is happening
    if (state.queue.length === 0 && !state.isPulsing) {
        state.currentBinary = "00000000";
    }
    
    if (state.queue.length > 0 && !state.isPulsing) {
        const nextChar = state.queue.shift();
        state.isPulsing = true;
        
        // Send the character bits + pulse bit (bit 1)
        state.currentBinary = getBinary(nextChar, true);

        // RESET AFTER 50ms: Force back to "00000000" to clear the text panel input
        // This ensures pins are off before the next poll, preventing overlap.
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

// MAIN UI
app.get('/typewriter/edit', (req, res) => {
    const userCookie = req.cookies.user_cookie || "Unknown";
    const isMarcus = ADMIN_IDENTITIES.includes(userCookie);
    const isRandomUser = userCookie.startsWith("USER-");
    
    const usersStr = Object.values(state.activeUsers).map(u => {
        const isAdmin = ADMIN_IDENTITIES.includes(u.id);
        const isKicked = KICKED_COOKIES.includes(u.id);
        return `
        <li style="border-bottom: 1px solid #222; padding: 10px 0; font-size: 11px; list-style:none; display:flex; justify-content:space-between; align-items:center;">
            <span style="color:${isKicked ? 'gray' : 'white'}"><b>${u.id}</b> <small>(${u.ip})</small></span>
            <div>
                ${(!isAdmin) ? `
                    <button onclick="kickUser('${u.id}')" style="background:orange; border:none; padding:2px 5px; cursor:pointer;">KICK</button>
                    <button onclick="banUser('${u.id}')" style="background:red; color:white; border:none; padding:2px 5px; cursor:pointer;">BAN</button>
                ` : '<span style="color:cyan;">[ADMIN]</span>'}
            </div>
        </li>`;
    }).join('');

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>SHIELD TERMINAL</title>
            <style>
                body { background: #000; color: #00ff41; font-family: monospace; padding: 20px; display: flex; flex-direction: column; align-items: center; }
                .box { border: 2px solid #00ff41; padding: 20px; width: 100%; max-width: 500px; box-shadow: 0 0 30px #00ff4144; }
                textarea { background: #000; color: #fff; border: 1px solid #00ff41; padding: 10px; width: 100%; height: 120px; box-sizing: border-box; font-size: 18px; margin-bottom: 10px; outline:none; }
                button { background: #00ff41; color: #000; border: none; padding: 15px; width: 100%; cursor: pointer; font-weight: 900; text-transform:uppercase; }
                input { background: #000; color: #fff; border: 1px solid #00ff41; padding: 10px; width: 100%; box-sizing: border-box; margin-bottom: 10px; }
            </style>
        </head>
        <body>
            <div class="box">
                <h2 style="text-align:center;">TERMINAL FORTRESS</h2>
                ${isRandomUser ? '<input type="password" id="pass" placeholder="KEY CODE">' : '<input type="hidden" id="pass" value="ADMIN">'}
                <textarea id="msg" placeholder="TRANSMIT..."></textarea>
                <button onclick="send()">SEND TO ROBOT</button>
            </div>
            ${isMarcus ? `<div style="margin-top:20px; border:1px solid red; padding:10px; width:100%; max-width:500px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <h4 style="color:red; margin:0;">ACTIVE FEEDS</h4>
                    <button onclick="kickAll()" style="background:red; color:white; width:auto; padding:5px 10px; font-size:10px;">KICK ALL</button>
                </div>
                <ul style="padding:0; margin:0;">${usersStr}</ul></div>` : ''}
            <script>
                async function kickUser(id) { await fetch('/typewriter/api/kick', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target: id }) }); location.reload(); }
                async function banUser(id) { await fetch('/typewriter/api/ban', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target: id }) }); location.reload(); }
                async function kickAll() { if(confirm("KICK EVERYONE?")) { await fetch('/typewriter/api/kick-all', { method: 'POST' }); location.reload(); } }
                async function send() {
                    const res = await fetch('/typewriter/api/type', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: document.getElementById('msg').value, password: document.getElementById('pass').value })
                    });
                    if(res.ok) document.getElementById('msg').value = "";
                    else alert("ACCESS REJECTED");
                }
            </script>
        </body>
        </html>
    `);
});

// PROTECTED API ENDPOINTS
app.post('/typewriter/api/type', (req, res) => {
    const { message, password } = req.body;
    const userCookie = req.cookies.user_cookie || "Unknown";
    if (!ADMIN_IDENTITIES.includes(userCookie) && password !== ADMIN_PASSWORD) return res.status(403).send();
    state.queue = [...message.split("")];
    state.isPulsing = false; 
    res.json({ success: true });
});

app.post('/typewriter/api/kick', (req, res) => {
    const userCookie = req.cookies.user_cookie || "Unknown";
    if (!ADMIN_IDENTITIES.includes(userCookie)) return res.status(403).send();
    const { target } = req.body;
    if (target) KICKED_COOKIES.push(target);
    res.json({ success: true });
});

app.post('/typewriter/api/kick-all', (req, res) => {
    const userCookie = req.cookies.user_cookie || "Unknown";
    if (!ADMIN_IDENTITIES.includes(userCookie)) return res.status(403).send();
    Object.keys(state.activeUsers).forEach(id => {
        if (!ADMIN_IDENTITIES.includes(id)) KICKED_COOKIES.push(id);
    });
    state.activeUsers = {};
    res.json({ success: true });
});

app.post('/typewriter/api/ban', (req, res) => {
    const userCookie = req.cookies.user_cookie || "Unknown";
    if (!ADMIN_IDENTITIES.includes(userCookie)) return res.status(403).send();
    const { target } = req.body;
    if (target) BANNED_COOKIES.push(target);
    res.json({ success: true });
});

app.listen(PORT, '0.0.0.0');
