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
const COOKIE_SECRET = process.env.COOKIE_SECRET || "donotconnecttotheinternetatmaytenth"; 

const SECRET_PATHS = {
    CONTROL: process.env.PATH_CTRL || "/cx_" + Math.random().toString(36).substring(7),
    TYPE: process.env.PATH_TYPE || "/ty_" + Math.random().toString(36).substring(7),
    BAN: "/api/sys/ban_internal"
};

const SUPER_ADMIN = "MARCUS"; 
const ADMIN_IDENTITIES = ["MARCUS", "MARCUSCABALUNA", "M2", "NATAL", "AISULTAN", "INTENS"];

let BANNED_COOKIES = []; 
let BANNED_IPS = []; 

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
 * 🛠️ BCD BINARY MAPPING (Build Logic Style)
 * Converts a number (0-99) into two 4-bit BCD nibbles.
 * Example: 12 -> Tens: 1 (1000), Ones: 2 (0100) -> Output: "10000100"
 */
const convertToBuildLogicBinary = (num) => {
    const n = parseInt(num, 10);
    if (isNaN(n)) return "00000000";

    const tens = Math.floor(n / 10);
    const ones = n % 10;

    // Build Logic Pin Order (Bit 1 is index 0, Bit 4 is index 3)
    // 1 -> 1000, 2 -> 0100, 3 -> 1100, etc.
    const toBCD4Bit = (digit) => {
        let bin = (digit % 16).toString(2).padStart(4, '0'); // Get standard binary
        return bin.split('').reverse().join(''); // Reverse it so 1 is at the start (Pin 1)
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
        
        // Short delay to simulate a logic pulse
        setTimeout(() => { 
            state.currentBinary = "00000000"; 
            state.isPulsing = false; 
        }, 150); 
    }
    
    res.json({ "value": state.currentBinary, "next": state.queue.length > 0 });
});

/**
 * 🕒 HOURS ONLY (BCD)
 */
app.get('/clock/realtimephhours', (req, res) => {
    const now = new Date();
    const phTime = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila',
        hour: 'numeric',
        hour12: true
    }).format(now);

    const hourVal = phTime.split(' ')[0];
    state.queue = [hourVal];
    res.send(`TRANSMITTING BCD HOURS: ${hourVal}`);
});

/**
 * 🕒 MINUTES ONLY (BCD)
 */
app.get('/clock/realtimephminutes', (req, res) => {
    const now = new Date();
    const phTime = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila',
        minute: '2-digit'
    }).format(now);

    state.queue = [phTime];
    res.send(`TRANSMITTING BCD MINUTES: ${phTime}`);
});

/**
 * 🕒 FULL CLOCK SYNC
 */
app.get('/clock/realtimeph', (req, res) => {
    const now = new Date();
    const phTime = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    }).format(now);

    const [time, period] = phTime.split(' ');
    const [hh, mm] = time.split(':');

    state.queue = [hh, mm];
    res.send(`SYNCING BCD: ${hh}:${mm}`);
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
            <h3>FORTRESS BCD CLOCK</h3>
            <div style="display:flex; flex-direction:column; gap:10px; max-width:300px;">
                <a href="/clock/realtimephhours" style="color:orange;">[ SYNC HOURS ]</a>
                <a href="/clock/realtimephminutes" style="color:yellow;">[ SYNC MINUTES ]</a>
                <a href="/clock/realtimeph" style="color:cyan;">[ SYNC BOTH ]</a>
            </div>
            <br>
            <input id="v" placeholder="Value (0-99)" style="background:#111; color:#0f0; border:1px solid #0f0; padding:5px;">
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
    state.queue = req.body.m.split(" ");
    res.json({ok:true});
});

app.get('/', (req, res) => res.redirect('/typewriter/edit'));
app.listen(PORT, '0.0.0.0');
