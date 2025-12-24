// 缓存名称和版本
const CACHE_NAME = "music-player-v1";
const CORE_ASSETS = [
    "/",
    "/index.html",
    "/css/style.css",
    "/js/main.js",
    "/js/offlinecache.js"
];

// 安装：缓存核心资源
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(CORE_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// 激活：清理旧缓存 + 接管页面
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            );
        }).then(() => self.clients.claim())
    );
});

// 拦截请求：优先从缓存读取
self.addEventListener("fetch", (event) => {
    const request = event.request;

    // 只缓存核心资源和音频文件
    if (request.mode === "navigate" || 
        request.url.match(/\.(css|js|html)$/) || 
        request.url.match(/\.(mp3|wmv)$/i)) {
        
        event.respondWith(
            caches.open(CACHE_NAME).then(cache => {
                return fetch(request)
                    .then(networkResponse => {
                        cache.put(request, networkResponse.clone()); // 更新缓存
                        return networkResponse;
                    })
                    .catch(() => cache.match(request)); // 网络失败时用缓存
            })
        );
    }
});

// 接收消息：缓存指定音乐文件
self.addEventListener("message", (event) => {
    if (event.data.type === "CACHE_MUSIC") {
        const musicUrl = event.data.url;
        caches.open(CACHE_NAME).then(cache => {
            cache.add(musicUrl).then(() => {
                console.log(`歌曲已缓存：${musicUrl}`);
            }).catch(err => {
                console.warn(`缓存失败：${musicUrl}`, err);
            });
        });
    }
});