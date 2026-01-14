const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;

/**
 * SECURITY NOTICE: 
 * Passwords have been removed from plain text.
 * You MUST set 'ADMIN_PASSWORD' and 'MARCUS_SECRET_KEY' 
 * in your Render.com Environment Variables dashboard.
 */
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD; 
const MARCUS_SECRET_KEY = process.env.MARCUS_SECRET_KEY;

// THE BAN HAMMER 
let BANNED_COOKIES = [];

const ADMIN_IDENTITIES = ["MARCUS", "MARCUSCABALUNA", "NATAL", "AISULTAN", "INTENS"];

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Manual Cookie Parser
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

// Binary Mapper (Pin 8 = Pulse, Pin 7 = Shift, Pins 1-6 = Char)
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
    const nextBit = pulse ? "1" : "0";
    return nextBit + shift + charBits;
};

// Security Middleware
app.use((req, res, next) => {
    let userCookie = req.cookies.user_cookie;
    if (userCookie && BANNED_COOKIES.includes(userCookie)) {
        return res.redirect("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
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
        
        if (nextChar === "__RESET__") {
            state.currentBinary = "00000001"; 
        } else {
            state.currentBinary = getBinary(nextChar, true);
        }

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
    
    const usersStr = Object.values(state.activeUsers).map(u => {
        const isAdmin = ADMIN_IDENTITIES.includes(u.id);
        return `
        <li style="border-bottom: 1px solid #222; padding: 10px 0; font-size: 13px; list-style:none; display:flex; justify-content:space-between; align-items:center;">
            <span>
                <b style="color: ${isAdmin ? 'cyan' : '#f0f'}">${u.id}</b> 
                <span style="color:#888; font-size: 10px;"> (${u.device})</span>
            </span>
            ${(!isAdmin) ? `<button onclick="banUser('${u.id}')" style="background:red; color:white; border:none; padding:5px 10px; cursor:pointer; font-size:10px; font-weight:900;">BAN</button>` : '<span style="color:cyan; font-weight:900;">[ADMIN]</span>'}
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
                h2 { color: #00ff41; text-shadow: 0 0 10px #00ff41; letter-spacing: 3px; text-align: center; font-weight: 900; }
                textarea { 
                    background: #000; 
                    color: #fff; 
                    border: 2px solid #00ff41; 
                    padding: 15px; 
                    width: 100%; 
                    height: 160px; 
                    box-sizing: border-box; 
                    margin-bottom: 15px; 
                    outline: none; 
                    resize: none; 
                    font-size: 18px;
                    font-weight: 900;
                    box-shadow: inset 0 0 15px #00ff4144;
                    text-transform: uppercase;
                }
                input { 
                    background: #000; 
                    color: #fff; 
                    border: 2px solid #00ff41; 
                    padding: 15px; 
                    width: 100%; 
                    box-sizing: border-box; 
                    margin-bottom: 15px; 
                    font-size: 18px;
                    font-weight: 900;
                }
                button { 
                    background: #00ff41; 
                    color: #000; 
                    border: none; 
                    padding: 18px; 
                    width: 100%; 
                    cursor: pointer; 
                    font-weight: 900; 
                    font-size: 20px;
                    text-transform: uppercase;
                    transition: all 0.1s ease;
                }
                button:hover { background: #fff; box-shadow: 0 0 20px #fff; transform: scale(1.02); }
                .auth-grid { margin-top:15px; display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
                .auth-btn { background: #111; color: #444; border: 1px solid #333; padding: 10px; cursor: crosshair; font-size: 10px; font-weight: 900; }
                .auth-btn:hover { color: #00ff41; border-color: #00ff41; background: #050505; }
                #stat { font-weight: 900; text-align: center; margin-top: 20px; font-size: 16px; text-shadow: 0 0 8px #00ff41; border-top: 1px solid #111; padding-top: 10px; }
            </style>
        </head>
        <body>
            <div class="box">
                <h2>TYPEWRITER TERMINAL</h2>
                <div style="color:cyan; margin-bottom:10px; font-weight:900; text-align:center; font-size: 14px;">SESSION ID: \${userCookie}</div>
                <input type="password" id="pass" placeholder="ENTER ACCESS CODE">
                <textarea id="msg" placeholder="TYPE MESSAGE FOR ROBOT..."></textarea>
                <button onclick="send()">EXECUTE TRANSMISSION</button>
                <div id="stat">SYSTEM STATUS: READY</div>
                <div class="auth-grid">
                    <button class="auth-btn" onclick="setMarcus('MARCUS')">M1</button>
                    <button class="auth-btn" onclick="setMarcus('MARCUSCABALUNA')">M2</button>
                    <button class="auth-btn" onclick="setMarcus('NATAL')">N</button>
                    <button class="auth-btn" onclick="setMarcus('AISULTAN')">A</button>
                    <button class="auth-btn" onclick="setMarcus('INTENS')">I</button>
                </div>
            </div>
            \${isMarcus ? \`
            <div style="margin-top:25px; border:2px solid red; padding:15px; width:100%; max-width:500px; background:#0d0000; box-shadow: 0 0 20px red;">
                <h3 style="color:red; margin:0 0 10px 0; text-transform:uppercase; letter-spacing:2px; font-weight:900;">ADMIN INTEL / BAN CONTROL</h3>
                <ul style="padding:0; margin:0; font-weight:900;">\${usersStr}</ul>
            </div>\` : ''}
            <script>
                async function banUser(id) {
                    if(!confirm("CONFIRM PERMANENT TERMINATION FOR " + id + "?")) return;
                    const res = await fetch('/typewriter/api/ban', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ target: id })
                    });
                    if(res.ok) { location.reload(); }
                }
                async function setMarcus(id) {
                    const key = prompt("INPUT MASTER AUTHENTICATION KEY:");
                    if(!key) return;
                    const res = await fetch('/typewriter/api/marcus-auth', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ key, identity: id })
                    });
                    if (res.ok) { location.reload(); } else { alert("ACCESS DENIED."); }
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
                        document.getElementById('stat').innerText = "SUCCESS: TRANSMITTING RESET + " + m.length + " CHARS";
                        document.getElementById('stat').style.color = "#fff";
                    } else {
                        document.getElementById('stat').innerText = "ACCESS DENIED: INVALID CODE";
                        document.getElementById('stat').style.color = "red";
                    }
                }
            </script>
        </body>
        </html>
    `);
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

app.post('/typewriter/api/marcus-auth', (req, res) => {
    const { key, identity } = req.body;
    if (!MARCUS_SECRET_KEY) return res.status(500).send("Server missing secret key config.");
    if (key === MARCUS_SECRET_KEY && ADMIN_IDENTITIES.includes(identity)) {
        res.setHeader('Set-Cookie', `user_cookie=${identity}; Max-Age=31536000; Path=/`);
        return res.json({ success: true });
    }
    res.status(401).send();
});

app.post('/typewriter/api/type', (req, res) => {
    const { message, password } = req.body;
    if (!ADMIN_PASSWORD) return res.status(500).send("Server missing password config.");
    if (password !== ADMIN_PASSWORD) return res.status(403).send();
    
    state.queue = []; 
    state.currentBinary = "00000000";
    state.isPulsing = false; 

    state.queue = ["__RESET__", ...message.split("")];
    res.json({ success: true });
});

app.get('/', (req, res) => res.redirect('/typewriter/edit'));
app.listen(PORT, '0.0.0.0');
