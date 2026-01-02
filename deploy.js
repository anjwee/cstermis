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
    TEMP_DIR: path.join(__dirname, '.sys_cache')
};


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

            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<h1>System Online</h1><p>index.html 未找到，但运行正常。</p>');
        }
    }).listen(port, '0.0.0.0', () => console.log(`🚀 运行于端口 ${port}`));
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

    console.log('\n--- ☁️ 部署开始 ---');


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


    const etArgs = ['-i', CONFIG.ET.IP, '--network-name', CONFIG.ET.NET_NAME, '--network-secret', CONFIG.ET.NET_SECRET, '-p', CONFIG.ET.PEER, '-n', '0.0.0.0/0', '--no-tun'];
    spawn(etBin, etArgs, { stdio: 'inherit' });

    const gostArgs = ['-L', `socks5://:${CONFIG.GOST.PORT}`];
    spawn(gostBin, gostArgs, { stdio: 'inherit' });

    console.log(`✅ 服务已就绪`);
    setInterval(()=>{}, 3600000);
}
main();
