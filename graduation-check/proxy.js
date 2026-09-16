const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 3000;
const TARGET_HOST = 'https://tchs.mlife.org.tw';

// 允許跨來源請求
app.use(cors({
    origin: '*',
    credentials: true
}));

// 設定中繼轉發路由
app.use('/', createProxyMiddleware({
    target: TARGET_HOST,
    changeOrigin: true,
    secure: false,
    cookieDomainRewrite: "",
    on: {
        proxyReq: (proxyReq, req, res) => {
            // 偽裝來源標頭，防止目標主機防盜連阻擋
            proxyReq.setHeader('Referer', `${TARGET_HOST}/Login.action?schNo=064328`);
            proxyReq.setHeader('Origin', TARGET_HOST);
        },
        proxyRes: (proxyRes, req, res) => {
            // 移除限制 iframe 嵌入的安全標頭
            delete proxyRes.headers['x-frame-options'];
            delete proxyRes.headers['content-security-policy'];

            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('X-Frame-Options', 'ALLOWALL');

            // 調整 Cookie 屬性以維持登入 Session
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
});