/**
 * made by gemini and marcus
 * yay!
 */
const express = require('express');
const cookieParser = require('cookie-parser'); 
const app = express();
const PORT = process.env.PORT || 10000;

app.set('trust proxy', true);

/**
 * 🛠️ CONFIGURATION
 */
const REVERSE_BITS = true; // Set to true if your wiring is mirrored (e.g., 16 showing as 61)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD; 
const MARCUS_SECRET_KEY = process.env.MARCUS_SECRET_KEY;
const CLOCK_ADMIN_KEY = "telecomadmin";
const COOKIE_SECRET = process.env.COOKIE_SECRET || "donotconnecttotheinternetatmaytenth"; 

const SECRET_PATHS = {
    CONTROL: process.env.PATH_CTRL || "/cx_" + Math.random().toString(36).substring(7),
    TYPE: process.env.PATH_TYPE || "/ty_" + Math.random().toString(36).substring(7),
    BAN: "/api/sys/ban_internal"
};

const ADMIN_IDENTITIES = ["MARCUS", "MARCUSCABALUNA", "M2", "NATAL", "AISULTAN", "INTENS"];

app.use(express.json());
app.use(cookieParser(COOKIE_SECRET));

let state = { 
    currentBinary: "00000000", 
    queue: [], 
    lastSyncedMinute: -1,
    lastSyncedHour: -1
};

/**
 * 🛠️ BINARY MAPPING
 */
const convertToBuildLogicBinary = (num) => {
    const n = parseInt(num, 10);
    if (isNaN(n)) return "00000000";
    
    // Get standard 8-bit binary
    let bin = (n % 256).toString(2).padStart(8, '0');
    
    // If wiring is flipped, reverse the string before sending
    if (REVERSE_BITS) {
        bin = bin.split('').reverse().join('');
    }
    
    return bin;
};

/**
 * 📟 READ ENDPOINT
 */
app.get('/typewriter/read', (req, res) => {
    if (state.queue.length > 0) {
        const item = state.queue.shift();
        if (item !== undefined && item !== null) {
            state.currentBinary = convertToBuildLogicBinary(item);
        }
    }
    res.json({ "value": state.currentBinary || "00000000" });
});

/**
 * 🕒 TIME FETCHING LOGIC (STRICT UTC+8)
 */
const getPHTime = () => {
    try {
        const now = new Date();
        const phString = now.toLocaleString("en-GB", {
            timeZone: "Asia/Manila",
            hour12: false,
            hour: "2-digit",
            minute: "2-digit"
        });
        
        const [hh, mm] = phString.split(':').map(n => parseInt(n, 10));
        return { hh, mm };
    } catch (e) {
        return { hh: 0, mm: 0 };
    }
};

/**
 * 🔄 AUTO-SYNC LOOP
 */
setInterval(() => {
    const { hh, mm } = getPHTime();
    
    if (mm !== state.lastSyncedMinute) {
        state.currentBinary = convertToBuildLogicBinary(mm);
        state.lastSyncedMinute = mm;
    }
    
    if (hh !== state.lastSyncedHour) {
        state.currentBinary = convertToBuildLogicBinary(hh);
        state.lastSyncedHour = hh;
    }
}, 5000);

/**
 * 🕒 MANUAL CLOCK ENDPOINTS
 */
app.get('/clock/realtimephhours', (req, res) => {
    const { hh } = getPHTime();
    state.currentBinary = convertToBuildLogicBinary(hh);
    res.json({ "value": state.currentBinary });
});

app.get('/clock/realtimephminutes', (req, res) => {
    const { mm } = getPHTime();
    state.currentBinary = convertToBuildLogicBinary(mm);
    res.json({ "value": state.currentBinary });
});

app.get('/clock/realtimeph', (req, res) => {
    const { hh, mm } = getPHTime();
    // Show minutes immediately, queue the hour to follow
    state.currentBinary = convertToBuildLogicBinary(mm);
    state.queue.push(hh);
    res.json({ "value": state.currentBinary, "queued": hh });
});

/**
 * 🔑 ADMIN UI
 */
app.get('/clock/adminpage', (req, res) => {
    if (req.query.login !== CLOCK_ADMIN_KEY) return res.status(404).send("Not Found");

    res.send(`
        <body style="background:#000; color:#0f0; font-family:monospace; padding:20px;">
            <h2>TELECOM ADMIN CLOCK PANEL</h2>
            <p>BIT REVERSAL: <span style="color:${REVERSE_BITS ? 'cyan' : 'red'};">${REVERSE_BITS ? 'ENABLED' : 'DISABLED'}</span></p>
            <div style="display:flex; flex-direction:column; gap:10px; max-width:300px;">
                <button onclick="fetch('/clock/realtimephhours')" style="padding:10px; cursor:pointer;">SYNC HOURS ONLY</button>
                <button onclick="fetch('/clock/realtimephminutes')" style="padding:10px; cursor:pointer;">SYNC MINUTES ONLY</button>
                <button onclick="fetch('/clock/realtimeph')" style="padding:15px; cursor:pointer; background:#0f0; color:#000; font-weight:bold; border:none;">SYNC ALL (HH:MM)</button>
            </div>
        </body>
    `);
});

app.get('/typewriter/login', (req, res) => {
    const { pass } = req.query;
    if (pass === ADMIN_PASSWORD || pass === MARCUS_SECRET_KEY) {
        res.cookie('user_cookie', "MARCUS", { signed: true, httpOnly: true, path: '/' });
        return res.redirect('/typewriter/edit');
    }
    res.status(403).send("BYE");
});

app.get('/typewriter/edit', (req, res) => {
    if (!ADMIN_IDENTITIES.includes(req.signedCookies.user_cookie)) return res.status(404).send("Not Found");
    res.send(`
        <body style="background:#000; color:#0f0; font-family:monospace; padding:20px;">
            <h3>FORTRESS HEX TERMINAL</h3>
            <input id="v" style="background:#111; color:#0f0; border:1px solid #0f0;">
            <button onclick="send()">SEND</button>
            <script>
                async function send() {
                    await fetch('${SECRET_PATHS.TYPE}', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({m: document.getElementById('v').value})
                    });
                }
            </script>
        </body>
    `);
});

app.post(SECRET_PATHS.TYPE, (req, res) => {
    if (!ADMIN_IDENTITIES.includes(req.signedCookies.user_cookie)) return res.status(403).send("ERR");
    if (req.body && req.body.m) state.queue = [...state.queue, ...req.body.m.split(" ")];
    res.json({ok:true});
});

app.get('/', (req, res) => res.redirect('/typewriter/edit'));
app.listen(PORT, '0.0.0.0');
