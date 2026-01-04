// deploy.js
// 2026-01-04 Updated: Flexible Web Port + Secret Page + MTU fix
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { spawn, execSync } = require('child_process');
const crypto = require('crypto');

// ---------------------------------------------------------
// 🛠️ 依赖检查与安装
// ---------------------------------------------------------
let AdmZip;
try { AdmZip = require('adm-zip'); } catch (e) { 
    try { execSync('npm install adm-zip', { stdio: 'ignore' }); AdmZip = require('adm-zip'); } catch (e) { process.exit(1); } 
}
try { execSync('apk add openssl gzip', { stdio: 'ignore' }); } catch(err) {}

// ---------------------------------------------------------
// ⚙️ 配置区域 (环境变量 + 默认值)
// ---------------------------------------------------------
const CONFIG = {
    // 🟢 新增：Web 服务端口配置 (优先读取环境变量 PORT, 其次 WEB_PORT, 最后默认 7860)
    WEB: {
        PORT: process.env.PORT || process.env.WEB_PORT || 7860
    },
    ET: {
        IP: process.env.ET_SERVER_IP || '10.10.10.10',
        PEER: process.env.ET_PEER_URL || 'wss://0.0.0.0:2053',
        NET_NAME: process.env.ET_NET_NAME || 'damin',
        NET_SECRET: process.env.ET_NET_SECRET || '123456',
    },
    PROXY: {
        USER: process.env.PROXY_USER || 'an',
        PASS: process.env.PROXY_PASS || '123321',
        PATH: process.env.SECRET_PATH || 'qqq' 
    },
    GOST: {
        URL: 'https://github.com/ginuerzh/gost/releases/download/v2.11.5/gost-linux-amd64-2.11.5.gz',
        PORT: process.env.ET_SOCKS_PORT || '8025'
    },
    TEMP_DIR: path.join(__dirname, '.sys_final')
};

// ---------------------------------------------------------
// 🔐 证书生成逻辑
// ---------------------------------------------------------
function generateCert() {
    console.log('🔐 生成证书...');
    const certPath = path.join(CONFIG.TEMP_DIR, 'cert.pem');
    const keyPath = path.join(CONFIG.TEMP_DIR, 'key.pem');
    try {
        execSync(`openssl req -newkey rsa:2048 -nodes -keyout "${keyPath}" -x509 -days 3650 -out "${certPath}" -subj "/C=US/O=Secure/CN=Proxy"`, { stdio: 'ignore' });
        return { cert: certPath, key: keyPath };
    } catch (e) { return null; }
}

// ---------------------------------------------------------
// 🌐 Web 服务器 (含通关蜜语页面)
// ---------------------------------------------------------
function startWeb() {
    const secretUrl = '/' + CONFIG.PROXY.PATH; // e.g. /qqq
    const listenPort = CONFIG.WEB.PORT;

    http.createServer((req, res) => {
        // 1. 背景图片路由
        if (req.url === '/bg.png') {
            const p = path.join(__dirname, 'bg.png');
            if (fs.existsSync(p)) { res.writeHead(200); res.end(fs.readFileSync(p)); return; }
        }

        // 2. 通关蜜语页面路由 (关键新增)
        // 匹配 /qqq 或 /qqq/
        if (req.url === secretUrl || req.url === secretUrl + '/') {
            // 生成链接 (密码脱敏，用 Wait_Input_Pass 代替)
            const link = `socks5+tls://${CONFIG.PROXY.USER}:Wait_Input_Pass@${CONFIG.ET.IP}:${CONFIG.GOST.PORT}?insecure=true`;
            
            const html = `
            <html><head><meta charset="utf-8"><title>Secret Config</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { font-family: sans-serif; padding: 20px; background: #f0f2f5; display: flex; justify-content: center; }
              .card { background: white; padding: 25px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); width: 100%; max-width: 500px; }
              textarea { width: 100%; height: 80px; font-family: monospace; border: 1px solid #ddd; padding: 10px; border-radius: 6px; margin: 15px 0; background: #f8f9fa; resize: vertical; }
              button { background: #1a73e8; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 16px; width: 100%; font-weight: bold; }
              .warn { color: #d93025; background: #fce8e6; padding: 10px; border-radius: 6px; font-size: 14px; margin-top: 15px; border: 1px solid #fad2cf; }
            </style>
            <script>
            function copyLink() {
              var copyText = document.getElementById("linkInput");
              copyText.select();
              navigator.clipboard.writeText(copyText.value);
              alert("链接已复制！\\n\\n⚠️ 请注意：\\n你需要手动将 Wait_Input_Pass 改为你的真实密码！");
            }
            </script>
            </head>
            <body>
                <div class="card">
                    <h2>🚀 SOCKS5 + TLS <span style="font-size:12px;color:#000;background:#eee;padding:2px 5px;border-radius:4px;">Protected</span></h2>
                    <textarea id="linkInput" readonly>${link}</textarea>
                    <button onclick="copyLink()">📋 复制并去修改密码</button>
                    <div class="warn">
                        <strong>🔒 安全提示：</strong><br>
                        为了防止泄露，链接中的密码已隐藏。<br>
                        复制后请将 <code>Wait_Input_Pass</code> 改为真实密码：<br>
                        (默认: <b>${CONFIG.PROXY.PASS}</b>)
                    </div>
                </div>
            </body></html>`;
            
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(html);
            return;
        }

        // 3. 默认页面
        const p = path.join(__dirname, 'index.html');
        if (fs.existsSync(p)) { res.writeHead(200); res.end(fs.readFileSync(p)); } 
        else { res.writeHead(200); res.end('System Online. Access /' + CONFIG.PROXY.PATH + '/ for config.'); }

    }).listen(listenPort, '0.0.0.0', () => console.log(`🚀 Web 服务启动: 0.0.0.0:${listenPort}`));
}

// ---------------------------------------------------------
// 📂 工具函数
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
function extractGz(gzPath, destBin) { execSync(`gzip -d -c "${gzPath}" > "${destBin}"`); }
function extractZip(z, d) { new AdmZip(z).extractAllTo(d, true); }
function find(d, n) { 
    for(const f of fs.readdirSync(d,{withFileTypes:true})) {
        const p=path.join(d,f.name);
        if(f.isDirectory()) {const r=find(p,n); if(r) return r;}
        if(f.name===n) return p;
    } return null;
}

// ---------------------------------------------------------
// 🚀 主程序
// ---------------------------------------------------------
async function main() {
    setIdentity();
    startWeb(); // 启动 Web 服务 (端口由配置决定)
    
    if(fs.existsSync(CONFIG.TEMP_DIR)) fs.rmSync(CONFIG.TEMP_DIR, {recursive:true,force:true});
    fs.mkdirSync(CONFIG.TEMP_DIR);

    console.log('\n--- ⚡ 启动 Node 部署 (Flexible Port) ---');

    const tls = generateCert();

    // 1. 下载 EasyTier
    await download('https://github.com/EasyTier/EasyTier/releases/download/v2.4.5/easytier-linux-x86_64-v2.4.5.zip', path.join(CONFIG.TEMP_DIR, 'et.zip'));
    extractZip(path.join(CONFIG.TEMP_DIR, 'et.zip'), CONFIG.TEMP_DIR);
    const etBin = path.join(CONFIG.TEMP_DIR, 'sys_et');
    fs.renameSync(find(CONFIG.TEMP_DIR, 'easytier-core'), etBin);
    mutateFileHash(etBin); fs.chmodSync(etBin, '755');

    // 2. 下载 GOST
    const gzPath = path.join(CONFIG.TEMP_DIR, 'gt.gz');
    await download(CONFIG.GOST.URL, gzPath);
    const gostBin = path.join(CONFIG.TEMP_DIR, 'sys_gt');
    extractGz(gzPath, gostBin);
    mutateFileHash(gostBin); fs.chmodSync(gostBin, '755');

    // 3. 启动 EasyTier (TCP + MTU 1100 优化)
    console.log('📡 EasyTier: TCP 模式 + MTU 1100 优化启动...');
    const etArgs = [
        '-i', CONFIG.ET.IP, 
        '--network-name', CONFIG.ET.NET_NAME, 
        '--network-secret', CONFIG.ET.NET_SECRET, 
        '-p', CONFIG.ET.PEER, 
        '-n', '0.0.0.0/0', 
        '--no-tun',
        '--default-protocol', 'tcp', // 强制 TCP
        '--mtu', '1100' // 🔴 防止大包卡顿
    ];
    spawn(etBin, etArgs, { stdio: 'inherit' });

    // 4. 启动 GOST V2 (Socks5+TLS+Auth)
    console.log(`🔌 GOST: 端口 ${CONFIG.GOST.PORT} (User: ${CONFIG.PROXY.USER})`);
    
    const gostUrl = `socks5+tls://${CONFIG.PROXY.USER}:${CONFIG.PROXY.PASS}@:${CONFIG.GOST.PORT}?cert=${tls.cert}&key=${tls.key}&dns=8.8.8.8:53/tcp&ttl=10s`;
    
    const gostArgs = [ '-L', gostUrl ];
    
    spawn(gostBin, gostArgs, { stdio: 'inherit' });
    
    console.log(`✅ 部署完成。Web端口: ${CONFIG.WEB.PORT}。访问 /${CONFIG.PROXY.PATH}/ 获取配置。`);
    setInterval(()=>{}, 3600000);
}
main();
