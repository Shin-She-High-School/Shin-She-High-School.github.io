const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const TARGET_ORIGIN = 'https://tchs.mlife.org.tw';

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

app.use(async (req, res) => {
    const targetUrl = TARGET_ORIGIN + req.originalUrl;

    try {
        const forwardHeaders = {};
        for (const [key, value] of Object.entries(req.headers)) {
            if (!['host', 'connection', 'content-length'].includes(key.toLowerCase())) {
                forwardHeaders[key] = value;
            }
        }
        forwardHeaders['host'] = 'tchs.mlife.org.tw';
        forwardHeaders['referer'] = `${TARGET_ORIGIN}/Login.action?schNo=064328`;
        forwardHeaders['origin'] = TARGET_ORIGIN;
        forwardHeaders['user-agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

        let bodyData = null;
        if (!['GET', 'HEAD'].includes(req.method)) {
            const chunks = [];
            for await (const chunk of req) {
                chunks.push(chunk);
            }
            bodyData = Buffer.concat(chunks);
        }

        const response = await fetch(targetUrl, {
            method: req.method,
            headers: forwardHeaders,
            body: bodyData,
            redirect: 'manual'
        });

        res.status(response.status);

        response.headers.forEach((val, key) => {
            const lKey = key.toLowerCase();
            if (['x-frame-options', 'content-security-policy', 'content-encoding', 'transfer-encoding'].includes(lKey)) {
                return;
            }
            if (lKey === 'location') {
                const rewritten = val.replace(TARGET_ORIGIN, '');
                res.setHeader('location', rewritten);
                return;
            }
            if (lKey === 'set-cookie') {
                return;
            }
            res.setHeader(key, val);
        });

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-Frame-Options', 'ALLOWALL');

        const rawCookies = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
        if (rawCookies.length > 0) {
            const fixedCookies = rawCookies.map(c => {
                return c.replace(/;\s*Secure/gi, '')
                        .replace(/;\s*SameSite=(Lax|Strict)/gi, '; SameSite=None');
            });
            res.setHeader('set-cookie', fixedCookies);
        }

        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('text/html')) {
            let html = await response.text();
            if (html.includes('</body>')) {
                html = html.replace('</body>', `${INJECTED_SCRIPT}</body>`);
            } else {
                html += INJECTED_SCRIPT;
            }
            res.setHeader('content-length', Buffer.byteLength(html));
            res.send(html);
        } else {
            const arrayBuffer = await response.arrayBuffer();
            res.send(Buffer.from(arrayBuffer));
        }

    } catch (err) {
        if (!res.headersSent) {
            res.status(502).send('連線至成績系統伺服器失敗，請確認該系統服務正常。');
        }
    }
});

app.listen(PORT, () => {
    console.log(`[Proxy Server] Port ${PORT}`);
});