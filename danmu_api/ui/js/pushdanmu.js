// language=JavaScript
export const pushDanmuJsContent = /* javascript */ `
/* ========================================
   推送状态管理
   ======================================== */
let selectedAnime = null;
let currentEpisodes = [];
let pushHistory = [];
let scanAbortController = null;
/* ========================================
   初始化推送弹幕界面
   ======================================== */
function initPushDanmuInterface() {
    const searchKeywordInput = document.getElementById('push-search-keyword');
    if (searchKeywordInput) {
        // 添加回车键搜索事件监听
        searchKeywordInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                searchAnimeForPush();
            }
        });
    }
}
/* ========================================
   推送预设配置
   ======================================== */
const pushPresets = {
    okvideo: {
        name: 'OK影视',
        port: 9978,
        path: '/action?do=refresh&type=danmaku&path='
    },
    kodi: {
        name: 'Kodi',
        port: 8080,
        path: '/jsonrpc?request='
    },
    potplayer: {
        name: 'PotPlayer',
        port: 10800,
        path: '/danmaku?url='
    }
};

/* ========================================
   应用推送预设
   ======================================== */
function applyPushPreset(presetKey) {
    const preset = pushPresets[presetKey];
    if (!preset) return;
    
    const pushUrlInput = document.getElementById('push-url');
    const subnetInput = document.getElementById('lanSubnet');
    const portInput = document.getElementById('lanPort');
    const subnet = subnetInput ? subnetInput.value.trim() : '192.168.1';
    
    // 同步更新端口输入框
    if (portInput) {
        portInput.value = preset.port;
        // 添加端口变化动画
        portInput.style.animation = 'pulse 0.4s ease-out';
        setTimeout(() => {
            portInput.style.animation = '';
        }, 400);
    }
    
    // 使用网段的前缀加上占位符
    const url = \`http://\${subnet}.x:\${preset.port}\${preset.path}\`;
    pushUrlInput.value = url;
    
    // 添加动画效果
    pushUrlInput.style.animation = 'pulse 0.4s ease-out';
    setTimeout(() => {
        pushUrlInput.style.animation = '';
    }, 400);
    
    addLog(\`📋 已应用预设: \${preset.name} (端口: \${preset.port})\`, 'success');
    customAlert(\`已应用 \${preset.name} 预设\\n\\n端口已设置为 \${preset.port}\\n请将地址中的 "x" 替换为实际设备IP，或使用下方的局域网扫描功能自动发现设备。\`, '✅ 预设已应用');
}

/* ========================================
   扫描局域网设备
   ======================================== */
async function scanLanDevices() {
    const subnetInput = document.getElementById('lanSubnet');
    const portInput = document.getElementById('lanPort');
    const scanBtn = document.getElementById('scanLanBtn');
    const devicesList = document.getElementById('lanDevicesList');
    const subnet = subnetInput.value.trim();
    const port = parseInt(portInput.value.trim()) || 9978;
    
    if (!subnet) {
        customAlert('请输入网段，例如: 192.168.1', '⚠️ 提示');
        subnetInput.focus();
        return;
    }
    
    // 验证网段格式
    const subnetPattern = /^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$/;
    if (!subnetPattern.test(subnet)) {
        customAlert('网段格式不正确，请输入如: 192.168.1', '⚠️ 格式错误');
        subnetInput.focus();
        return;
    }
    
    // 验证端口范围
    if (port < 1 || port > 65535) {
        customAlert('端口范围应为 1-65535', '⚠️ 端口错误');
        portInput.focus();
        return;
    }
    
    // 根据端口获取设备类型信息
    const getDeviceInfo = (portNum) => {
        const portInfoMap = {
            9978: { type: 'OK影视', icon: '📺' },
            8080: { type: 'Kodi / Web服务', icon: '🎬' },
            10800: { type: 'PotPlayer', icon: '🎵' },
            80: { type: 'Web服务', icon: '🌐' },
            8888: { type: '媒体服务', icon: '📡' },
            443: { type: 'HTTPS服务', icon: '🔒' },
            8096: { type: 'Jellyfin', icon: '🎞️' },
            8920: { type: 'Emby', icon: '🎥' },
            32400: { type: 'Plex', icon: '🍿' }
        };
        return portInfoMap[portNum] || { type: \`端口 \${portNum}\`, icon: '📱' };
    };
    
    const deviceInfo = getDeviceInfo(port);
    
    // 保存原始按钮状态
    const originalHTML = scanBtn.innerHTML;
    scanBtn.innerHTML = '<span class="loading-spinner-small"></span> 扫描中...';
    scanBtn.disabled = true;
    
    // 显示扫描进度
    devicesList.innerHTML = \`
        <div class="lan-scan-progress">
            <div class="scan-progress-bar">
                <div class="scan-progress-fill" id="scanProgressFill"></div>
            </div>
            <div class="scan-progress-text" id="scanProgressText">正在扫描 \${subnet}.1:\${port} - \${subnet}.254:\${port} ...</div>
        </div>
    \`;
    
    addLog(\`🔍 开始扫描局域网: \${subnet}.1-254:\${port} (\${deviceInfo.type})\`, 'info');
    
    const foundDevices = [];
    let scannedCount = 0;
    const totalScans = 254;
    
    // 创建中止控制器
    scanAbortController = new AbortController();
    
    // 并发扫描函数 - 只扫描指定端口
    const scanIP = async (ip) => {
        if (scanAbortController.signal.aborted) return;
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 600);
            
            const response = await fetch(\`http://\${ip}:\${port}/\`, {
                method: 'GET',
                mode: 'no-cors',
                signal: controller.signal
            }).catch(() => null);
            
            clearTimeout(timeoutId);
            
            if (response !== null) {
                foundDevices.push({
                    ip: ip,
                    port: port,
                    type: deviceInfo.type,
                    icon: deviceInfo.icon
                });
            }
        } catch (e) {
            // 忽略错误
        }
        
        scannedCount++;
        const progress = Math.round((scannedCount / totalScans) * 100);
        const progressFill = document.getElementById('scanProgressFill');
        const progressText = document.getElementById('scanProgressText');
        if (progressFill) progressFill.style.width = progress + '%';
        if (progressText) progressText.textContent = \`扫描进度: \${progress}% (\${scannedCount}/\${totalScans})\`;
    };
    
    // 批量并发扫描 - 由于只扫描单个端口，可以增加并发数
    const batchSize = 30;
    const ips = [];
    for (let i = 1; i <= 254; i++) {
        ips.push(\`\${subnet}.\${i}\`);
    }
    
    try {
        for (let i = 0; i < ips.length; i += batchSize) {
            if (scanAbortController.signal.aborted) break;
            const batch = ips.slice(i, i + batchSize);
            await Promise.all(batch.map(ip => scanIP(ip)));
        }
    } catch (e) {
        console.error('扫描错误:', e);
    }
    
    // 恢复按钮状态
    scanBtn.innerHTML = originalHTML;
    scanBtn.disabled = false;
    
    // 显示扫描结果
    if (foundDevices.length > 0) {
        devicesList.innerHTML = \`
            <div class="lan-devices-header">
                <span class="devices-count">发现 \${foundDevices.length} 个 \${deviceInfo.type} 设备</span>
                <button class="btn btn-secondary btn-sm" onclick="scanLanDevices()">重新扫描</button>
            </div>
            <div class="lan-devices-grid">
                \${foundDevices.map((device, index) => \`
                    <div class="lan-device-card" onclick="selectLanDevice('\${device.ip}', \${device.port})" style="animation: fadeInUp 0.3s ease-out \${index * 0.05}s backwards;">
                        <div class="device-icon">\${device.icon}</div>
                        <div class="device-info">
                            <div class="device-ip">\${device.ip}:\${device.port}</div>
                            <div class="device-type">\${device.type}</div>
                        </div>
                        <div class="device-select-icon">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor">
                                <path d="M9 18l6-6-6-6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </div>
                    </div>
                \`).join('')}
            </div>
        \`;
        addLog(\`✅ 扫描完成，发现 \${foundDevices.length} 个 \${deviceInfo.type} 设备\`, 'success');
    } else {
        devicesList.innerHTML = \`
            <div class="lan-scan-empty">
                <div class="empty-icon">📡</div>
                <p>未发现 \${deviceInfo.type} 设备</p>
                <span class="empty-hint">请确保设备已开启且端口 \${port} 正在监听</span>
                <button class="btn btn-secondary btn-sm" onclick="scanLanDevices()" style="margin-top: 12px;">重新扫描</button>
            </div>
        \`;
        addLog(\`⚠️ 扫描完成，未发现端口 \${port} 的可用设备\`, 'warn');
    }
}

/* ========================================
   选择局域网设备
   ======================================== */
function selectLanDevice(ip, port) {
    const pushUrlInput = document.getElementById('push-url');
    let currentUrl = pushUrlInput.value.trim();
    
    // 根据端口确定路径
    let path = '/action?do=refresh&type=danmaku&path=';
    if (port === 8080) {
        path = '/jsonrpc?request=';
    } else if (port === 10800) {
        path = '/danmaku?url=';
    }
    
    // 如果当前有URL，尝试保留路径部分
    if (currentUrl) {
        try {
            const urlObj = new URL(currentUrl);
            path = urlObj.pathname + urlObj.search;
        } catch (e) {
            // 使用默认路径
        }
    }
    
    const newUrl = \`http://\${ip}:\${port}\${path}\`;
    pushUrlInput.value = newUrl;
    
    // 添加选中动画
    pushUrlInput.style.animation = 'pulse 0.4s ease-out';
    pushUrlInput.style.borderColor = 'var(--success-color)';
    setTimeout(() => {
        pushUrlInput.style.animation = '';
        pushUrlInput.style.borderColor = '';
    }, 1000);
    
    addLog(\`✅ 已选择设备: \${ip}:\${port}\`, 'success');
}

/* ========================================
   获取默认推送地址
   ======================================== */
function getDefaultPushUrl(config) {
    const pushUrl = config.originalEnvVars?.DANMU_PUSH_URL || '';
    return pushUrl.trim();
}

/* ========================================
   设置默认推送地址
   ======================================== */
function setDefaultPushUrl(config) {
    const defaultPushUrl = getDefaultPushUrl(config);
    if (defaultPushUrl) {
        const pushUrlInput = document.getElementById('push-url');
        if (pushUrlInput && !pushUrlInput.value) {
            pushUrlInput.value = defaultPushUrl;
            
            // 添加设置成功动画
            pushUrlInput.style.animation = 'fadeInUp 0.4s ease-out';
            addLog('✅ 已加载默认推送地址', 'success');
        }
    }
}

/* ========================================
   搜索动漫用于推送
   ======================================== */
function searchAnimeForPush() {
    const keyword = document.getElementById('push-search-keyword').value.trim();
    const searchBtn = event.target;
    
    if (!keyword) {
        customAlert('请输入搜索关键字', '🔍 搜索提示');
        document.getElementById('push-search-keyword').focus();
        return;
    }
    
    const originalText = searchBtn.innerHTML;
    searchBtn.innerHTML = '<span class="loading-spinner-small"></span> <span>搜索中...</span>';
    searchBtn.disabled = true;
    
    // 添加搜索动画
    const animeList = document.getElementById('push-anime-list');
    const episodeList = document.getElementById('push-episode-list');
    animeList.style.opacity = '0.5';
    episodeList.style.display = 'none';
    
    const searchUrl = buildApiUrl('/api/v2/search/anime?keyword=' + encodeURIComponent(keyword));
    
    addLog(\`🔍 开始搜索动漫: \${keyword}\`, 'info');
    
    fetch(searchUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(\`HTTP error! status: \${response.status}\`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success && data.animes.length > 0) {
                displayAnimeListForPush(data.animes);
                addLog(\`✅ 找到 \${data.animes.length} 个动漫结果\`, 'success');
            } else {
                document.getElementById('push-anime-list').innerHTML = \`
                    <div class="search-empty">
                        <div class="empty-icon">🔍</div>
                        <h3>未找到相关动漫</h3>
                        <p>试试其他关键词吧</p>
                    </div>
                \`;
                document.getElementById('push-anime-list').style.display = 'block';
                document.getElementById('push-episode-list').style.display = 'none';
                addLog('⚠️ 未找到相关动漫', 'warn');
            }
        })
        .catch(error => {
            console.error('搜索动漫失败:', error);
            document.getElementById('push-anime-list').innerHTML = \`
                <div class="search-error">
                    <div class="error-icon">❌</div>
                    <h3>搜索失败</h3>
                    <p>\${escapeHtml(error.message)}</p>
                    <button class="btn btn-primary" onclick="searchAnimeForPush()">重试</button>
                </div>
            \`;
            document.getElementById('push-anime-list').style.display = 'block';
            addLog(\`❌ 搜索动漫失败: \${error.message}\`, 'error');
        })
        .finally(() => {
            searchBtn.innerHTML = originalText;
            searchBtn.disabled = false;
            animeList.style.transition = 'opacity 0.3s ease';
            animeList.style.opacity = '1';
        });
}

/* ========================================
   展示动漫列表用于推送
   ======================================== */
function displayAnimeListForPush(animes) {
    const container = document.getElementById('push-anime-list');
    
    let html = \`
        <div class="search-results-header">
            <h3 class="results-title">
                <span class="title-icon">🎬</span>
                搜索结果
                <span class="results-count">\${animes.length} 个</span>
            </h3>
            <p class="results-hint">点击动漫卡片查看剧集列表</p>
        </div>
        <div class="anime-grid-container">
    \`;

    animes.forEach((anime, index) => {
        const imageUrl = anime.imageUrl || 'https://placehold.co/150x200?text=No+Image';
        html += \`
            <div class="anime-card" onclick="getBangumiForPush(\${anime.animeId})" 
                 style="animation: fadeInUp 0.4s ease-out \${index * 0.05}s backwards;">
                <div class="anime-card-image-wrapper">
                    <img src="\${imageUrl}" 
                         alt="\${escapeHtml(anime.animeTitle)}" 
                         referrerpolicy="no-referrer" 
                         class="anime-image"
                         loading="lazy">
                    <div class="anime-card-overlay">
                        <span class="view-icon">👁️</span>
                        <span class="view-text">查看剧集</span>
                    </div>
                </div>
                <div class="anime-info">
                    <h4 class="anime-title" title="\${escapeHtml(anime.animeTitle)}">
                        \${escapeHtml(anime.animeTitle)}
                    </h4>
                    <div class="anime-meta">
                        <span class="episode-count">
                            <span class="meta-icon">📺</span>
                            共 \${anime.episodeCount} 集
                        </span>
                    </div>
                </div>
            </div>
        \`;
    });
    
    html += '</div>';
    
    container.innerHTML = html;
    container.style.display = 'block';
    
    // 滚动到结果区域
    setTimeout(() => {
        container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
}

/* ========================================
   获取番剧详情用于推送
   ======================================== */
function getBangumiForPush(animeId) {
    const bangumiUrl = buildApiUrl('/api/v2/bangumi/' + animeId);
    
    addLog(\`📡 获取番剧详情: \${animeId}\`, 'info');
    
    // 显示加载提示
    const episodeContainer = document.getElementById('push-episode-list');
    episodeContainer.innerHTML = \`
        <div class="loading-state">
            <div class="loading-spinner" style="margin: 0 auto;"></div>
            <p style="margin-top: 1rem; color: var(--text-secondary); font-weight: 600;">加载剧集列表中...</p>
        </div>
    \`;
    episodeContainer.style.display = 'block';
    
    // 滚动到剧集区域
    setTimeout(() => {
        episodeContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
    
    fetch(bangumiUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(\`HTTP error! status: \${response.status}\`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success && data.bangumi && data.bangumi.episodes) {
                selectedAnime = data.bangumi;
                currentEpisodes = data.bangumi.episodes;
                displayEpisodeListForPush(data.bangumi.animeTitle, data.bangumi.episodes);
                addLog(\`✅ 成功加载 \${data.bangumi.episodes.length} 个剧集\`, 'success');
            } else {
                episodeContainer.innerHTML = \`
                    <div class="search-empty">
                        <div class="empty-icon">📺</div>
                        <h3>该动漫暂无剧集信息</h3>
                        <p>试试搜索其他动漫吧</p>
                    </div>
                \`;
                addLog('⚠️ 该动漫暂无剧集信息', 'warn');
            }
        })
        .catch(error => {
            console.error('获取番剧详情失败:', error);
            episodeContainer.innerHTML = \`
                <div class="search-error">
                    <div class="error-icon">❌</div>
                    <h3>获取剧集失败</h3>
                    <p>\${escapeHtml(error.message)}</p>
                    <button class="btn btn-primary" onclick="getBangumiForPush(\${animeId})">重试</button>
                </div>
            \`;
            addLog(\`❌ 获取番剧详情失败: \${error.message}\`, 'error');
        });
}

/* ========================================
   展示剧集列表用于推送
   ======================================== */
function displayEpisodeListForPush(animeTitle, episodes) {
    const container = document.getElementById('push-episode-list');

    let html = \`
        <div class="episode-list-header">
            <h3 class="episode-anime-title">
                <span class="episode-anime-icon">🎬</span>
                \${escapeHtml(animeTitle)}
            </h3>
            <div class="episode-stats">
                <span class="episode-stat-item">
                    <span class="episode-stat-icon">📺</span>
                    <span>共 \${episodes.length} 集</span>
                </span>
                <span class="episode-stat-item">
                    <span class="episode-stat-icon">💬</span>
                    <span>弹幕推送</span>
                </span>
            </div>
        </div>
        <div class="jump-to-episode" style="margin: 1rem 0 1.25rem; padding: 0.9rem 1rem; background: rgba(255,255,255,0.72); border: 1px solid rgba(148, 163, 184, 0.24); border-radius: 14px; display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
            <span style="font-weight: 600; color: var(--text-primary);">跳转到第</span>
            <input type="number" id="jump-episode-input-push" placeholder="输入集数" min="1" style="padding: 0.6rem 0.75rem; width: 96px; border: 1px solid rgba(148, 163, 184, 0.35); border-radius: 10px; background: rgba(255,255,255,0.92);">
            <span style="font-weight: 600; color: var(--text-primary);">集</span>
            <button class="btn btn-primary btn-sm" onclick="jumpToEpisodeForPushDanmu()" style="border-radius: 10px;">跳转</button>
            <span style="color: var(--text-secondary); font-size: 0.92rem;">支持快速定位较长剧集列表</span>
        </div>
        <div class="episode-grid">
    \`;

    episodes.forEach((episode, index) => {
        const commentUrl = window.location.origin + buildApiUrl('/api/v2/comment/' + episode.episodeId + '?format=xml');
        const episodeNumber = episode.episodeNumber || (index + 1);
        html += \`
            <div class="episode-item" id="episode-item-push-\${episodeNumber}" style="animation: fadeInUp 0.3s ease-out \${index * 0.03}s backwards;">
                <div class="episode-info">
                    <div class="episode-number">
                        <span class="episode-icon">📺</span>
                        第 \${episodeNumber} 集
                    </div>
                    <div class="episode-title">\${escapeHtml(episode.episodeTitle || '无标题')}</div>
                </div>
                <button class="btn btn-success btn-sm episode-push-btn" 
                        data-comment-url="\${commentUrl}"
                        data-episode-title="\${escapeHtml(episode.episodeTitle || '第' + episodeNumber + '集')}"
                        onclick="pushDanmu('\${commentUrl}', '\${escapeHtml(episode.episodeTitle || '第' + episodeNumber + '集').replace(/'/g, "\\'")}', this)">
                    <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                    </svg>
                    <span>推送</span>
                </button>
            </div>
        \`;
    });

    html += '</div>';

    container.innerHTML = html;
    container.style.display = 'block';

    setTimeout(() => {
        container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
}

function jumpToEpisodeForPushDanmu() {
    const episodeInput = document.getElementById('jump-episode-input-push');
    const episodeNumber = parseInt(episodeInput && episodeInput.value, 10);

    if (!episodeNumber || episodeNumber <= 0) {
        customAlert('请输入有效的集数（正整数）', '⚠️ 定位失败');
        return;
    }

    const episodeElement = document.getElementById('episode-item-push-' + episodeNumber);
    if (!episodeElement) {
        customAlert('找不到第' + episodeNumber + '集', '⚠️ 定位失败');
        return;
    }

    episodeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    episodeElement.style.boxShadow = '0 0 0 2px rgba(251, 191, 36, 0.55)';
    episodeElement.style.background = 'rgba(254, 240, 138, 0.18)';
    setTimeout(() => {
        episodeElement.style.boxShadow = '';
        episodeElement.style.background = '';
    }, 1800);
}

/* ========================================
   推送弹幕
   ======================================== */
async function pushDanmu(commentUrl, episodeTitle, button) {
    const pushUrlInput = document.getElementById('push-url');
    const pushUrl = pushUrlInput.value.trim();

    if (!pushUrl || pushUrl.trim() === '') {
        customAlert('请输入推送地址', '⚠️ 推送提示');
        pushUrlInput.focus();
        return;
    }

    const originalHTML = button.innerHTML;
    button.innerHTML = '<span class="loading-spinner-small"></span>';
    button.disabled = true;

    addLog(\`🚀 开始推送弹幕: \${episodeTitle}\`, 'info');

    try {
        await fetch(pushUrl + encodeURIComponent(commentUrl), {
            method: 'GET',
            mode: 'no-cors',
        });

        // 推送成功
        button.innerHTML = \`
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>已推送</span>
        \`;
        button.classList.add('pushed');
        button.disabled = true;
        
        // 添加成功徽章到剧集标题
        const episodeItem = button.closest('.episode-item');
        const episodeInfo = episodeItem.querySelector('.episode-info');
        const successBadge = document.createElement('span');
        successBadge.className = 'push-success-badge';
        successBadge.innerHTML = '<span>✅</span><span>已推送</span>';
        episodeInfo.appendChild(successBadge);
        
        // 记录推送历史
        pushHistory.unshift({
            title: episodeTitle,
            time: new Date().toLocaleTimeString('zh-CN', { hour12: false })
        });
        
        if (pushHistory.length > 10) {
            pushHistory.pop();
        }
        
        customAlert('✅ 弹幕推送成功！\\n\\n' + episodeTitle, '🎉 推送成功');
        addLog(\`✅ 弹幕推送成功 - \${episodeTitle}\`, 'success');
    } catch (error) {
        console.error('推送弹幕失败:', error);
        button.innerHTML = originalHTML;
        button.disabled = false;
        customAlert('推送弹幕失败: ' + error.message, '❌ 推送失败');
        addLog(\`❌ 推送弹幕失败: \${error.message}\`, 'error');
    }
}
`;