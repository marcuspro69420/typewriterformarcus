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
 * 🛠️ BCD BINARY MAPPING (Build Logic Style)
 * 1 -> 1000, 2 -> 0100, 3 -> 1100, etc.
 * F is the last number because of the hex display BCD layout.
 */
const convertToBuildLogicBinary = (num) => {
    const n = parseInt(num, 10);
    if (isNaN(n)) return "00000000";

    const tens = Math.floor(n / 10);
    const ones = n % 10;

    const toBCD4Bit = (digit) => {
        let bin = (digit % 16).toString(2).padStart(4, '0');
        return bin.split('').reverse().join(''); // Pin 1 is the first bit
    };

    return toBCD4Bit(tens) + toBCD4Bit(ones);
};

/**
 * 📟 READ ENDPOINT
 */
app.get('/typewriter/read', (req, res) => {
    if (state.queue.length > 0 && !state.isPulsing) {
        const item = state.queue.shift();
        state.isPulsing = true;
        
        state.currentBinary = convertToBuildLogicBinary(item);
        
        setTimeout(() => { 
            state.currentBinary = "00000000"; 
            state.isPulsing = false; 
        }, 150); 
    }
    
    res.json({ "value": state.currentBinary });
});

/**
 * 🕒 CLOCK ENDPOINTS
 */
app.get('/clock/realtimephhours', (req, res) => {
    const now = new Date();
    // Get numeric hour (1-12) for PH time
    const hourVal = new Intl.DateTimeFormat('en-US', { 
        timeZone: 'Asia/Manila', 
        hour: 'numeric', 
        hour12: true 
    }).formatToParts(now).find(p => p.type === 'hour').value;

    state.queue.push(hourVal);
    res.json({ "value": state.currentBinary });
});

app.get('/clock/realtimephminutes', (req, res) => {
    const now = new Date();
    // Get numeric minutes (00-59) for PH time
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
        hour12: true 
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
            <p>SERVER LOCATION: <span style="color:yellow;">SINGAPORE (UTC+8)</span> | TIMEZONE: <span style="color:yellow;">PH_SYNC ACTIVE</span></p>
            <div style="display:flex; flex-direction:column; gap:12px; max-width:400px; margin-top:20px;">
                <button onclick="fetch('/clock/realtimephhours')" style="color:orange; background:#111; border:1px solid orange; padding:10px; cursor:pointer; text-align:left;">[ SYNC HOURS ]</button>
                <button onclick="fetch('/clock/realtimephminutes')" style="color:yellow; background:#111; border:1px solid yellow; padding:10px; cursor:pointer; text-align:left;">[ SYNC MINUTES ]</button>
                <button onclick="fetch('/clock/realtimeph')" style="color:cyan; background:#111; border:1px solid cyan; padding:10px; cursor:pointer; text-align:left;">[ SYNC FULL BCD CLOCK ]</button>
            </div>
            <p style="margin-top:30px; font-size:12px; color:#555;">May 2025 Fortress Logic v2.4</p>
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
            <h3>FORTRESS EDIT TERMINAL</h3>
            <input id="v" placeholder="Value (0-99)" style="background:#111; color:#0f0; border:1px solid #0f0; padding:5px;">
            <button onclick="send()">SEND MANUAL</button>
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
