const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 3000;
const TARGET_HOST = 'https://tchs.mlife.org.tw';

<<<<<<< HEAD
// 允許跨來源請求
=======
// 啟用 CORS
>>>>>>> a8c092c (update: auto sync project files 2026/09/17  2:16:36.29)
app.use(cors({
    origin: '*',
    credentials: true
}));

<<<<<<< HEAD
// 設定中繼轉發路由
=======
// ----------------------------------------------------
// 【關鍵修正】：/ping 必須放在代理中繼前面！
// 這樣呼叫 /ping 時會直接本地回應 200，不會轉發給學校網站
// ----------------------------------------------------
app.get('/ping', (req, res) => {
    res.status(200).send('OK - Server is awake!');
});

// 伺服器自我保活定時器 (每 14 分鐘請求一次自身 /ping)
const SERVER_URL = process.env.RENDER_EXTERNAL_URL || `https://shin-she-high-school-github-io.onrender.com`;
setInterval(async () => {
    try {
        const response = await fetch(`${SERVER_URL}/ping`);
        console.log(`[Self-Ping] 保活成功: ${response.status} (${new Date().toLocaleTimeString()})`);
    } catch (err) {
        console.warn('[Self-Ping] 請求失敗:', err.message);
    }
}, 14 * 60 * 1000);

// ----------------------------------------------------
// 其他所有請求才轉發給成績系統
// ----------------------------------------------------
>>>>>>> a8c092c (update: auto sync project files 2026/09/17  2:16:36.29)
app.use('/', createProxyMiddleware({
    target: TARGET_HOST,
    changeOrigin: true,
    secure: false,
    cookieDomainRewrite: "",
    on: {
        proxyReq: (proxyReq, req, res) => {
<<<<<<< HEAD
            // 偽裝來源標頭，防止目標主機防盜連阻擋
=======
>>>>>>> a8c092c (update: auto sync project files 2026/09/17  2:16:36.29)
            proxyReq.setHeader('Referer', `${TARGET_HOST}/Login.action?schNo=064328`);
            proxyReq.setHeader('Origin', TARGET_HOST);
        },
        proxyRes: (proxyRes, req, res) => {
<<<<<<< HEAD
            // 移除限制 iframe 嵌入的安全標頭
=======
>>>>>>> a8c092c (update: auto sync project files 2026/09/17  2:16:36.29)
            delete proxyRes.headers['x-frame-options'];
            delete proxyRes.headers['content-security-policy'];

            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('X-Frame-Options', 'ALLOWALL');

<<<<<<< HEAD
            // 調整 Cookie 屬性以維持登入 Session
=======
>>>>>>> a8c092c (update: auto sync project files 2026/09/17  2:16:36.29)
            if (proxyRes.headers['set-cookie']) {
                proxyRes.headers['set-cookie'] = proxyRes.headers['set-cookie'].map(cookie => {
                    return cookie
                        .replace(/;\s*Secure/gi, '')
                        .replace(/;\s*SameSite=Lax/gi, '; SameSite=None')
                        .replace(/;\s*SameSite=Strict/gi, '; SameSite=None');
                });
            }
        }
    }
}));

app.listen(PORT, () => {
    console.log(`[Proxy Server] 伺服器啟動於連接埠 ${PORT}`);
<<<<<<< HEAD
});
=======
});
>>>>>>> a8c092c (update: auto sync project files 2026/09/17  2:16:36.29)
