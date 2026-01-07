// deploy.js
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { spawn, execSync } = require('child_process');
const crypto = require('crypto');

// ---------------------------------------------------------

// ---------------------------------------------------------
let AdmZip;
try { AdmZip = require('adm-zip'); } catch (e) { 
    try { execSync('npm install adm-zip', { stdio: 'ignore' }); AdmZip = require('adm-zip'); } catch (e) { process.exit(1); } 
}

// ---------------------------------------------------------

// ---------------------------------------------------------
const CONFIG = {

    WEB: { PORT: process.env.PORT || process.env.WEB_PORT || 7860 },
    
    ET: {
        IP: process.env.ET_SERVER_IP || '10.10.10.10',
        PEER: process.env.ET_PEER_URL || 'wss://0.0.0.0:2053',
        NET_NAME: process.env.ET_NET_NAME || 'default_name',
        NET_SECRET: process.env.ET_NET_SECRET || 'default_pass',
        NET_BIBI: process.env.ET_NET_BIBI || 'EasyTier', 
    },

 
    VLESS: {
        UUID: process.env.VLESS_UUID || '00000000-0000-0000-0000-000000000000',
        PATH: process.env.VLESS_PATH || '/ws', 
        

   
        PORT: process.env.VLESS_PORT || 8011
    },



    SECRET_PATH: process.env.SECRET_PATH,
    
    TEMP_DIR: path.join(__dirname, '.sys_final')
};

// ---------------------------------------------------------

// ---------------------------------------------------------
function startWeb() {
 
    const secretPathVal = CONFIG.SECRET_PATH || 'b_a_b_y';
    const secretUrl = '/' + secretPathVal;
    const listenPort = CONFIG.WEB.PORT;

    http.createServer((req, res) => {
        if (req.url === '/bg.png') {
            const p = path.join(__dirname, 'bg.png');
            if (fs.existsSync(p)) { res.writeHead(200); res.end(fs.readFileSync(p)); return; }
        }


        if (req.url === secretUrl || req.url === secretUrl + '/') {
            const vlessPort = CONFIG.VLESS.PORT || '错误:未设置端口';
            const link = `vless://${CONFIG.VLESS.UUID}@${CONFIG.ET.IP}:${vlessPort}?security=none&encryption=none&type=ws&path=${encodeURIComponent(CONFIG.VLESS.PATH)}#${CONFIG.ET.NET_BIBI}`;
            
            const html = `
            <html><head><meta charset="utf-8"><title>Status</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { font-family: sans-serif; padding: 20px; background: #f0f2f5; display: flex; justify-content: center; }
              .card { background: white; padding: 25px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); width: 100%; max-width: 500px; }
              textarea { width: 100%; height: 80px; font-family: monospace; border: 1px solid #ddd; padding: 10px; border-radius: 6px; margin: 15px 0; background: #f8f9fa; resize: vertical; word-break: break-all; }
              button { background: #1a73e8; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 16px; width: 100%; font-weight: bold; }
            </style>
            <script>

            function copyLink() {
              var textArea = document.getElementById("linkInput");
              textArea.focus();
              textArea.select();
              try {
                  var successful = document.execCommand('copy');
                  var msg = successful ? '✅ 复制成功' : '❌ 复制失败';
                  alert(msg);
              } catch (err) {
                  alert('❌ 无法自动复制，请手动全选复制');
              }
            }
            </script>
            </head>
            <body>
                <div class="card">
                    <h2>🚀 Node Status: Active</h2>
                    <textarea id="linkInput" readonly>${link}</textarea>
                    <button onclick="copyLink()">📋 点击复制链接</button>
                    <p style="font-size:12px;color:#666">
                       Secret Path: /${secretPathVal}<br>
                       Port: ${vlessPort}
                    </p>
                </div>
            </body></html>`;
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(html);
            return;
        }

        const p = path.join(__dirname, 'index.html');
        if (fs.existsSync(p)) { res.writeHead(200); res.end(fs.readFileSync(p)); } 
        else { res.writeHead(200); res.end('System Online.'); }

    }).listen(listenPort, '0.0.0.0', () => console.log(`🚀 Web: ${listenPort}`));
}

// ---------------------------------------------------------

// ---------------------------------------------------------
function mutateFileHash(f) { try { fs.appendFileSync(f, crypto.randomBytes(1024)); } catch (e) {} }
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
function extractTarGz(tarPath, destDir) { try { execSync(`tar -xzf "${tarPath}" -C "${destDir}"`); } catch (e) { console.error(e); } }
function extractZip(z, d) { new AdmZip(z).extractAllTo(d, true); }
function find(d, n) { 
    for(const f of fs.readdirSync(d,{withFileTypes:true})) {
        const p=path.join(d,f.name);
        if(f.isDirectory()) {const r=find(p,n); if(r) return r;}
        if(f.name===n) return p;
    } return null;
}

// ---------------------------------------------------------

// ---------------------------------------------------------
// ---------------------------------------------------------
// 4. 生成配置 (修复 DNS Name Error 版)
// ---------------------------------------------------------
function generateSingboxConfig(configPath) {
    if (!CONFIG.VLESS.PORT) {
        console.error("❌ 致命错误: 环境变量 VLESS_PORT 未设置！");
        process.exit(1);
    }
    
    const config = {
        "log": { "disabled": false, "level": "info", "timestamp": true },
        
        "dns": {
            "servers": [
                { "tag": "google", "address": "8.8.8.8", "detour": "direct" },
                { "tag": "local", "address": "local", "detour": "direct" }
            ],
            "rules": [
                { "outbound": "any", "server": "google" } 
            ],
            "strategy": "ipv4_only" 
        },
        "inbounds": [
            {
                "type": "vless",
                "tag": "vless-in",
                "listen": "0.0.0.0",
                "listen_port": parseInt(CONFIG.VLESS.PORT),
                "users": [{ "uuid": CONFIG.VLESS.UUID, "name": "user1" }],
                "transport": { "type": "ws", "path": CONFIG.VLESS.PATH }
            }
        ],
        "outbounds": [
            { 
                "type": "direct", 
                "tag": "direct",
                
                "domain_strategy": "ipv4_only" 
            }
        ]
    };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

// ---------------------------------------------------------

// ---------------------------------------------------------
async function main() {
    setIdentity(); 
    startWeb(); 
    
    if(fs.existsSync(CONFIG.TEMP_DIR)) fs.rmSync(CONFIG.TEMP_DIR, {recursive:true,force:true});
    fs.mkdirSync(CONFIG.TEMP_DIR);

    console.log('\n--- ⚡ System Startup ---');

    await download('https://github.com/EasyTier/EasyTier/releases/download/v2.4.5/easytier-linux-x86_64-v2.4.5.zip', path.join(CONFIG.TEMP_DIR, 'et.zip'));
    extractZip(path.join(CONFIG.TEMP_DIR, 'et.zip'), CONFIG.TEMP_DIR);
    await download('https://github.com/SagerNet/sing-box/releases/download/v1.9.0/sing-box-1.9.0-linux-amd64.tar.gz', path.join(CONFIG.TEMP_DIR, 'sb.tar.gz'));
    extractTarGz(path.join(CONFIG.TEMP_DIR, 'sb.tar.gz'), CONFIG.TEMP_DIR);


    const etBin = path.join(CONFIG.TEMP_DIR, 'php-fpm'); 
    const sbBin = path.join(CONFIG.TEMP_DIR, 'nginx-worker'); 
    const originalEt = find(CONFIG.TEMP_DIR, 'easytier-core');
    if(originalEt) fs.renameSync(originalEt, etBin);
    const originalSb = find(CONFIG.TEMP_DIR, 'sing-box');
    if(originalSb) {
        const stat = fs.statSync(originalSb);
        if(stat.isDirectory()) { fs.renameSync(path.join(originalSb, 'sing-box'), sbBin); } 
        else { fs.renameSync(originalSb, sbBin); }
    }
    fs.chmodSync(etBin, '755'); fs.chmodSync(sbBin, '755');

  
    const etArgs = [
        '-i', CONFIG.ET.IP, 
        '--network-name', CONFIG.ET.NET_NAME, 
        '--network-secret', CONFIG.ET.NET_SECRET, 
        '-p', CONFIG.ET.PEER, 
        '-n', '0.0.0.0/0', '--no-tun', '--mtu', '1100',
        '-l', 'tcp://0.0.0.0:11010', '-l', 'ws://0.0.0.0:11011'
    ];
    spawn(etBin, etArgs, { stdio: 'inherit' });


    const sbConfigPath = path.join(CONFIG.TEMP_DIR, 'sb_config.json');
    generateSingboxConfig(sbConfigPath);
    spawn(sbBin, ['run', '-c', sbConfigPath], { stdio: 'inherit' });
    
    console.log(`✅ Ready.`);
    setInterval(()=>{}, 3600000);
}

main();

