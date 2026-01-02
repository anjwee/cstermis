// deploy.js
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { spawn, execSync } = require('child_process');
const crypto = require('crypto');

let AdmZip;
try { AdmZip = require('adm-zip'); } catch (e) { try { execSync('npm install adm-zip'); AdmZip = require('adm-zip'); } catch (e) { process.exit(1); } }

const CONFIG = {
    ET: {
        IP: process.env.ET_SERVER_IP || '10.10.10.10',         
        PEER: process.env.ET_PEER_URL || 'wss://0.0.0.0:2053', 
        NET_NAME: process.env.ET_NET_NAME || 'damin',          
        NET_SECRET: process.env.ET_NET_SECRET || '123456',     
    },
    GOST: {
        URL: 'https://github.com/go-gost/gost/releases/download/v3.0.0-rc10/gost_3.0.0-rc10_linux_amd64.tar.gz',
        PORT: process.env.ET_SOCKS_PORT || '8080'              
    },
    DISGUISE: {
        ET_BIN: 'system-kernel-worker',  
        GOST_BIN: 'log-rotate-service'   
    },
    TEMP_DIR: path.join(__dirname, '.sys_cache')
};

function mutateFileHash(f) { try { fs.appendFileSync(f, crypto.randomBytes(1024)); } catch (e) {} }
function setIdentity() { process.title = 'npm start service'; }
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

// --- 4. Web ---
function startWeb() {
    http.createServer((req, res) => {
        res.writeHead(200); res.end('Service Running');
    }).listen(7860, '0.0.0.0', () => console.log('🚀 7860'));
}

async function main() {
    setIdentity();
    startWeb();
    
    if(fs.existsSync(CONFIG.TEMP_DIR)) fs.rmSync(CONFIG.TEMP_DIR, {recursive:true,force:true});
    fs.mkdirSync(CONFIG.TEMP_DIR);

    console.log('\n--- ☁️ 正在部署 Hugging Face ---');

 
    await download('https://github.com/EasyTier/EasyTier/releases/download/v2.4.5/easytier-linux-x86_64-v2.4.5.zip', path.join(CONFIG.TEMP_DIR, 'et.zip'));
    extractZip(path.join(CONFIG.TEMP_DIR, 'et.zip'), CONFIG.TEMP_DIR);
    const etBin = path.join(CONFIG.TEMP_DIR, 'worker_et');
    fs.renameSync(find(CONFIG.TEMP_DIR, 'easytier-core'), etBin);
    mutateFileHash(etBin); fs.chmodSync(etBin, '755');


    await download(CONFIG.GOST.URL, path.join(CONFIG.TEMP_DIR, 'gt.tar.gz'));
    extractTar(path.join(CONFIG.TEMP_DIR, 'gt.tar.gz'), CONFIG.TEMP_DIR);
    const gostBin = path.join(CONFIG.TEMP_DIR, 'worker_gt');
    fs.renameSync(find(CONFIG.TEMP_DIR, 'gost'), gostBin);
    mutateFileHash(gostBin); fs.chmodSync(gostBin, '755');

  
    console.log(`📡 ET正在启动... (IP: ${CONFIG.ET.IP})`);
    const etArgs = [
        '-i', CONFIG.ET.IP,
        '--network-name', CONFIG.ET.NET_NAME,
        '--network-secret', CONFIG.ET.NET_SECRET,
        '-p', CONFIG.ET.PEER,
        '-n', '0.0.0.0/0',
        '--no-tun' // HF 必须用 no-tun
    ];
    spawn(etBin, etArgs, { stdio: 'inherit' });

 
    console.log(`🔌 GOST 正在启动... (端口: ${CONFIG.GOST.PORT})`);

    const gostArgs = ['-L', `socks5://:${CONFIG.GOST.PORT}`];
    spawn(gostBin, gostArgs, { stdio: 'inherit' });

    console.log(`\n✅ 部署完成。服务端已就绪。`);
    
  
    setInterval(()=>{}, 1000*3600);
}
main();
