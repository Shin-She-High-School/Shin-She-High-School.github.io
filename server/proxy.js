const express = require('express');
const cors = require('cors');
const https = require('https');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;
const TARGET_HOST = 'tchs.mlife.org.tw';

const agent = new https.Agent({
    rejectUnauthorized: false,
    checkServerIdentity: () => undefined,
    keepAlive: true
});

app.use(cors({
    origin: '*',
    credentials: true
}));

const INJECTED_SCRIPT = `
<script>
window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'REQUEST_SCORES') {
        const scoreMap = {};
        const rows = document.querySelectorAll('table tr');
        let rawFound = 0;

        rows.forEach(r => {
            const cols = r.querySelectorAll('td');
            if (cols.length >= 4) {
                const rawName = cols[1]?.innerText?.trim() || "";
                const statusText = cols[3]?.innerText?.trim() || cols[2]?.innerText?.trim() || "";
                const isPass = statusText.includes('及格') || statusText.includes('✔') || (parseFloat(statusText) >= 60);

                if (rawName && rawName.length > 1) {
                    const cleanName = rawName.replace(/\\s+/g, '');
                    scoreMap[cleanName] = isPass;
                    rawFound++;
                }
            }
        });

        window.parent.postMessage({
            type: 'RESPONSE_SCORES',
            scoreMap: scoreMap,
            rawFound: rawFound,
            isLoginPage: !!document.querySelector('input[type="password"]')
        }, '*');
    }
});
</script>
`;

app.use((req, res) => {
    const headers = { ...req.headers };
    delete headers.host;
    delete headers.connection;
    delete headers['content-length'];
    delete headers['accept-encoding']; // 避免 gzip 壓縮導致難以注入腳本

    headers['Host'] = TARGET_HOST;
    headers['Referer'] = `https://${TARGET_HOST}/Login.action?schNo=064328`;
    headers['Origin'] = `https://${TARGET_HOST}`;
    headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

    const options = {
        hostname: TARGET_HOST,
        port: 443,
        path: req.originalUrl,
        method: req.method,
        headers: headers,
        agent: agent,
        timeout: 25000
    };

    const proxyReq = https.request(options, (proxyRes) => {
        // 重寫重導向 Location
        if (proxyRes.headers.location) {
            proxyRes.headers.location = proxyRes.headers.location.replace(`https://${TARGET_HOST}`, '');
        }

        // 移除安全標頭以允許 iframe 嵌入
        delete proxyRes.headers['x-frame-options'];
        delete proxyRes.headers['content-security-policy'];

        // 調整 Set-Cookie 屬性相容 iframe
        if (proxyRes.headers['set-cookie']) {
            proxyRes.headers['set-cookie'] = proxyRes.headers['set-cookie'].map(c => {
                return c.replace(/;\s*Secure/gi, '')
                        .replace(/;\s*SameSite=(Lax|Strict)/gi, '; SameSite=None');
            });
        }

        const contentType = proxyRes.headers['content-type'] || '';
        const isHtml = contentType.includes('text/html');

        res.status(proxyRes.statusCode);

        Object.keys(proxyRes.headers).forEach(key => {
            if (!['content-length', 'transfer-encoding', 'content-encoding'].includes(key.toLowerCase())) {
                res.setHeader(key, proxyRes.headers[key]);
            }
        });
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-Frame-Options', 'ALLOWALL');

        if (isHtml) {
            let body = [];
            proxyRes.on('data', chunk => body.push(chunk));
            proxyRes.on('end', () => {
                let html = Buffer.concat(body).toString('utf-8');
                if (html.includes('</body>')) {
                    html = html.replace('</body>', `${INJECTED_SCRIPT}</body>`);
                } else {
                    html += INJECTED_SCRIPT;
                }
                res.setHeader('Content-Length', Buffer.byteLength(html));
                res.end(html);
            });
        } else {
            proxyRes.pipe(res);
        }
    });

    proxyReq.on('timeout', () => {
        proxyReq.destroy();
        console.error('[Proxy Error] 連線逾時 (Timeout)：學校伺服器未於 25 秒內回應');
        if (!res.headersSent) {
            res.status(504).send('連線逾時：學校成績系統伺服器無回應，可能是學校防火牆阻擋了海外雲端主機連線。');
        }
    });

    proxyReq.on('error', (err) => {
        console.error('[Proxy Request Error Details]:', err.code, err.message);
        if (!res.headersSent) {
            res.status(502).send(`連線至成績系統伺服器失敗 [${err.code || 'UNKNOWN'}]：${err.message}`);
        }
    });

    // 轉發 POST 資料流
    req.pipe(proxyReq);
});

app.listen(PORT, () => {
    console.log(`[Proxy Server] Running on Port ${PORT}`);
});
