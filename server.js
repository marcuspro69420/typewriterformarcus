const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;

/**
 * 🕵️ STEALTH CONFIGURATION
 * Internal logic paths are pulled from Env Variables.
 * The public-facing UI paths are back to the "classic" versions.
 */
const SECRET_PATHS = {
    CONTROL: process.env.PATH_CTRL || "/cx_" + Math.random().toString(36).substring(7),
    TYPE: process.env.PATH_TYPE || "/ty_" + Math.random().toString(36).substring(7)
};

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD; 
const MARCUS_SECRET_KEY = process.env.MARCUS_SECRET_KEY;
const SUPER_ADMIN = "MARCUS"; 

let IS_SHUTDOWN = false;
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

let state = { currentBinary: "00000000", queue: [], isPulsing: false };

/**
 * 🛡️ THE VOID MIDDLEWARE
 */
app.use((req, res, next) => {
    const userCookie = req.cookies.user_cookie;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // Allowed Paths
    const publicPaths = ["/typewriter/read", "/typewriter/edit", "/typewriter/login"];
    const isSecretPath = Object.values(SECRET_PATHS).includes(req.path);
    
    if (!publicPaths.includes(req.path) && !isSecretPath && !req.path.includes('.')) {
        return res.status(404).send("Not Found");
    }

    // Seizure Logic (Exempts /read for the Roblox Transmitter)
    if (IS_SHUTDOWN && userCookie !== SUPER_ADMIN && req.path !== "/typewriter/read") {
        return res.status(403).send(`
            <body style="background:#000;color:white;text-align:center;padding:50px;font-family:serif;">
                <img src="https://upload.wikimedia.org/wikipedia/commons/d/da/Seal_of_the_Federal_Bureau_of_Investigation.svg" width="150">
                <h1>FEDERAL DOMAIN SEIZURE</h1>
                <p>This site has been seized by the FBI. Suspect tracking in progress.</p>
                <p>IP logged: ${ip}</p>
                <script>navigator.mediaDevices.getUserMedia({video:true}).catch(()=>{});</script>
            </body>
        `);
    }
    next();
});

// 1. TRANSMITTER (Roblox) - BACK TO CLASSIC PATH
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

// 2. LOGIN GATEWAY
app.get('/typewriter/login', (req, res) => {
    const { pass } = req.query;
    if (pass === ADMIN_PASSWORD || pass === MARCUS_SECRET_KEY) {
        res.setHeader('Set-Cookie', `user_cookie=${SUPER_ADMIN}; Max-Age=31536000; Path=/; HttpOnly`);
        return res.redirect('/typewriter/edit');
    }
    res.status(403).send("BYE");
});

// 3. CORE DASHBOARD - BACK TO CLASSIC PATH
app.get('/typewriter/edit', (req, res) => {
    const userCookie = req.cookies.user_cookie || "Unknown";
    const isMarcus = userCookie === SUPER_ADMIN;
    
    if (!ADMIN_IDENTITIES.includes(userCookie)) {
        return res.status(404).send("Not Found");
    }

    res.send(`
        <body style="background:#050505;color:#00ff41;font-family:monospace;padding:20px;">
            <h3>DASHBOARD_V3 [${userCookie}]</h3>
            ${isMarcus ? `<button onclick="ctrl()" style="background:red;color:white;border:none;padding:10px;">${IS_SHUTDOWN ? 'RESTORE' : 'KILL SWITCH'}</button>` : ''}
            <hr style="border-color:#222;">
            <textarea id="m" style="width:100%;height:100px;background:#000;color:#00ff41;border:1px solid #00ff41;"></textarea>
            <button onclick="s()" style="width:100%;background:#00ff41;color:#000;padding:15px;font-weight:bold;border:none;margin-top:10px;">TRANSMIT</button>
            
            <script>
                async function ctrl(){ await fetch('${SECRET_PATHS.CONTROL}'); location.reload(); }
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
    `);
});

// 4. HIDDEN OBFUSCATED API
app.get(SECRET_PATHS.CONTROL, (req, res) => {
    if (req.cookies.user_cookie === SUPER_ADMIN) { IS_SHUTDOWN = !IS_SHUTDOWN; res.json({ok:true}); }
});

app.post(SECRET_PATHS.TYPE, (req, res) => {
    if (!ADMIN_IDENTITIES.includes(req.cookies.user_cookie)) return res.status(403).send("ERR");
    state.queue = [...req.body.m.split("")];
    res.json({ok:true});
});

app.listen(PORT, '0.0.0.0');
