// 全局变量
const MUSIC_REPO_URL = "https://github.com/25eqsg3f08-stack/private-music-repo"; // 音乐库地址
let musicList = []; // 所有歌曲列表
let filteredList = []; // 搜索过滤后的列表
let currentIndex = -1; // 当前播放索引
let isPlaying = false; // 播放状态

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
        // 读取音乐库目录 HTML
        const response = await fetch(MUSIC_REPO_URL, { mode: "cors", timeout: 10000 });
        if (!response.ok) throw new Error("音乐库访问失败");

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const links = doc.querySelectorAll("a[href$='.mp3'], a[href$='.wmv']"); // 筛选音频文件

        // 提取歌曲信息（URL + 文件名）
        musicList = Array.from(links).map(link => {
            const url = MUSIC_REPO_URL + link.getAttribute("href").split("/").pop();
            const name = link.textContent.trim().replace(/\.(mp3|wmv)$/i, ""); // 去除后缀
            return { url, name };
        });

        filteredList = [...musicList]; // 初始化过滤列表
        renderMusicList(filteredList); // 渲染列表

        // 注册 Service Worker（离线缓存）
        if ("serviceWorker" in navigator) {
            try {
                await navigator.serviceWorker.register("./js/offlinecache.js");
                console.log("离线缓存已启用");
            } catch (err) {
                console.warn("离线缓存注册失败：", err);
            }
        }
    } catch (error) {
        console.error("读取音乐库失败：", error);
        currentSongEl.textContent = "音乐库加载失败";
    }
}

// 渲染歌曲列表
function renderMusicList(list) {
    musicListEl.innerHTML = "";
    if (list.length === 0) {
        musicListEl.innerHTML = "<li>无匹配歌曲</li>";
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
    if (index < 0 || index >= filteredList.length) return;

    currentIndex = index;
    const music = filteredList[currentIndex];
    audioPlayer.src = music.url;
    currentSongEl.textContent = music.name;

    // 更新列表激活状态
    document.querySelectorAll("#musicList li").forEach((li, i) => {
        li.classList.toggle("active", i === currentIndex);
    });

    // 播放并通知缓存
    audioPlayer.play().then(() => {
        isPlaying = true;
        playPauseBtn.textContent = "暂停";
        cacheCurrentMusic(music.url); // 缓存当前歌曲
    }).catch(err => {
        console.error("播放失败：", err);
        currentSongEl.textContent = "播放失败";
    });
}

// 播放/暂停切换
function togglePlayPause() {
    if (currentIndex === -1 && filteredList.length > 0) {
        playMusic(0); // 未选择歌曲时，默认播放第一首
        return;
    }

    if (isPlaying) {
        audioPlayer.pause();
        playPauseBtn.textContent = "播放";
    } else {
        audioPlayer.play();
        playPauseBtn.textContent = "暂停";
    }
    isPlaying = !isPlaying;
}

// 上一曲
function playPrev() {
    if (filteredList.length === 0) return;
    currentIndex = (currentIndex - 1 + filteredList.length) % filteredList.length;
    playMusic(currentIndex);
}

// 下一曲
function playNext() {
    if (filteredList.length === 0) return;
    currentIndex = (currentIndex + 1) % filteredList.length;
    playMusic(currentIndex);
}

// 搜索过滤歌曲
function filterMusic(e) {
    const keyword = e.target.value.trim().toLowerCase();
    filteredList = musicList.filter(music => 
        music.name.toLowerCase().includes(keyword)
    );
    renderMusicList(filteredList);
}

// 缓存当前播放的歌曲（通知 Service Worker）
function cacheCurrentMusic(url) {
    if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
            type: "CACHE_MUSIC",
            url: url
        });
    }
}

// 音频播放结束自动下一曲
audioPlayer.addEventListener("ended", playNext);

// 绑定事件
playPauseBtn.addEventListener("click", togglePlayPause);
prevBtn.addEventListener("click", playPrev);
nextBtn.addEventListener("click", playNext);
searchInput.addEventListener("input", filterMusic);

// 初始化
window.addEventListener("DOMContentLoaded", initMusicList);