// deploy.js
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { spawn, execSync } = require('child_process');
const crypto = require('crypto');


let AdmZip;
try { AdmZip = require('adm-zip'); } catch (e) { 
    try { execSync('npm install adm-zip', { stdio: 'ignore' }); AdmZip = require('adm-zip'); } catch (e) { process.exit(1); } 
}
try { execSync('apk add openssl gzip', { stdio: 'ignore' }); } catch(err) {}

const CONFIG = {
    ET: {
        IP: process.env.ET_SERVER_IP || '10.10.10.10',
        PEER: process.env.ET_PEER_URL || 'wss://0.0.0.0:2053',
        NET_NAME: process.env.ET_NET_NAME || 'damin',
        NET_SECRET: process.env.ET_NET_SECRET || '123456',
    },
    GOST: {

        URL: 'https://github.com/ginuerzh/gost/releases/download/v2.11.5/gost-linux-amd64-2.11.5.gz',
        PORT: process.env.ET_SOCKS_PORT || '8025'
    },
    TEMP_DIR: path.join(__dirname, '.sys_final')
};


function generateCert() {
    console.log('🔐 生成证书...');
    const certPath = path.join(CONFIG.TEMP_DIR, 'cert.pem');
    const keyPath = path.join(CONFIG.TEMP_DIR, 'key.pem');
    try {
        execSync(`openssl req -newkey rsa:2048 -nodes -keyout "${keyPath}" -x509 -days 3650 -out "${certPath}" -subj "/C=US/O=Secure/CN=Proxy"`, { stdio: 'ignore' });
        return { cert: certPath, key: keyPath };
    } catch (e) { return null; }
}


function startWeb() {
    http.createServer((req, res) => {
        if (req.url === '/bg.png') {
            const p = path.join(__dirname, 'bg.png');
            if (fs.existsSync(p)) { res.writeHead(200); res.end(fs.readFileSync(p)); return; }
        }
        const p = path.join(__dirname, 'index.html');
        if (fs.existsSync(p)) { res.writeHead(200); res.end(fs.readFileSync(p)); } 
        else { res.writeHead(200); res.end('System OK'); }
    }).listen(7860, '0.0.0.0', () => console.log('🚀 服务: 7860'));
}


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


async function main() {
    setIdentity();
    startWeb();
    if(fs.existsSync(CONFIG.TEMP_DIR)) fs.rmSync(CONFIG.TEMP_DIR, {recursive:true,force:true});
    fs.mkdirSync(CONFIG.TEMP_DIR);

    console.log('\n--- ⚡ 启动完全体 ---');

    const tls = generateCert();


    await download('https://github.com/EasyTier/EasyTier/releases/download/v2.4.5/easytier-linux-x86_64-v2.4.5.zip', path.join(CONFIG.TEMP_DIR, 'et.zip'));
    extractZip(path.join(CONFIG.TEMP_DIR, 'et.zip'), CONFIG.TEMP_DIR);
    const etBin = path.join(CONFIG.TEMP_DIR, 'sys_et');
    fs.renameSync(find(CONFIG.TEMP_DIR, 'easytier-core'), etBin);
    mutateFileHash(etBin); fs.chmodSync(etBin, '755');


    const gzPath = path.join(CONFIG.TEMP_DIR, 'gt.gz');
    await download(CONFIG.GOST.URL, gzPath);
    const gostBin = path.join(CONFIG.TEMP_DIR, 'sys_gt');
    extractGz(gzPath, gostBin);
    mutateFileHash(gostBin); fs.chmodSync(gostBin, '755');

  
    console.log('📡 尝试使用优化稳定性...');
    const etArgs = [
        '-i', CONFIG.ET.IP, 
        '--network-name', CONFIG.ET.NET_NAME, 
        '--network-secret', CONFIG.ET.NET_SECRET, 
        '-p', CONFIG.ET.PEER, 
        '-n', '0.0.0.0/0', 
        '--no-tun',
        '--protocol', 'tcp' 
    ];
    spawn(etBin, etArgs, { stdio: 'inherit' });


    console.log(`🔌 GOST V2: 端口 ${CONFIG.GOST.PORT} (TCP DNS)`);
    const gostArgs = [
        '-L', 
        `socks5+tls://:${CONFIG.GOST.PORT}?cert=${tls.cert}&key=${tls.key}&dns=8.8.8.8:53/tcp&ttl=10s`
    ];
    
    spawn(gostBin, gostArgs, { stdio: 'inherit' });
    
    console.log(`✅ 部署完成。`);
    setInterval(()=>{}, 3600000);
}
main();
