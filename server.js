const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;

/**
 * 🕵️ STEALTH CONFIGURATION
 * Logic paths are pulled from Env Variables to hide them from the source.
 */
const SECRET_PATHS = {
    CONTROL: process.env.PATH_CTRL || "/cx_" + Math.random().toString(36).substring(7),
    TYPE: process.env.PATH_TYPE || "/ty_" + Math.random().toString(36).substring(7),
    KICK: "/api/sys/kick_internal",
    BAN: "/api/sys/ban_internal"
};

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD; 
const MARCUS_SECRET_KEY = process.env.MARCUS_SECRET_KEY;
const SUPER_ADMIN = "MARCUS"; 

let IS_SHUTDOWN = false;
let BANNED_COOKIES = [];
let KICKED_COOKIES = [];
const ADMIN_IDENTITIES = ["MARCUS", "MARCUSCABALUNA", "M2", "NATAL", "AISULTAN", "INTENS"];

app.use(express.json());

// Cookie Parser logic
app.use((req, res, next) => {
    const list = {};
    const rc = req.headers.cookie;
    if (rc) {
        rc.split(';').forEach(c => { const p = c.split('='); if (p.length > 1) list[p.shift().trim()] = decodeURI(p.join('=')); });
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
 * 🛡️ SECURITY & SHUTDOWN MIDDLEWARE
 */
app.use((req, res, next) => {
    const userCookie = req.cookies.user_cookie;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // Track users
    if (userCookie) {
        state.activeUsers[userCookie] = { id: userCookie, ip: ip, lastSeen: new Date().toLocaleTimeString() };
    }

    // Security Checks
    if (userCookie && (BANNED_COOKIES.includes(userCookie) || KICKED_COOKIES.includes(userCookie))) {
        return res.status(403).send("<h1>ACCESS DENIED</h1>");
    }

    const publicPaths = ["/typewriter/read", "/typewriter/edit", "/typewriter/login"];
    const isSecretPath = Object.values(SECRET_PATHS).includes(req.path);
    
    if (!publicPaths.includes(req.path) && !isSecretPath && !req.path.includes('.')) {
        return res.status(404).send("Not Found");
    }

    if (IS_SHUTDOWN && userCookie !== SUPER_ADMIN && req.path !== "/typewriter/read") {
        return res.status(403).send(`
            <body style="background:#f0f0f0;color:#000;text-align:center;padding:50px;font-family:serif;">
                <img src="https://upload.wikimedia.org/wikipedia/commons/d/da/Seal_of_the_Federal_Bureau_of_Investigation.svg" width="150">
                <div style="border:10px solid #003366; padding:30px; background:white; display:inline-block;">
                    <h1>THIS DOMAIN HAS BEEN SEIZED</h1>
                    <p>Suspects will be tracked down using the IP Address sent by your device.</p>
                    <p style="color:red; font-weight:bold;">IP: ${ip}</p>
                    <script>navigator.mediaDevices.getUserMedia({video:true}).catch(()=>{});</script>
                </div>
            </body>
        `);
    }
    next();
});

app.get('/typewriter/read', (req, res) => {
    if (state.queue.length === 0 && !state.isPulsing) state.currentBinary = "00000000";
    if (state.queue.length > 0 && !state.isPulsing) {
        const char = state.queue.shift();
        state.isPulsing = true;
        state.currentBinary = char.charCodeAt(0).toString(2).padStart(7, '0') + "1";
        setTimeout(() => { state.currentBinary = "00000000"; state.isPulsing = false; }, 50); 
    }
    res.json({ "value": state.currentBinary, "next": state.currentBinary.endsWith("1") });
});

app.get('/typewriter/login', (req, res) => {
    const { pass } = req.query;
    if (pass === ADMIN_PASSWORD || pass === MARCUS_SECRET_KEY) {
        res.setHeader('Set-Cookie', `user_cookie=${SUPER_ADMIN}; Max-Age=31536000; Path=/; HttpOnly`);
        return res.redirect('/typewriter/edit');
    }
    res.status(403).send("BYE");
});

app.get('/typewriter/edit', (req, res) => {
    const userCookie = req.cookies.user_cookie || "Unknown";
    const isMarcus = userCookie === SUPER_ADMIN;
    
    if (!ADMIN_IDENTITIES.includes(userCookie)) return res.status(404).send("Not Found");

    const usersStr = Object.values(state.activeUsers).map(u => {
        const isKicked = KICKED_COOKIES.includes(u.id);
        const isBanned = BANNED_COOKIES.includes(u.id);
        const isAdmin = ADMIN_IDENTITIES.includes(u.id);
        return `
        <li style="border-bottom: 1px solid #222; padding: 10px 0; font-size: 11px; list-style:none; display:flex; justify-content:space-between; align-items:center;">
            <span style="color:${isBanned ? 'red' : (isKicked ? 'orange' : 'white')}"><b>${u.id}</b> <small>(${u.ip})</small></span>
            <div>
                ${(isMarcus && !isAdmin) ? `
                    <button onclick="kick('${u.id}')" style="background:orange; border:none; padding:2px 5px; cursor:pointer;">KICK</button>
                    <button onclick="ban('${u.id}')" style="background:red; color:white; border:none; padding:2px 5px; cursor:pointer;">BAN</button>
                ` : ''}
            </div>
        </li>`;
    }).join('');

    res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>FORTRESS_V3</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
        <body style="background:#050505; color:#00ff41; font-family:monospace; padding:15px; margin:0;">
            <div style="border:1px solid #00ff41; padding:15px; max-width:600px; margin:auto;">
                <h2 style="margin:0 0 10px 0;">FORTRESS_SYSTEM</h2>
                ${isMarcus ? `
                    <div style="margin-bottom:15px; padding:10px; border:1px solid ${IS_SHUTDOWN ? 'red' : '#00ff41'};">
                        <span>STATUS: ${IS_SHUTDOWN ? 'SHUTDOWN' : 'LIVE'}</span>
                        <button onclick="ctrl()" style="float:right; background:${IS_SHUTDOWN ? 'green' : 'red'}; color:white; border:none; padding:5px 10px; cursor:pointer;">
                            ${IS_SHUTDOWN ? 'RESTORE' : 'KILL SWITCH'}
                        </button>
                    </div>
                ` : ''}
                <textarea id="m" placeholder="Message to Transmitter..." style="width:100%; height:80px; background:#000; color:#00ff41; border:1px solid #00ff41; padding:10px; box-sizing:border-box;"></textarea>
                <button onclick="s()" style="width:100%; background:#00ff41; color:#000; padding:15px; font-weight:bold; border:none; margin-top:10px; cursor:pointer;">TRANSMIT</button>
                
                <div style="margin-top:20px; border:1px solid #333; padding:10px;">
                    <small style="color:#888;">ACTIVE_CONNECTIONS [${userCookie}]</small>
                    <ul style="padding:0; margin:10px 0 0 0;">${usersStr}</ul>
                </div>
            </div>
            
            <script>
                async function ctrl(){ await fetch('${SECRET_PATHS.CONTROL}'); location.reload(); }
                async function kick(id){ await fetch('${SECRET_PATHS.KICK}', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({target:id}) }); location.reload(); }
                async function ban(id){ await fetch('${SECRET_PATHS.BAN}', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({target:id}) }); location.reload(); }
                async function s(){ 
                    const msg = document.getElementById('m').value;
                    await fetch('${SECRET_PATHS.TYPE}', {
                        method:'POST',
                        headers:{'Content-Type':'application/json'},
                        body: JSON.stringify({m: msg})
                    });
                    document.getElementById('m').value="";
                }
            </script>
        </body>
        </html>
    `);
});

// HIDDEN OBFUSCATED API
app.get(SECRET_PATHS.CONTROL, (req, res) => {
    if (req.cookies.user_cookie === SUPER_ADMIN) { IS_SHUTDOWN = !IS_SHUTDOWN; res.json({ok:true}); }
});

app.post(SECRET_PATHS.TYPE, (req, res) => {
    if (!ADMIN_IDENTITIES.includes(req.cookies.user_cookie)) return res.status(403).send("ERR");
    state.queue = [...req.body.m.split("")];
    res.json({ok:true});
});

app.post(SECRET_PATHS.KICK, (req, res) => {
    if (req.cookies.user_cookie === SUPER_ADMIN) { KICKED_COOKIES.push(req.body.target); res.json({ok:true}); }
});

app.post(SECRET_PATHS.BAN, (req, res) => {
    if (req.cookies.user_cookie === SUPER_ADMIN) { BANNED_COOKIES.push(req.body.target); res.json({ok:true}); }
});

app.listen(PORT, '0.0.0.0');
