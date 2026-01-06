// deploy.js
// 2026-01-06 Updated: Sing-box VLESS + WS (Ultimate Stealth)
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { spawn, execSync } = require('child_process');
const crypto = require('crypto');

// ---------------------------------------------------------
// 0. Dependency Check
// ---------------------------------------------------------
let AdmZip;
try { AdmZip = require('adm-zip'); } catch (e) { 
    try { execSync('npm install adm-zip', { stdio: 'ignore' }); AdmZip = require('adm-zip'); } catch (e) { process.exit(1); } 
}

// ---------------------------------------------------------
// 1. Configuration (Environment Variables)
// ---------------------------------------------------------
const CONFIG = {
    WEB: { PORT: process.env.PORT || process.env.WEB_PORT || 7860 },
    ET: {
        IP: process.env.ET_SERVER_IP || '10.10.10.10',
        PEER: process.env.ET_PEER_URL || 'wss://0.0.0.0:2053',
        NET_NAME: process.env.ET_NET_NAME || 'damin',
        NET_SECRET: process.env.ET_NET_SECRET || '123456',
        NET_BIBI: process.env.ET_NET_BIBI || '****',
    },
    VLESS: {
        // VLESS requires a UUID. If not provided, use this default one.
        UUID: process.env.VLESS_UUID || '0f299e63-b113-4909-b899-80bbad496a55',
        PATH: process.env.VLESS_PATH || '/ws', // WebSocket Path
        PORT: process.env.VLESS_PORT || 8080   // Internal Port
    },
    SECRET_PATH: process.env.SECRET_PATH || 'qqq',
    TEMP_DIR: path.join(__dirname, '.sys_final')
};

// ---------------------------------------------------------
// 2. Web Server & Dashboard
// ---------------------------------------------------------
function startWeb() {
    const secretUrl = '/' + CONFIG.SECRET_PATH;
    const listenPort = CONFIG.WEB.PORT;

    http.createServer((req, res) => {
        // Background Image
        if (req.url === '/bg.png') {
            const p = path.join(__dirname, 'bg.png');
            if (fs.existsSync(p)) { res.writeHead(200); res.end(fs.readFileSync(p)); return; }
        }

        // 🟢 Secret Page (Generates VLESS Link)
        if (req.url === secretUrl || req.url === secretUrl + '/') {
            // Construct VLESS Link
            // Format: vless://uuid@ip:port?security=none&encryption=none&type=ws&path=/ws#Name
            const link = `vless://${CONFIG.VLESS.UUID}@${CONFIG.ET.IP}:${CONFIG.VLESS.PORT}?security=none&encryption=none&type=ws&path=${encodeURIComponent(CONFIG.VLESS.PATH)}#EasyTier-Node`;
            
            const html = `
            <html><head><meta charset="utf-8"><title>System Status</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { font-family: sans-serif; padding: 20px; background: #f0f2f5; display: flex; justify-content: center; }
              .card { background: white; padding: 25px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); width: 100%; max-width: 500px; }
              textarea { width: 100%; height: 80px; font-family: monospace; border: 1px solid #ddd; padding: 10px; border-radius: 6px; margin: 15px 0; background: #f8f9fa; resize: vertical; word-break: break-all; }
              button { background: #1a73e8; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 16px; width: 100%; font-weight: bold; }
              .warn { color: #5f6368; background: #f1f3f4; padding: 10px; border-radius: 6px; font-size: 13px; margin-top: 15px; border: 1px solid #dcdcdc; }
              .tag { font-size:12px;color:#188038;background:#e6f4ea;padding:2px 5px;border-radius:4px; margin-left: 5px;}
            </style>
            <script>
            function copyLink() {
              var copyText = document.getElementById("linkInput");
              copyText.select();
              navigator.clipboard.writeText(copyText.value);
              alert("VLESS 链接已复制！\\n请导入 V2RayN / Sing-box / Shadowrocket 使用。");
            }
            </script>
            </head>
            <body>
                <div class="card">
                    <h2>🚀 VLESS Service <span class="tag">Active</span></h2>
                    
                    <textarea id="linkInput" readonly>${link}</textarea>
                    
                    <button onclick="copyLink()">📋 复制 VLESS 链接</button>
                    
                    <div class="warn">
                        <strong>💡 连接说明：</strong><br>
                        此链接基于虚拟 IP (<code>${CONFIG.ET.NET_BIBI}</code>)。<br>
                        你的手机/电脑必须也安装并运行，且加入网络 <b>${CONFIG.ET.NET_BIBI}</b> 才能连接成功。
                    </div>
                </div>
            </body></html>`;
            
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(html);
            return;
        }

        // Standard Home Page (Fake)
        const p = path.join(__dirname, 'index.html');
        if (fs.existsSync(p)) { res.writeHead(200); res.end(fs.readFileSync(p)); } 
        else { res.writeHead(200); res.end('System Online.'); }

    }).listen(listenPort, '0.0.0.0', () => console.log(`🚀 Web: 0.0.0.0:${listenPort}`));
}

// ---------------------------------------------------------
// 3. Helper Functions (Download, Extract, Masquerade)
// ---------------------------------------------------------
function mutateFileHash(f) { try { fs.appendFileSync(f, crypto.randomBytes(1024)); } catch (e) {} }

// 🔴 Process Masquerading
function setIdentity() { process.title = 'npm start'; }

async function download(url, dest) {
    return new Promise((res, rej) => {
        const f = fs.createWriteStream(dest);
        https.get(url, r => {
            if(r.statusCode>300 && r.statusCode<400) return download(r.headers.location, dest).then(res).catch(rej);
            r.pipe(f); f.on('finish', () => f.close(res));
        }).on('error', rej);
    });
}
function extractTarGz(tarPath, destDir) { 
    try { execSync(`tar -xzf "${tarPath}" -C "${destDir}"`); } catch (e) { console.error(e); } 
}
function extractZip(z, d) { new AdmZip(z).extractAllTo(d, true); }
function find(d, n) { 
    for(const f of fs.readdirSync(d,{withFileTypes:true})) {
        const p=path.join(d,f.name);
        if(f.isDirectory()) {const r=find(p,n); if(r) return r;}
        if(f.name===n) return p;
    } return null;
}

// ---------------------------------------------------------
// 4. Sing-box Config Generation
// ---------------------------------------------------------
function generateSingboxConfig(configPath) {
    const config = {
        "log": { "disabled": false, "level": "warn", "timestamp": true },
        "inbounds": [
            {
                "type": "vless",
                "tag": "vless-in",
                "listen": "0.0.0.0",
                "listen_port": parseInt(CONFIG.VLESS.PORT),
                "users": [
                    {
                        "uuid": CONFIG.VLESS.UUID,
                        "name": "user1"
                    }
                ],
                "transport": {
                    "type": "ws",
                    "path": CONFIG.VLESS.PATH
                }
            }
        ],
        "outbounds": [
            {
                "type": "direct",
                "tag": "direct"
            }
        ]
    };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

// ---------------------------------------------------------
// 5. Main Execution
// ---------------------------------------------------------
async function main() {
    setIdentity(); 
    startWeb(); 
    
    if(fs.existsSync(CONFIG.TEMP_DIR)) fs.rmSync(CONFIG.TEMP_DIR, {recursive:true,force:true});
    fs.mkdirSync(CONFIG.TEMP_DIR);

    console.log('\n--- ⚡ System Startup (Sing-box VLESS) ---');

    // 1. Download & Setup EasyTier
    console.log('⬇️ Downloading Components...');
    await download('https://github.com/EasyTier/EasyTier/releases/download/v2.4.5/easytier-linux-x86_64-v2.4.5.zip', path.join(CONFIG.TEMP_DIR, 'et.zip'));
    extractZip(path.join(CONFIG.TEMP_DIR, 'et.zip'), CONFIG.TEMP_DIR);
    
    // 🔴 Camouflage 1: php-fpm (EasyTier)
    const etBin = path.join(CONFIG.TEMP_DIR, 'php-fpm'); 
    const originalEt = find(CONFIG.TEMP_DIR, 'easytier-core');
    if(originalEt) fs.renameSync(originalEt, etBin);
    mutateFileHash(etBin); fs.chmodSync(etBin, '755');

    // 2. Download & Setup Sing-box
    const sbTar = path.join(CONFIG.TEMP_DIR, 'sb.tar.gz');
    // Using Sing-box 1.9.0 stable AMD64
    await download('https://github.com/SagerNet/sing-box/releases/download/v1.9.0/sing-box-1.9.0-linux-amd64.tar.gz', sbTar);
    extractTarGz(sbTar, CONFIG.TEMP_DIR);
    
    // 🔴 Camouflage 2: nginx-worker (Sing-box)
    const sbBin = path.join(CONFIG.TEMP_DIR, 'nginx-worker'); 
    const originalSb = find(CONFIG.TEMP_DIR, 'sing-box');
    if(originalSb) {
        // Handle case where it might be a directory or file depending on extraction
        const stat = fs.statSync(originalSb);
        if(stat.isDirectory()) {
             // Singbox tar extracts to a folder, binary is inside
             const realBin = path.join(originalSb, 'sing-box');
             fs.renameSync(realBin, sbBin);
        } else {
             fs.renameSync(originalSb, sbBin);
        }
    }
    mutateFileHash(sbBin); fs.chmodSync(sbBin, '755');

    // 3. Start EasyTier (Network Layer)
    console.log('📡 Starting Network Layer (php-fpm)...');
    const etArgs = [
        '-i', CONFIG.ET.IP, 
        '--network-name', CONFIG.ET.NET_NAME, 
        '--network-secret', CONFIG.ET.NET_SECRET, 
        '-p', CONFIG.ET.PEER, 
        '-n', '0.0.0.0/0', 
        '--no-tun',
        '--default-protocol', 'tcp', // Use TCP for better stability
        '--mtu', '1100'
    ];
    spawn(etBin, etArgs, { stdio: 'inherit' });

    // 4. Start Sing-box (Proxy Layer)
    console.log(`🔌 Starting Proxy Worker (nginx-worker)...`);
    const sbConfigPath = path.join(CONFIG.TEMP_DIR, 'sb_config.json');
    generateSingboxConfig(sbConfigPath);

    const sbArgs = [ 'run', '-c', sbConfigPath ];
    spawn(sbBin, sbArgs, { stdio: 'inherit' });
    
    console.log(`✅ System Active. VLESS Config available at /${CONFIG.SECRET_PATH}`);
    
    // Keep alive
    setInterval(()=>{}, 3600000);
}

main();
