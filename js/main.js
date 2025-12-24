// 全局变量
const MUSIC_REPO_URL = "https://25eqsg3f08-stack.github.io/private-music-repo/"; // 音乐库GitHub Pages地址
let musicList = []; // 所有歌曲列表
let filteredList = []; // 搜索过滤后的列表
let currentIndex = -1; // 当前播放索引
let isPlaying = false; // 播放状态
let isPlayPending = false; // 新增：防止play()和pause()操作冲突的状态锁

// DOM 元素
const audioPlayer = document.getElementById("audioPlayer");
const playPauseBtn = document.getElementById("playPauseBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const searchInput = document.getElementById("searchInput");
const musicListEl = document.getElementById("musicList");
const currentSongEl = document.getElementById("currentSong");

// 初始化：读取音乐库歌曲
async function initMusicList() {
    try {
        // 读取音乐库目录 HTML，设置10秒超时
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(MUSIC_REPO_URL, { 
            mode: "cors", 
            signal: controller.signal 
        });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`音乐库访问失败 [${response.status}]`);

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        // 筛选mp3和wmv音频文件
        const links = doc.querySelectorAll("a[href$='.mp3'], a[href$='.wav']"); 

        // 提取歌曲信息（URL + 去除后缀的歌名）
        musicList = Array.from(links).map(link => {
            const fileName = link.getAttribute("href").split("/").pop();
            const url = `${MUSIC_REPO_URL}${fileName}`;
            const name = fileName.replace(/\.(mp3|wmv)$/i, ""); // 移除文件后缀
            return { url, name };
        });

        filteredList = [...musicList]; // 初始化过滤列表
        renderMusicList(filteredList); // 渲染歌曲列表

        // 注册 Service Worker（离线缓存）
        if ("serviceWorker" in navigator) {
            try {
                await navigator.serviceWorker.register("./js/offlinecache.js");
                console.log("离线缓存Service Worker注册成功");
            } catch (err) {
                console.warn("离线缓存注册失败：", err);
            }
        }
    } catch (error) {
        console.error("读取音乐库失败：", error);
        currentSongEl.textContent = "音乐库加载失败，请检查网络或地址";
    }
}

// 渲染歌曲列表
function renderMusicList(list) {
    musicListEl.innerHTML = "";
    if (list.length === 0) {
        musicListEl.innerHTML = "<li>无匹配的歌曲</li>";
        return;
    }

    list.forEach((music, index) => {
        const li = document.createElement("li");
        li.textContent = music.name;
        li.dataset.index = index;
        li.addEventListener("click", () => playMusic(index));
        musicListEl.appendChild(li);
    });
}

// 播放指定索引的歌曲
function playMusic(index) {
    if (isPlayPending || index < 0 || index >= filteredList.length) return;

    currentIndex = index;
    const music = filteredList[currentIndex];
    audioPlayer.src = music.url;
    currentSongEl.textContent = music.name;

    // 更新列表激活状态
    document.querySelectorAll("#musicList li").forEach((li, i) => {
        li.classList.toggle("active", i === currentIndex);
    });

    // 播放歌曲并标记状态锁
    isPlayPending = true;
    audioPlayer.play().then(() => {
        isPlaying = true;
        playPauseBtn.textContent = "暂停";
        cacheCurrentMusic(music.url); // 缓存当前播放的歌曲
    }).catch(err => {
        console.error("歌曲播放失败：", err);
        currentSongEl.textContent = `播放失败：${music.name}`;
    }).finally(() => {
        isPlayPending = false; // 播放请求完成后解锁
    });
}

// 播放/暂停切换（修复AbortError冲突）
function togglePlayPause() {
    if (isPlayPending) return; // 播放请求未完成时，不响应新操作

    if (currentIndex === -1 && filteredList.length > 0) {
        playMusic(0); // 未选择歌曲时，默认播放第一首
        return;
    }

    if (isPlaying) {
        // 暂停逻辑
        audioPlayer.pause();
        isPlaying = false;
        playPauseBtn.textContent = "播放";
    } else {
        // 播放逻辑（加状态锁避免冲突）
        isPlayPending = true;
        audioPlayer.play().then(() => {
            isPlaying = true;
            playPauseBtn.textContent = "暂停";
        }).catch(err => {
            console.error("播放恢复失败：", err);
        }).finally(() => {
            isPlayPending = false;
        });
    }
}

// 上一曲
function playPrev() {
    if (filteredList.length === 0 || isPlayPending) return;
    currentIndex = (currentIndex - 1 + filteredList.length) % filteredList.length;
    playMusic(currentIndex);
}

// 下一曲
function playNext() {
    if (filteredList.length === 0 || isPlayPending) return;
    currentIndex = (currentIndex + 1) % filteredList.length;
    playMusic(currentIndex);
}

// 搜索过滤歌曲（实时匹配）
function filterMusic(e) {
    const keyword = e.target.value.trim().toLowerCase();
    filteredList = musicList.filter(music => 
        music.name.toLowerCase().includes(keyword)
    );
    renderMusicList(filteredList);
}

// 缓存当前播放的歌曲（通知Service Worker）
function cacheCurrentMusic(url) {
    if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
            type: "CACHE_MUSIC",
            url: url
        });
    }
}

// 音频播放结束自动切下一曲
audioPlayer.addEventListener("ended", playNext);

// 绑定按钮与输入框事件
playPauseBtn.addEventListener("click", togglePlayPause);
prevBtn.addEventListener("click", playPrev);
nextBtn.addEventListener("click", playNext);
searchInput.addEventListener("input", filterMusic);

// 页面加载完成后初始化音乐库
window.addEventListener("DOMContentLoaded", initMusicList);
