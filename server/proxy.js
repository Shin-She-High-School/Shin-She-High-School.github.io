const express = require('express');
const cors = require('cors');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 10000;
const TARGET_HOST = 'tchs.mlife.org.tw';

// 建立相容舊版 TLS/SSL 憑證的 Agent
const agent = new https.Agent({
    rejectUnauthorized: false,
    checkServerIdentity: () => undefined,
    keepAlive: true
});

app.use(cors({
    origin: '*',
    credentials: true
}));

// 注入至校務系統的自動化解析與輪詢腳本
const INJECTED_SCRIPT = `
<script>
(function initAutoScraper() {
    // 若在登入頁則不動作，等待使用者輸入帳密與驗證碼
    if (document.querySelector('input[type="password"]') || window.location.href.includes('Login.action')) {
        return;
    }

    console.log('[AutoScraper] 偵測到已進入系統，準備自動導航至成績查詢...');

    // 建立提示遮罩
    const overlay = document.createElement('div');
    overlay.id = '__auto_scrape_overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(15, 23, 42, 0.88)';
    overlay.style.zIndex = '999999';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.color = '#ffffff';
    overlay.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    overlay.innerHTML = \`
        <div style="width: 48px; height: 48px; border: 4px solid #6366f1; border-top-color: transparent; border-radius: 50%; animation: spin 0.9s linear infinite; margin-bottom: 16px;"></div>
        <div id="__scrape_status_text" style="font-size: 16px; font-weight: bold; margin-bottom: 8px;">登入成功！正在自動切換至成績查詢...</div>
        <div style="font-size: 12px; color: #94a3b8;">請勿關閉視窗，系統正在自動擷取全學期學分資料</div>
        <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
    \`;
    document.body.appendChild(overlay);

    const setStatus = (msg) => {
        const el = document.getElementById('__scrape_status_text');
        if (el) el.innerText = msg;
    };

    const sleep = (ms) => new Promise(res => setTimeout(res, ms));

    async function runAutoPipeline() {
        try {
            await sleep(800);

            // 1. 自動尋找並點擊「查詢個人成績」
            setStatus('正在進入「查詢個人成績」選單...');
            const allElements = Array.from(document.querySelectorAll('a, span, div, li'));
            let scoreLink = allElements.find(el => el.innerText && el.innerText.trim() === '查詢個人成績');

            if (!scoreLink) {
                // 若選單尚未展開，先點開「各項查詢」
                const groupMenu = allElements.find(el => el.innerText && el.innerText.includes('各項查詢'));
                if (groupMenu) {
                    groupMenu.click();
                    await sleep(600);
                    scoreLink = Array.from(document.querySelectorAll('a, span, div, li')).find(el => el.innerText && el.innerText.trim() === '查詢個人成績');
                }
            }
            if (scoreLink) {
                scoreLink.click();
            }

            // 2. 等待學期表格渲染
            setStatus('等待成績表格載入...');
            let maxRetries = 30;
            while (maxRetries-- > 0) {
                await sleep(500);
                const hasTermList = Array.from(document.querySelectorAll('tr, td')).some(el => /(11[3-5])\\s+[1-2]\\s+/.test(el.innerText || ''));
                if (hasTermList || document.querySelector('table tr td')) break;
            }

            const scoreMap = {};

            // 輔助函式：精準萃取目前表格的科目與「取得學分數(是/否)」
            function extractTableData() {
                const rows = document.querySelectorAll('table tr');
                rows.forEach(r => {
                    const text = r.innerText.trim();
                    if (!text || text.includes('科目') || text.includes('公布日期')) return;

                    const cols = Array.from(r.querySelectorAll('td')).map(td => td.innerText.trim());
                    if (cols.length >= 5) {
                        const courseName = cols[1]?.replace(/\\s+/g, '');
                        const creditStatus = cols[4]; // 取得學分數欄位: "是" 或 "否"
                        const finalScore = parseFloat(cols[5]);

                        if (courseName && (creditStatus === '是' || creditStatus === '否')) {
                            scoreMap[courseName] = (creditStatus === '是');
                        } else if (courseName && !isNaN(finalScore)) {
                            scoreMap[courseName] = finalScore >= 60;
                        }
                    }
                });
            }

            // 3. 搜尋左上角學期清單（113-1 至 115-2）並自動點擊
            const termRows = Array.from(document.querySelectorAll('table tr, tr')).filter(el => {
                const t = el.innerText || '';
                return /(11[3-5])\\s+([1-2])\\s+(商|高|體|農|園)/.test(t);
            });

            if (termRows.length > 0) {
                for (let i = 0; i < termRows.length; i++) {
                    const row = termRows[i];
                    const termLabelMatch = (row.innerText || '').match(/(11[3-5])\\s+([1-2])/);
                    const label = termLabelMatch ? \`\${termLabelMatch[1]}學年第\${termLabelMatch[2]}學期\` : \`第 \${i+1} 個學期\`;
                    setStatus(\`正在自動擷取 \${label} 成績...\`);
                    row.click();
                    await sleep(800); // 等待 Ajax 表格替換
                    extractTableData();
                }
            } else {
                extractTableData();
            }

            setStatus('學分分析完成！正在回傳資料...');
            await sleep(400);

            // 4. 回傳給畢業檢核系統前端
            window.parent.postMessage({
                type: 'AUTO_SCRAPE_COMPLETED',
                scoreMap: scoreMap,
                count: Object.keys(scoreMap).length
            }, '*');

        } catch (err) {
            console.error('[AutoScraper Error]', err);
            setStatus('自動擷取過程發生問題，請手動確認成績頁面。');
        }
    }

    runAutoPipeline();
})();
</script>
`;

app.use((req, res) => {
    const headers = { ...req.headers };
    delete headers.host;
    delete headers.connection;
    delete headers['content-length'];
    delete headers['accept-encoding']; // 停用 gzip 以便注入字串

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
        if (proxyRes.headers.location) {
            proxyRes.headers.location = proxyRes.headers.location.replace(`https://${TARGET_HOST}`, '');
        }

        // 解除 iframe 嵌入限制
        delete proxyRes.headers['x-frame-options'];
        delete proxyRes.headers['content-security-policy'];

        // 調整 cookie 以相容 iframe
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
        if (!res.headersSent) {
            res.status(504).send('連線逾時：無法連線至新社高中伺服器。');
        }
    });

    proxyReq.on('error', (err) => {
        console.error('[Proxy Request Error]:', err.code, err.message);
        if (!res.headersSent) {
            res.status(502).send(`連線失敗 [${err.code || 'UNKNOWN'}]: ${err.message}`);
        }
    });

    req.pipe(proxyReq);
});

app.listen(PORT, () => {
    console.log(`[Proxy Server] Running on Port ${PORT}`);
});