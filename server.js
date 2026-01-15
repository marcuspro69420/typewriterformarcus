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
 * Fixed: Removed the .reverse() so the binary matches standard Hex values.
 */
const convertToBuildLogicBinary = (num) => {
    const n = parseInt(num, 10);
    if (isNaN(n)) return "00000000";
    // Standard 8-bit binary (MSB to LSB)
    return (n % 256).toString(2).padStart(8, '0');
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
 * 🕒 TIME FETCHING LOGIC (PH Timezone - UTC+8)
 */
const getPHTime = () => {
    const now = new Date();
    // Manual UTC+8 offset for Philippines
    const phTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    
    return {
        hh: phTime.getUTCHours(), 
        mm: phTime.getUTCMinutes()
    };
};

/**
 * 🔄 AUTO-SYNC LOOP
 */
setInterval(() => {
    const { hh, mm } = getPHTime();
    
    // Minute sync
    if (mm !== state.lastSyncedMinute) {
        state.currentBinary = convertToBuildLogicBinary(mm);
        state.lastSyncedMinute = mm;
    }
    
    // Hour sync
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
    state.currentBinary = convertToBuildLogicBinary(mm);
    state.queue.push(hh);
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
            <p>NODE: <span style="color:cyan;">HP PRODESK G2 SFF</span></p>
            <p>MADE BY: <span style="color:white;">GEMINI AND MARCUS</span></p>
            <div style="display:flex; flex-direction:column; gap:12px; max-width:400px; margin-top:20px;">
                <button onclick="fetch('/clock/realtimephhours')" style="color:orange; background:#111; border:1px solid orange; padding:10px; cursor:pointer; text-align:left;">[ SYNC HOURS (24H) ]</button>
                <button onclick="fetch('/clock/realtimephminutes')" style="color:yellow; background:#111; border:1px solid yellow; padding:10px; cursor:pointer; text-align:left;">[ SYNC MINUTES ]</button>
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
    if (req.body && req.body.m) {
        state.queue = [...state.queue, ...req.body.m.split(" ")];
    }
    res.json({ok:true});
});

app.get('/', (req, res) => res.redirect('/typewriter/edit'));
app.listen(PORT, '0.0.0.0');
