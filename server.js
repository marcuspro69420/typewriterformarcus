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
    isPulsing: false,
    lastSyncedMinute: -1,
    lastSyncedHour: -1
};

/**
 * 🛠️ HEX BINARY MAPPING (Build Logic Style)
 * Converts number to 8-bit, then reverses for Pin 1-8 order.
 */
const convertToBuildLogicBinary = (num) => {
    const n = parseInt(num, 10);
    if (isNaN(n)) return "00000000";
    let bin = (n % 256).toString(2).padStart(8, '0');
    return bin.split('').reverse().join(''); 
};

/**
 * 📟 READ ENDPOINT
 * Modified: It no longer auto-resets to 0. It stays at the binary value
 * until the NEXT item in the queue is processed.
 */
app.get('/typewriter/read', (req, res) => {
    if (state.queue.length > 0) {
        const item = state.queue.shift();
        state.currentBinary = convertToBuildLogicBinary(item);
    }
    
    res.json({ "value": state.currentBinary });
});

/**
 * 🕒 TIME FETCHING LOGIC
 */
const getPHTime = () => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', { 
        timeZone: 'Asia/Manila', 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: false 
    });
    const parts = formatter.formatToParts(now);
    return {
        hh: parseInt(parts.find(p => p.type === 'hour').value, 10),
        mm: parseInt(parts.find(p => p.type === 'minute').value, 10)
    };
};

/**
 * 🔄 AUTO-SYNC LOOP (Checks every 30 seconds)
 */
setInterval(() => {
    const { hh, mm } = getPHTime();
    
    // If the minute changed, queue it
    if (mm !== state.lastSyncedMinute) {
        state.queue.push(mm);
        state.lastSyncedMinute = mm;
    }
    
    // If the hour changed, queue it
    if (hh !== state.lastSyncedHour) {
        state.queue.push(hh);
        state.lastSyncedHour = hh;
    }
}, 30000);

/**
 * 🕒 MANUAL CLOCK ENDPOINTS
 */
app.get('/clock/realtimephhours', (req, res) => {
    const { hh } = getPHTime();
    state.queue.push(hh);
    res.json({ "ok": true, "queued_hour": hh });
});

app.get('/clock/realtimephminutes', (req, res) => {
    const { mm } = getPHTime();
    state.queue.push(mm);
    res.json({ "ok": true, "queued_minute": mm });
});

app.get('/clock/realtimeph', (req, res) => {
    const { hh, mm } = getPHTime();
    state.queue.push(hh);
    state.queue.push(mm);
    res.json({ "ok": true, "queued": [hh, mm] });
});

/**
 * 🔑 SECRET ADMIN LOGIN
 */
app.get('/clock/adminpage', (req, res) => {
    if (req.query.login !== CLOCK_ADMIN_KEY) return res.status(404).send("Not Found");

    res.send(`
        <body style="background:#000; color:#0f0; font-family:monospace; padding:20px;">
            <h2 style="border-bottom:1px solid #0f0;">TELECOM ADMIN CLOCK PANEL</h2>
            <p>NODE: <span style="color:cyan;">HP PRODESK G2 SFF (SINGAPORE)</span></p>
            <p>STATUS: <span style="color:yellow;">AUTO-SYNC ACTIVE (PH_TIME)</span></p>
            <div style="display:flex; flex-direction:column; gap:12px; max-width:400px; margin-top:20px;">
                <button onclick="fetch('/clock/realtimephhours')" style="color:orange; background:#111; border:1px solid orange; padding:10px; cursor:pointer; text-align:left;">[ FORCE SYNC HOURS ]</button>
                <button onclick="fetch('/clock/realtimephminutes')" style="color:yellow; background:#111; border:1px solid yellow; padding:10px; cursor:pointer; text-align:left;">[ FORCE SYNC MINUTES ]</button>
                <button onclick="fetch('/clock/realtimeph')" style="color:cyan; background:#111; border:1px solid cyan; padding:10px; cursor:pointer; text-align:left;">[ FORCE FULL SYNC ]</button>
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
