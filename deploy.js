// deploy.js
// 2026-01-07 Final Version: Secure & Environment Variable Ready
// -------------------------------------------------------------------
// 🛡️ 安全提示：不要修改此文件里的默认密码！
// ✅ 正确做法：请在 Railway/Koyeb 的 "Environment Variables" 中设置真实密码。
// -------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { spawn, execSync } = require('child_process');
const crypto = require('crypto');

// ---------------------------------------------------------
// 0. 依赖检查 (自动安装 adm-zip)
// ---------------------------------------------------------
let AdmZip;
try { AdmZip = require('adm-zip'); } catch (e) { 
    try { execSync('npm install adm-zip', { stdio: 'ignore' }); AdmZip = require('adm-zip'); } catch (e) { process.exit(1); } 
}

// ---------------------------------------------------------
// 1. 全局配置 (优先读取环境变量)
// ---------------------------------------------------------
const CONFIG = {
    // Web 服务端口 (Railway 会自动注入 PORT，或者默认 7860)
    WEB: { PORT: process.env.PORT || process.env.WEB_PORT || 7860 },
    
    // EasyTier 配置 (默认值全是假的，必须在平台变量里改)
    ET: {
        IP: process.env.ET_SERVER_IP || '10.10.10.10',
        PEER: process.env.ET_PEER_URL || 'wss://0.0.0.0:2053', // 这是一个无效的默认节点
        NET_NAME: process.env.ET_NET_NAME || 'default_name',
        NET_SECRET: process.env.ET_NET_SECRET || 'default_pass',
        // 网页上显示的虚拟 IP 提示 (可选)
        NET_BIBI: process.env.ET_NET_BIBI || '10.xxx.xxx.xxx', 
    },

    // Sing-box VLESS 配置
    VLESS: {
        // 默认 UUID 是全 0 的占位符，必须在变量里填真实的
        UUID: process.env.VLESS_UUID || '00000000-0000-0000-0000-000000000000',
        PATH: process.env.VLESS_PATH || '/ws', 
        PORT: process.env.VLESS_PORT || 8080   // 内部代理端口
    },

    // 网页访问的通关蜜语 (不填就是 /qqq)
    SECRET_PATH: process.env.SECRET_PATH || 'qqq',
    
    // 临时文件目录
    TEMP_DIR: path.join(__dirname, '.sys_final')
};

// ---------------------------------------------------------
// 2. Web 服务器 (伪装页面 + VLESS 链接生成)
// ---------------------------------------------------------
function startWeb() {
    const secretUrl = '/' + CONFIG.SECRET_PATH;
    const listenPort = CONFIG.WEB.PORT;

    http.createServer((req, res) => {
        // 1. 背景图片支持
        if (req.url === '/bg.png') {
            const p = path.join(__dirname, 'bg.png');
            if (fs.existsSync(p)) { res.writeHead(200); res.end(fs.readFileSync(p)); return; }
        }

        // 2. 🟢 只有路径正确，才显示 VLESS 配置
        if (req.url === secretUrl || req.url === secretUrl + '/') {
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
              alert("VLESS 链接已复制！");
            }
            </script>
            </head>
            <body>
                <div class="card">
                    <h2>🚀 VLESS Service <span class="tag">Active</span></h2>
                    <textarea id="linkInput" readonly>${link}</textarea>
                    <button onclick="copyLink()">📋 复制链接</button>
                    <div class="warn">
                        <strong>💡 提示：</strong><br>
                        必须连接 EasyTier 网络: <b>${CONFIG.ET.NET_BIBI === '10.xxx.xxx.xxx' ? CONFIG.ET.NET_NAME : CONFIG.ET.NET_BIBI}</b><br>
                        IP: ${CONFIG.ET.IP} | Port: ${CONFIG.VLESS.PORT}
                    </div>
                </div>
            </body></html>`;
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(html);
            return;
        }

        // 3. 🔴 路径错误，显示伪装页面 (这里是珊瑚公益页，也可换成别的)
        // 为了代码简洁，这里直接输出简单的 HTML，你也可以读取 index.html
        const fakeHtml = `
        <!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Coral Public Welfare</title>
        <style>
            body { margin: 0; padding: 0; background: #001e3c; color: #fff; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; flex-direction: column; }
            h1 { font-size: 2rem; color: #4fc3f7; }
            p { opacity: 0.7; max-width: 400px; text-align: center; }
        </style></head>
        <body>
            <h1>🐠 Coral Protection</h1>
            <p>Protecting the marine environment is protecting our future.</p>
        </body></html>`;
        
        // 优先读取 index.html，没有则用内嵌伪装
        const p = path.join(__dirname, 'index.html');
        if (fs.existsSync(p)) { res.writeHead(200); res.end(fs.readFileSync(p)); } 
        else { res.writeHead(200); res.end(fakeHtml); }

    }).listen(listenPort, '0.0.0.0', () => console.log(`🚀 Web Server running on port: ${listenPort}`));
}

// ---------------------------------------------------------
// 3. 核心功能函数
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
// 4. 生成 Sing-box 配置文件
// ---------------------------------------------------------
function generateSingboxConfig(configPath) {
    const config = {
        "log": { "disabled": false, "level": "info", "timestamp": true },
        "inbounds": [
            {
                "type": "vless",
                "tag": "vless-in",
                "listen": "0.0.0.0",
                "listen_port": parseInt(CONFIG.VLESS.PORT), // 读取配置端口
                "users": [{ "uuid": CONFIG.VLESS.UUID, "name": "user1" }],
                "transport": { "type": "ws", "path": CONFIG.VLESS.PATH }
            }
        ],
        "outbounds": [{ "type": "direct", "tag": "direct" }]
    };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

// ---------------------------------------------------------
// 5. 主启动流程
// ---------------------------------------------------------
async function main() {
    setIdentity(); 
    startWeb(); 
    
    // 打印当前服务器时间，方便调试时间同步问题
    console.log(`🕒 Server Time (UTC): ${new Date().toISOString()}`);

    if(fs.existsSync(CONFIG.TEMP_DIR)) fs.rmSync(CONFIG.TEMP_DIR, {recursive:true,force:true});
    fs.mkdirSync(CONFIG.TEMP_DIR);

    console.log('\n--- ⚡ System Startup (Sing-box VLESS) ---');

    // 1. 下载组件
    console.log('⬇️ Downloading EasyTier & Sing-box...');
    await download('https://github.com/EasyTier/EasyTier/releases/download/v2.4.5/easytier-linux-x86_64-v2.4.5.zip', path.join(CONFIG.TEMP_DIR, 'et.zip'));
    extractZip(path.join(CONFIG.TEMP_DIR, 'et.zip'), CONFIG.TEMP_DIR);
    
    await download('https://github.com/SagerNet/sing-box/releases/download/v1.9.0/sing-box-1.9.0-linux-amd64.tar.gz', path.join(CONFIG.TEMP_DIR, 'sb.tar.gz'));
    extractTarGz(path.join(CONFIG.TEMP_DIR, 'sb.tar.gz'), CONFIG.TEMP_DIR);

    // 2. 伪装进程名 (PHP/Nginx)
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
    
    fs.chmodSync(etBin, '755');
    fs.chmodSync(sbBin, '755');

    // 3. 启动 EasyTier (强制 TCP 模式，修复 Railway 断流)
    console.log('📡 Starting Network Layer (Force TCP)...');
    const etArgs = [
        '-i', CONFIG.ET.IP, 
        '--network-name', CONFIG.ET.NET_NAME, 
        '--network-secret', CONFIG.ET.NET_SECRET, 
        '-p', CONFIG.ET.PEER, 
        '-n', '0.0.0.0/0', 
        '--no-tun',
        '--mtu', '1100', // 优化 MTU
        // 🔴 关键配置：只监听 TCP/WS，彻底禁用 UDP
        '-l', 'tcp://0.0.0.0:11010', 
        '-l', 'ws://0.0.0.0:11011'
    ];
    spawn(etBin, etArgs, { stdio: 'inherit' });

    // 4. 启动 Sing-box
    console.log(`🔌 Starting Proxy Worker on port ${CONFIG.VLESS.PORT}...`);
    const sbConfigPath = path.join(CONFIG.TEMP_DIR, 'sb_config.json');
    generateSingboxConfig(sbConfigPath);
    spawn(sbBin, ['run', '-c', sbConfigPath], { stdio: 'inherit' });
    
    console.log(`✅ System Active. Access via /${CONFIG.SECRET_PATH}`);
    
    setInterval(()=>{}, 3600000); // 保持运行
}

main();
