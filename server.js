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
const CLOCK_ADMIN_KEY = "telecomadmin";
const COOKIE_SECRET = process.env.COOKIE_SECRET || "donotconnecttotheinternetatmaytenth"; 

const SECRET_PATHS = {
    CONTROL: process.env.PATH_CTRL || "/cx_" + Math.random().toString(36).substring(7),
    TYPE: process.env.PATH_TYPE || "/ty_" + Math.random().toString(36).substring(7),
    BAN: "/api/sys/ban_internal"
};

const SUPER_ADMIN = "MARCUS"; 
const ADMIN_IDENTITIES = ["MARCUS", "MARCUSCABALUNA", "M2", "NATAL", "AISULTAN", "INTENS"];

let state = { 
    currentBinary: "00000000", 
    queue: [], 
    isPulsing: false
};

/**
 * 🛠️ HEX BINARY MAPPING (Build Logic Style)
 * Converts a number directly to 8-bit HEX.
 * 1 -> 10000000 (if treated as a single 8-bit block)
 * Based on your rules: 1 is 1000, 2 is 0100.
 * We treat the whole byte as one reversed sequence.
 */
const convertToBuildLogicBinary = (num) => {
    const n = parseInt(num, 10);
    if (isNaN(n)) return "00000000";

    // Convert to 8-bit binary string, then reverse for Build Logic Pin order
    let bin = (n % 256).toString(2).padStart(8, '0');
    return bin.split('').reverse().join(''); 
};

/**
 * 📟 READ ENDPOINT
 */
app.get('/typewriter/read', (req, res) => {
    // If there is something in the queue and we aren't already mid-pulse
    if (state.queue.length > 0 && !state.isPulsing) {
        const item = state.queue.shift();
        state.isPulsing = true;
        
        state.currentBinary = convertToBuildLogicBinary(item);
        
        // Increased delay to 300ms to ensure the Build Logic gate catches the high signal
        setTimeout(() => { 
            state.currentBinary = "00000000"; 
            state.isPulsing = false; 
        }, 300); 
    }
    
    res.json({ "value": state.currentBinary });
});

/**
 * 🕒 CLOCK ENDPOINTS
 */
app.get('/clock/realtimephhours', (req, res) => {
    const now = new Date();
    const hourVal = new Intl.DateTimeFormat('en-US', { 
        timeZone: 'Asia/Manila', 
        hour: 'numeric', 
        hour12: false // HEX usually prefers 24h or raw numeric
    }).formatToParts(now).find(p => p.type === 'hour').value;

    state.queue.push(hourVal);
    res.json({ "value": state.currentBinary });
});

app.get('/clock/realtimephminutes', (req, res) => {
    const now = new Date();
    const minuteVal = new Intl.DateTimeFormat('en-US', { 
        timeZone: 'Asia/Manila', 
        minute: '2-digit' 
    }).formatToParts(now).find(p => p.type === 'minute').value;

    state.queue.push(minuteVal);
    res.json({ "value": state.currentBinary });
});

app.get('/clock/realtimeph', (req, res) => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', { 
        timeZone: 'Asia/Manila', 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: false 
    });
    
    const parts = formatter.formatToParts(now);
    const hh = parts.find(p => p.type === 'hour').value;
    const mm = parts.find(p => p.type === 'minute').value;

    state.queue.push(hh);
    state.queue.push(mm);
    
    res.json({ "value": state.currentBinary });
});

/**
 * 🔑 SECRET ADMIN LOGIN
 */
app.get('/clock/adminpage', (req, res) => {
    if (req.query.login !== CLOCK_ADMIN_KEY) return res.status(404).send("Not Found");

    res.send(`
        <body style="background:#000; color:#0f0; font-family:monospace; padding:20px;">
            <h2 style="border-bottom:1px solid #0f0;">TELECOM ADMIN CLOCK PANEL</h2>
            <p>HP PRODESK G2 SFF NODE STATUS: <span style="color:cyan;">ONLINE</span></p>
            <p>MODE: <span style="color:magenta;">RAW HEX</span> | TIMEZONE: <span style="color:yellow;">PH_SYNC</span></p>
            <div style="display:flex; flex-direction:column; gap:12px; max-width:400px; margin-top:20px;">
                <button onclick="fetch('/clock/realtimephhours')" style="color:orange; background:#111; border:1px solid orange; padding:10px; cursor:pointer; text-align:left;">[ SYNC HOURS ]</button>
                <button onclick="fetch('/clock/realtimephminutes')" style="color:yellow; background:#111; border:1px solid yellow; padding:10px; cursor:pointer; text-align:left;">[ SYNC MINUTES ]</button>
                <button onclick="fetch('/clock/realtimeph')" style="color:cyan; background:#111; border:1px solid cyan; padding:10px; cursor:pointer; text-align:left;">[ SYNC FULL CLOCK ]</button>
            </div>
        </body>
    `);
});

app.get('/typewriter/login', (req, res) => {
    const { pass } = req.query;
    if (pass === ADMIN_PASSWORD || pass === MARCUS_SECRET_KEY) {
        res.cookie('user_cookie', SUPER_ADMIN, { signed: true, httpOnly: true, path: '/' });
        return res.redirect('/typewriter/edit');
    }
    res.status(403).send("BYE");
});

app.get('/typewriter/edit', (req, res) => {
    const userCookie = req.signedCookies.user_cookie;
    if (!ADMIN_IDENTITIES.includes(userCookie)) return res.status(404).send("Not Found");

    res.send(`
        <body style="background:#000; color:#0f0; font-family:monospace; padding:20px;">
            <h3>FORTRESS HEX TERMINAL</h3>
            <input id="v" placeholder="Value" style="background:#111; color:#0f0; border:1px solid #0f0; padding:5px;">
            <button onclick="send()">SEND</button>
            <script>
                async function send() {
                    await fetch('${SECRET_PATHS.TYPE}', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({m: document.getElementById('v').value})
                    });
                    document.getElementById('v').value = "";
                }
            </script>
        </body>
    `);
});

app.post(SECRET_PATHS.TYPE, (req, res) => {
    if (!ADMIN_IDENTITIES.includes(req.signedCookies.user_cookie)) return res.status(403).send("ERR");
    state.queue = [...state.queue, ...req.body.m.split(" ")];
    res.json({ok:true});
});

app.get('/', (req, res) => res.redirect('/typewriter/edit'));
app.listen(PORT, '0.0.0.0');
