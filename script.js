// 配置项
const CONFIG = {
    REPO_API: 'https://api.github.com/repos/25eqsg3f08-stack/private-music-repo/contents/',
    RAW_BASE: 'https://raw.githubusercontent.com/25eqsg3f08-stack/private-music-repo/main/',
    AUDIO_EXTS: ['mp3', 'wav', 'ogg'],
    CACHE_EXPIRE_DAYS: 180,
    SKIP_SECONDS: 10 // 前进/后退秒数
};

// 全局变量
let musicList = [];
let currentIndex = 0;
let audio = new Audio();
let isPlaying = false;
let audioDuration = 0; // 新增：存储音频总时长，避免重复读取

// DOM元素
const dom = {
    songTitle: document.getElementById('song-title'),
    currentTime: document.getElementById('current-time'),
    totalTime: document.getElementById('total-time'),
    progressBar: document.getElementById('progress-bar'),
    playPauseBtn: document.getElementById('play-pause-btn'),
    prevBtn: document.getElementById('prev-btn'),
    nextBtn: document.getElementById('next-btn'),
    forwardBtn: document.getElementById('forward-btn'),
    backwardBtn: document.getElementById('backward-btn'),
    status: document.getElementById('status')
};

// 初始化
async function init() {
    updateNetworkStatus();
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);

    try {
        await fetchMusicList();
        if (musicList.length > 0) {
            loadSong(currentIndex);
            bindEvents();
        } else {
            dom.status.textContent = '音乐仓库中无可用音频文件';
        }
    } catch (err) {
        dom.status.textContent = `获取音乐列表失败: ${err.message}`;
        console.error(err);
    }
}

// 获取GitHub仓库中的音乐列表
async function fetchMusicList() {
    dom.status.textContent = '正在获取音乐列表...';
    const res = await fetch(CONFIG.REPO_API);
    if (!res.ok) throw new Error(`请求失败 (${res.status})`);
    
    const files = await res.json();
    musicList = files
        .filter(file => {
            if (file.type !== 'file') return false;
            const ext = file.name.split('.').pop().toLowerCase();
            return CONFIG.AUDIO_EXTS.includes(ext);
        })
        .map(file => ({
            name: file.name.replace(/\.[^/.]+$/, ''),
            url: CONFIG.RAW_BASE + file.name
        }));
}

// 加载指定歌曲
function loadSong(index) {
    if (index < 0 || index >= musicList.length) return;
    
    const song = musicList[index];
    audio.src = song.url;
    dom.songTitle.textContent = song.name;
    dom.progressBar.value = 0;
    dom.currentTime.textContent = '00:00';
    audioDuration = 0; // 重置总时长
    
    // 音频加载完成后更新总时长
    audio.onloadedmetadata = () => {
        audioDuration = audio.duration; // 存储总时长
        dom.totalTime.textContent = formatTime(audioDuration);
        dom.progressBar.max = audioDuration;
    };

    // 播放状态重置
    isPlaying = false;
    dom.playPauseBtn.textContent = '播放';
    dom.status.textContent = `已加载: ${song.name}`;
}

// 播放/暂停切换
function togglePlayPause() {
    if (isNaN(audioDuration) || audioDuration === 0) {
        alert('音频未加载完成，请稍候');
        return;
    }
    if (isPlaying) {
        audio.pause();
        dom.playPauseBtn.textContent = '播放';
    } else {
        audio.play();
        dom.playPauseBtn.textContent = '暂停';
    }
    isPlaying = !isPlaying;
}

// 上一曲
function playPrev() {
    currentIndex = (currentIndex - 1 + musicList.length) % musicList.length;
    loadSong(currentIndex);
    if (isPlaying) audio.play();
}

// 下一曲（并触发缓存）
function playNext() {
    currentIndex = (currentIndex + 1) % musicList.length;
    const nextSong = musicList[currentIndex];
    if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
            type: 'CACHE_AUDIO',
            url: nextSong.url,
            name: nextSong.name
        });
        dom.status.textContent = `正在缓存: ${nextSong.name}，稍后播放`;
    }
    loadSong(currentIndex);
    if (isPlaying) audio.play();
}

// 修复：前进10秒 - 严格边界判断
function skipForward() {
    if (isNaN(audioDuration) || audioDuration === 0) {
        alert('音频未加载完成');
        return;
    }
    const newTime = audio.currentTime + CONFIG.SKIP_SECONDS;
    // 确保不超过总时长
    audio.currentTime = newTime > audioDuration ? audioDuration : newTime;
    updateProgress();
}

// 修复：后退10秒 - 严格边界判断
function skipBackward() {
    if (isNaN(audioDuration) || audioDuration === 0) {
        alert('音频未加载完成');
        return;
    }
    const newTime = audio.currentTime - CONFIG.SKIP_SECONDS;
    // 确保不小于0
    audio.currentTime = newTime < 0 ? 0 : newTime;
    updateProgress();
}

// 更新播放进度
function updateProgress() {
    if (isNaN(audioDuration) || audioDuration === 0) return;
    dom.progressBar.value = audio.currentTime;
    dom.currentTime.textContent = formatTime(audio.currentTime);
}

// 格式化时间（秒 -> mm:ss）
function formatTime(seconds) {
    if (isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// 更新网络状态提示
function updateNetworkStatus() {
    const isOnline = navigator.onLine;
    dom.status.textContent = isOnline 
        ? '在线状态，可获取最新音乐' 
        : '离线状态，仅播放已缓存音乐';
}

// 绑定事件
function bindEvents() {
    dom.playPauseBtn.addEventListener('click', togglePlayPause);
    dom.prevBtn.addEventListener('click', playPrev);
    dom.nextBtn.addEventListener('click', playNext);
    dom.forwardBtn.addEventListener('click', skipForward);
    dom.backwardBtn.addEventListener('click', skipBackward);
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('ended', playNext);
}

// 启动初始化
init();
