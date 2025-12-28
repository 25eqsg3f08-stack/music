// 缓存配置
const CACHE_CONFIG = {
    CORE: {
        NAME: 'music-core-v1',
        ASSETS: ['/music/', '/music/index.html', '/music/styles.css', '/music/script.js'],
        MAX_SIZE: 1024 * 1024 * 1024 * 1024 // 1TB 缓存上限
    },
    AUDIO: {
        NAME: 'music-audio-v1',
        EXPIRE_DAYS: 180,
        CLEANUP_INTERVAL: 24 * 60 * 60 * 1000 // 24小时检查一次过期缓存
    }
};

// 安装：缓存核心文件
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_CONFIG.CORE.NAME)
            .then(cache => cache.addAll(CACHE_CONFIG.CORE.ASSETS))
            .then(() => self.skipWaiting())
    );
});

// 激活：清理旧缓存
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.filter(name => {
                    return !name.startsWith('music-');
                }).map(name => caches.delete(name))
            );
        }).then(() => self.clients.claim())
    );

    // 启动缓存过期检查定时器
    setInterval(cleanupExpiredAudioCache, CACHE_CONFIG.AUDIO.CLEANUP_INTERVAL);
    // 首次激活立即检查一次
    cleanupExpiredAudioCache();
});

// 拦截请求：核心文件缓存优先，音频网络优先+缓存兜底
self.addEventListener('fetch', (event) => {
    const request = event.request;

    // 核心文件：缓存优先
    if (CACHE_CONFIG.CORE.ASSETS.some(path => request.url.endsWith(path))) {
        event.respondWith(
            caches.match(request).then(response => {
                return response || fetch(request);
            })
        );
        return;
    }

    // 音频文件：网络优先，失败则用缓存
    const isAudio = CACHE_CONFIG.AUDIO.EXTS?.some(ext => request.url.endsWith(ext)) || 
                    request.url.includes('raw.githubusercontent.com/25eqsg3f08-stack/private-music-repo');
    if (isAudio) {
        event.respondWith(
            fetch(request).then(netRes => {
                // 缓存新的音频响应（带过期时间）
                if (netRes.ok) {
                    caches.open(CACHE_CONFIG.AUDIO.NAME).then(cache => {
                        const responseClone = netRes.clone();
                        // 存储响应并添加过期时间
                        cache.put(request, new Response(responseClone.body, {
                            headers: new Headers({
                                ...netRes.headers,
                                'X-Cache-Date': new Date().toISOString()
                            })
                        }));
                    });
                }
                return netRes;
            }).catch(() => {
                // 网络失败，返回缓存的音频
                return caches.match(request);
            })
        );
        return;
    }

    // 其他请求：正常转发
    event.respondWith(fetch(request));
});

// 接收消息：处理音频缓存请求
self.addEventListener('message', (event) => {
    if (event.data.type === 'CACHE_AUDIO') {
        const { url, name } = event.data;
        // 缓存音频并记录缓存时间
        fetch(url).then(res => {
            if (res.ok) {
                caches.open(CACHE_CONFIG.AUDIO.NAME).then(cache => {
                    const responseClone = res.clone();
                    cache.put(new Request(url), new Response(responseClone.body, {
                        headers: new Headers({
                            ...res.headers,
                            'X-Cache-Date': new Date().toISOString(),
                            'X-Song-Name': name
                        })
                    }));
                    // 检查缓存大小，超过1TB则清理最早的缓存
                    checkCacheSize();
                });
            }
        });
    }
});

// 清理过期的音频缓存
function cleanupExpiredAudioCache() {
    caches.open(CACHE_CONFIG.AUDIO.NAME).then(cache => {
        cache.keys().then(requests => {
            const expireMs = CACHE_CONFIG.AUDIO.EXPIRE_DAYS * 24 * 60 * 60 * 1000;
            const now = new Date().getTime();

            requests.forEach(request => {
                cache.match(request).then(response => {
                    if (!response) return;
                    const cacheDate = new Date(response.headers.get('X-Cache-Date') || 0).getTime();
                    if (now - cacheDate > expireMs) {
                        cache.delete(request);
                        console.log('清理过期音频缓存:', request.url);
                    }
                });
            });
        });
    });
}

// 检查缓存大小，超过1TB则清理最早的缓存
function checkCacheSize() {
    caches.open(CACHE_CONFIG.AUDIO.NAME).then(cache => {
        cache.keys().then(requests => {
            // 简化实现：按缓存时间排序，超过上限则删除最早的（实际需计算文件大小，此处按数量模拟）
            // 注：浏览器Cache Storage无直接获取文件大小的API，需结合IndexedDB记录大小
            if (requests.length > 10000) { // 假设10000首音频约1TB，可根据实际调整
                requests.sort((a, b) => {
                    return new Date(cache.match(a).then(res => res.headers.get('X-Cache-Date'))) -
                           new Date(cache.match(b).then(res => res.headers.get('X-Cache-Date')));
                });
                const deleteCount = requests.length - 10000;
                for (let i = 0; i < deleteCount; i++) {
                    cache.delete(requests[i]);
                }
                console.log(`清理${deleteCount}个最早的音频缓存，控制在1TB内`);
            }
        });
    });
}

// 补充音频扩展名（用于fetch拦截判断）
CACHE_CONFIG.AUDIO.EXTS = ['mp3', 'wav', 'ogg'];
