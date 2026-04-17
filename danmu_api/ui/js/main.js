// language=JavaScript
export const mainJsContent = /* javascript */ `
/* ========================================
   全局变量定义
   ======================================== */
let envVariables = {};
let currentCategory = 'api';
let editingKey = null;
let logs = [];
let currentVersion = '';
let latestVersion = '';
let runtimeInfo = null;
let runtimeInfoRequest = null;
let runtimePollTimer = null;
let runtimeTrafficSample = null;
let runtimeLastSyncedAt = 0;
let sidebarRefreshTimer = null;
let runtimePollInFlight = false;
let sidebarRefreshInFlight = false;
let activeSectionId = 'preview';
let configRequest = null;
let configCache = null;
let configCacheFetchedAt = 0;
let currentToken = 'globals.currentToken';
let currentAdminToken = '';
let originalToken = '87654321';
const PROTECTED_UI_SECTIONS = ['logs', 'api', 'env', 'push', 'cookie', 'request-records'];
const RUNTIME_MODAL_REFRESH_INTERVAL_MS = 1000;
const SIDEBAR_REFRESH_INTERVAL_MS = 1000;
const CONFIG_CACHE_TTL_MS = 5000;
const SECTION_RENDER_STAGGER_LIMIT = 12;
let sidebarInfoState = {
    runtimeLabel: '运行时检测中',
    versionState: 'checking',
    versionText: '版本检测中',
    configuredCount: null,
    accessMode: '公开访问',
    serviceStatus: '正在同步服务状态与版本信息',
    deployPlatform: '等待同步',
    resourceText: '等待同步',
    cpuText: '--',
    memoryText: '--'
};
let sectionLoadedState = {
    preview: false,
    logs: false,
    api: false,
    push: false,
    'request-records': false,
    env: false
};

// 反向代理/API基础路径配置
// 从LocalStorage获取用户自定义的Base URL
let customBaseUrl = localStorage.getItem('logvar_api_base_url') || '';

// 保存自定义Base URL (为空则清除)
function saveBaseUrl() {
    const input = document.getElementById('custom-base-url').value.trim();
    if (input) {
        // 确保URL不以斜杠结尾，方便后续拼接
        let formattedUrl = input;
        if (formattedUrl.endsWith('/')) {
            formattedUrl = formattedUrl.slice(0, -1);
        }
        localStorage.setItem('logvar_api_base_url', formattedUrl);
        customBaseUrl = formattedUrl;
        customAlert('API地址配置已保存，即将刷新页面。', '保存成功');
        setTimeout(() => {
            location.reload();
        }, 1000);
    } else {
        // 输入为空，视为清除配置/重置为默认
        localStorage.removeItem('logvar_api_base_url');
        customBaseUrl = '';
        customAlert('配置已重置为默认状态，即将刷新页面。', '操作成功');
        setTimeout(() => {
            location.reload();
        }, 1000);
    }
}

/* ========================================
   移动端 viewport/软键盘兼容
   - 修复：输入框聚焦后按钮被“挤出视口”看起来像消失
   - 修复：部分移动端浏览器/内置 WebView 偶发重绘导致按钮/头部不显示
   ======================================== */
function syncAppViewportHeight() {
    try {
        const vv = window.visualViewport;
        const height = (vv && vv.height) ? vv.height : window.innerHeight;
        if (!height) return;
        document.documentElement.style.setProperty('--app-vh', (height * 0.01) + 'px');
    } catch (e) {}
}

function initMobileViewportFixes() {
    // 首次同步
    syncAppViewportHeight();

    // 监听软键盘弹出/收起（visualViewport 更准确）
    try {
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', syncAppViewportHeight);
            window.visualViewport.addEventListener('scroll', syncAppViewportHeight);
        }
    } catch (e) {}

    window.addEventListener('resize', syncAppViewportHeight);

    // 聚焦输入框时，尽量把对应的操作按钮保持在可视区域内（尤其是“开始匹配/搜索”等按钮）
    document.addEventListener('focusin', function(e) {
        // 仅移动端启用，避免桌面端滚动干扰
        if (window.innerWidth > 767) return;

        const target = e.target;
        if (!target) return;

        const tag = (target.tagName || '').toUpperCase();
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') return;

        requestAnimationFrame(() => {
            try {
                syncAppViewportHeight();

                const vv = window.visualViewport;
                const viewportHeight = (vv && vv.height) ? vv.height : window.innerHeight;
                const padding = 16;

                // 优先在弹幕测试面板/搜索输入组内找按钮
                const scope = target.closest('.danmu-method-panel') ||
                              target.closest('.search-input-group') ||
                              target.closest('.input-group') ||
                              target.closest('.form-card') ||
                              target.parentElement;

                let btn = null;
                if (scope) {
                    // 先找大按钮（开始匹配/搜索），再降级
                    btn = scope.querySelector('button.btn.btn-lg') || scope.querySelector('button.btn');
                }

                const checkEl = btn || target;
                const rect = checkEl.getBoundingClientRect();
                const bottomLimit = viewportHeight - padding;

                if (rect.bottom > bottomLimit) {
                    const delta = rect.bottom - bottomLimit;
                    window.scrollBy({ top: delta, left: 0, behavior: 'smooth' });
                }
            } catch (err) {}
        });
    }, true);
}

let lastMobileChromeScrollY = 0;
let mobileChromeTicking = false;

function syncMobileNavigationChrome(forceShow = false) {
    const isMobile = window.innerWidth <= 860;
    document.body.classList.toggle('mobile-nav-enabled', isMobile);
    document.body.classList.remove('mobile-nav-hidden');

    if (!isMobile) {
        toggleSidebar(false);
        return;
    }
    lastMobileChromeScrollY = forceShow ? 0 : (window.scrollY || window.pageYOffset || 0);
}

function initMobileNavigationChrome() {
    lastMobileChromeScrollY = window.scrollY || window.pageYOffset || 0;
    syncMobileNavigationChrome(true);

    window.addEventListener('scroll', function() {
        if (mobileChromeTicking) return;
        mobileChromeTicking = true;
        requestAnimationFrame(() => {
            syncMobileNavigationChrome(false);
            mobileChromeTicking = false;
        });
    }, { passive: true });

    window.addEventListener('resize', function() {
        lastMobileChromeScrollY = window.scrollY || window.pageYOffset || 0;
        syncMobileNavigationChrome(true);
    });
}


/* ========================================
   主题切换功能
   ======================================== */
function updateThemeChrome(theme) {
    const themeColor = theme === 'dark' ? '#0A0F1E' : '#f6f7fb';
    document.documentElement.style.backgroundColor = themeColor;
    document.documentElement.style.colorScheme = theme;
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
        themeColorMeta.setAttribute('content', themeColor);
    }
}

function initTheme() {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('theme') || document.documentElement.getAttribute('data-theme') || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeChrome(savedTheme);
    
    // 添加主题切换动画
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.style.opacity = '0';
        themeToggle.style.transform = 'scale(0.8)';
        setTimeout(() => {
            themeToggle.style.transition = 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
            themeToggle.style.opacity = '1';
            themeToggle.style.transform = 'scale(1)';
        }, 300);
    }
    addLog(\`已加载\${savedTheme === 'dark' ? '深色' : '浅色'}主题 ✨\`, 'info');
}

function toggleTheme(triggerElement) {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    // 添加页面过渡效果
    document.body.style.transition = 'background 0.3s ease';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeChrome(newTheme);
    
    const themeButton = triggerElement || document.getElementById('theme-toggle');
    if (themeButton) {
        themeButton.style.transform = 'scale(0.8) rotate(360deg)';
    }
    
    // 创建主题切换涟漪效果
    const ripple = document.createElement('div');
    ripple.style.cssText = \`
        position: fixed;
        border-radius: 50%;
        background: \${newTheme === 'dark' ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)'};
        width: 20px;
        height: 20px;
        left: \${themeButton.offsetLeft + themeButton.offsetWidth / 2}px;
        top: \${themeButton.offsetTop + themeButton.offsetHeight / 2}px;
        transform: translate(-50%, -50%);
        pointer-events: none;
        z-index: 9999;
        animation: themeRipple 0.6s ease-out;
    \`;
    
    const style = document.createElement('style');
    style.textContent = \`
        @keyframes themeRipple {
            to {
                width: 3000px;
                height: 3000px;
                opacity: 0;
            }
        }
    \`;
    document.head.appendChild(style);
    document.body.appendChild(ripple);
    
    setTimeout(() => {
        if (themeButton) {
            themeButton.style.transform = '';
        }
        ripple.remove();
        style.remove();
    }, 600);
    
    addLog(\`已切换到\${newTheme === 'dark' ? '深色' : '浅色'}主题 🎨\`, 'success');
}

/* ========================================
   部署平台环境变量状态指示器
   ======================================== */
let deployEnvStatus = {
    platform: 'node',
    platformLabel: 'Node.js',
    requiredVars: [],
    missingVars: [],
    lastUpdated: 0
};

function updateSidebarInfoCard(partial) {
    sidebarInfoState = Object.assign({}, sidebarInfoState, partial || {});

    const runtimeEl = document.getElementById('sidebar-info-runtime');
    const statusEl = document.getElementById('sidebar-info-status');
    const versionEl = document.getElementById('sidebar-info-version');
    const modeEl = document.getElementById('sidebar-info-mode');
    const cpuEl = document.getElementById('sidebar-info-cpu');
    const memoryEl = document.getElementById('sidebar-info-memory');

    if (runtimeEl) {
        runtimeEl.textContent = sidebarInfoState.runtimeLabel || '运行时检测中';
        runtimeEl.dataset.state = sidebarInfoState.versionState || 'checking';
    }

    if (statusEl) {
        statusEl.textContent = sidebarInfoState.serviceStatus || '正在同步服务状态与版本信息';
    }

    if (versionEl) {
        versionEl.textContent = sidebarInfoState.versionText || '版本检测中';
        versionEl.dataset.state = sidebarInfoState.versionState || 'checking';
    }

    if (modeEl) {
        modeEl.textContent = sidebarInfoState.accessMode || '公开访问';
    }

    if (cpuEl) {
        cpuEl.textContent = sidebarInfoState.cpuText || '--';
    }

    if (memoryEl) {
        memoryEl.textContent = sidebarInfoState.memoryText || '--';
    }
}

function getEntryAnimationStyle(index, stepSeconds = 0.05) {
    if (!Number.isFinite(index) || index < 0 || index >= SECTION_RENDER_STAGGER_LIMIT) {
        return '';
    }
    return ' style="animation: fadeInUp 0.3s ease-out ' + (index * stepSeconds) + 's backwards;"';
}

function applyConfigState(config) {
    if (!config || typeof config !== 'object') {
        return config;
    }

    currentAdminToken = config.originalEnvVars?.ADMIN_TOKEN || '';
    originalToken = config.originalEnvVars?.TOKEN || '87654321';

    const originalEnvVars = config.originalEnvVars || {};
    envVariables = {};

    Object.keys(originalEnvVars).forEach(key => {
        const varConfig = config.envVarConfig?.[key] || { category: 'system', type: 'text', description: '未分类配置项' };
        const category = varConfig.category || 'system';

        if (!envVariables[category]) {
            envVariables[category] = [];
        }

        envVariables[category].push({
            key: key,
            value: originalEnvVars[key],
            description: varConfig.description || '',
            type: varConfig.type || 'text',
            min: varConfig.min,
            max: varConfig.max,
            options: varConfig.options || []
        });
    });

    return config;
}

async function fetchUiConfig(options = {}) {
    const force = Boolean(options.force);
    const now = Date.now();

    if (!force && configCache && (now - configCacheFetchedAt) < CONFIG_CACHE_TTL_MS) {
        return configCache;
    }

    if (!force && configRequest) {
        return configRequest;
    }

    const request = fetch(buildApiUrl('/api/config', true))
        .then(response => {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.indexOf('application/json') === -1) {
                return response.text().then(text => {
                    throw new Error('Expected JSON, got ' + contentType + '. Content: ' + text.substring(0, 50) + '...');
                });
            }
            if (!response.ok) {
                throw new Error('HTTP error! status: ' + response.status);
            }
            return response.json();
        })
        .then(config => {
            configCache = applyConfigState(config);
            configCacheFetchedAt = Date.now();
            return configCache;
        })
        .finally(function() {
            if (configRequest === request) {
                configRequest = null;
            }
        });

    configRequest = request;
    return request;
}

async function refreshSidebarConfiguredCount(config) {
    try {
        const resolvedConfig = config || await fetchUiConfig();
        const originalEnvVars = resolvedConfig && resolvedConfig.originalEnvVars ? resolvedConfig.originalEnvVars : {};
        const manualConfigs = Object.values(originalEnvVars).filter(function(value) {
            return value !== '' && value !== null && value !== undefined;
        }).length;
        updateSidebarInfoCard({
            configuredCount: manualConfigs
        });
    } catch (error) {
        console.error('刷新侧栏配置计数失败:', error);
    }
}

function resolveCurrentAccessMode() {
    const urlPath = window.location.pathname;
    const pathParts = urlPath.split('/').filter(function(part) { return part !== ''; });
    const urlToken = pathParts.length > 0 ? pathParts[0] : '';

    if (urlToken) {
        if (currentAdminToken && currentAdminToken.trim() !== '' && urlToken === currentAdminToken) {
            return '管理访问';
        }
        if (originalToken && originalToken !== '87654321') {
            return '用户访问';
        }
        return '用户访问';
    }

    return '公开访问';
}

async function refreshSidebarSnapshot() {
    updateSidebarInfoCard({
        accessMode: resolveCurrentAccessMode()
    });

    const configPromise = fetchUiConfig();

    await Promise.allSettled([
        refreshRuntimeSummary(),
        configPromise.then(function(config) {
            updateDeployEnvStatusBadgeFromConfig(config);
            return refreshSidebarConfiguredCount(config);
        })
    ]);
}

function startSidebarRefreshLoop() {
    if (sidebarRefreshTimer) {
        clearInterval(sidebarRefreshTimer);
    }
    sidebarRefreshTimer = setInterval(function() {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar || !sidebar.classList.contains('active') || window.innerWidth > 860 || document.hidden) {
            stopSidebarRefreshLoop();
            return;
        }
        if (sidebarRefreshInFlight) {
            return;
        }
        sidebarRefreshInFlight = true;
        refreshSidebarSnapshot().finally(function() {
            sidebarRefreshInFlight = false;
        });
    }, SIDEBAR_REFRESH_INTERVAL_MS);
}

function stopSidebarRefreshLoop() {
    if (!sidebarRefreshTimer) return;
    clearInterval(sidebarRefreshTimer);
    sidebarRefreshTimer = null;
}

function getDeployPlatformLabel(platform) {
    const p = (platform || 'node').toString().toLowerCase();
    const map = {
        vercel: 'Vercel',
        netlify: 'Netlify',
        edgeone: 'EdgeOne (腾讯云 Pages)',
        cloudflare: 'Cloudflare',
        docker: '本地/Docker',
        node: '本地/Docker',
        nodejs: '本地/Docker'
    };
    return map[p] || (platform || 'Unknown');
}

function getDeployRequiredVars(platform) {
    const p = (platform || 'node').toString().toLowerCase();
    if (p === 'vercel' || p === 'edgeone') {
        return ['DEPLOY_PLATFROM_PROJECT', 'DEPLOY_PLATFROM_TOKEN'];
    }
    if (p === 'netlify' || p === 'cloudflare') {
        return ['DEPLOY_PLATFROM_ACCOUNT', 'DEPLOY_PLATFROM_PROJECT', 'DEPLOY_PLATFROM_TOKEN'];
    }
    // 本地/Docker 部署不需要额外部署变量，修改配置后自动生效
    return [];
}

function readEnvValue(config, key) {
    try {
        if (config && config.originalEnvVars && Object.prototype.hasOwnProperty.call(config.originalEnvVars, key)) {
            return config.originalEnvVars[key];
        }
        if (config && config.envs && Object.prototype.hasOwnProperty.call(config.envs, key)) {
            return config.envs[key];
        }
    } catch (e) {}
    return '';
}

function computeDeployEnvStatus(config) {
    const platformRaw = (config && config.envs && (config.envs.deployPlatform || config.envs.DEPLOY_PLATFORM)) || 'node';
    const platform = (platformRaw || 'node').toString().toLowerCase();
    const requiredVars = getDeployRequiredVars(platform);
    const missingVars = requiredVars.filter(v => {
        const val = readEnvValue(config, v);
        return !val || (typeof val === 'string' && val.trim() === '');
    });

    return {
        platform,
        platformLabel: getDeployPlatformLabel(platform),
        requiredVars,
        missingVars
    };
}

function applyDeployEnvStatusToBadge(status) {
    const ok = !status.missingVars || status.missingVars.length === 0;
    const titleOk = '部署平台 ' + status.platformLabel + '：配置已就绪';
    const titleBad = '部署平台 ' + status.platformLabel + '：还有 ' + (status.missingVars ? status.missingVars.length : 0) + ' 项设置待完成';

    const mobileBadge = document.getElementById('mobile-status');
    const mobileDot = document.getElementById('deploy-env-status-dot') || (mobileBadge ? mobileBadge.querySelector('.status-dot') : null);
    if (mobileBadge && mobileDot) {
        mobileDot.classList.remove('status-running', 'status-warning', 'status-error');
        mobileDot.classList.add(ok ? 'status-running' : 'status-error');
        mobileBadge.title = ok ? titleOk : titleBad;
        mobileBadge.setAttribute('data-deploy-ok', ok ? '1' : '0');
    }

    const desktopBadge = document.getElementById('desktop-status-pill');
    const desktopDot = document.getElementById('desktop-deploy-status-dot') || (desktopBadge ? desktopBadge.querySelector('.status-dot') : null);
    const desktopText = document.getElementById('desktop-status-text');
    if (desktopBadge && desktopDot) {
        desktopDot.classList.remove('status-running', 'status-warning', 'status-error');
        desktopDot.classList.add(ok ? 'status-running' : 'status-error');
        desktopBadge.title = ok ? titleOk : titleBad;
        desktopBadge.setAttribute('data-deploy-ok', ok ? '1' : '0');
        if (desktopText) {
            desktopText.textContent = ok ? (status.platformLabel + ' 已就绪') : (status.platformLabel + ' 待补充');
        }
    }

    const heroBadge = document.getElementById('hero-status-pill');
    const heroDot = document.getElementById('hero-deploy-status-dot') || (heroBadge ? heroBadge.querySelector('.status-dot') : null);
    const heroText = document.getElementById('hero-status-text');
    if (heroBadge && heroDot) {
        heroDot.classList.remove('status-running', 'status-warning', 'status-error');
        heroDot.classList.add(ok ? 'status-running' : 'status-error');
        heroBadge.title = ok ? titleOk : titleBad;
        heroBadge.setAttribute('data-deploy-ok', ok ? '1' : '0');
        if (heroText) {
            heroText.textContent = ok ? '状态' : '状态';
        }
    }

    updateSidebarInfoCard({
        deployPlatform: status.platformLabel || '等待同步'
    });
}

function updateDeployEnvStatusBadgeFromConfig(config) {
    const status = computeDeployEnvStatus(config || {});
    deployEnvStatus = Object.assign({}, deployEnvStatus, status, { lastUpdated: Date.now() });
    applyDeployEnvStatusToBadge(deployEnvStatus);
}

async function refreshDeployEnvStatusBadge(force = false, config) {
    try {
        const now = Date.now();
        if (!force && deployEnvStatus.lastUpdated && (now - deployEnvStatus.lastUpdated) < 5000) {
            applyDeployEnvStatusToBadge(deployEnvStatus);
            return deployEnvStatus;
        }

        const resolvedConfig = config || await fetchUiConfig({ force });
        const status = computeDeployEnvStatus(resolvedConfig);

        deployEnvStatus = Object.assign({}, deployEnvStatus, status, { lastUpdated: now });
        applyDeployEnvStatusToBadge(deployEnvStatus);
        return deployEnvStatus;
    } catch (e) {
        console.error('获取部署平台环境变量状态失败:', e);
        // 网络异常时显示红色
        deployEnvStatus = Object.assign({}, deployEnvStatus, { missingVars: ['UNKNOWN'], lastUpdated: Date.now() });
        applyDeployEnvStatusToBadge(deployEnvStatus);
        return deployEnvStatus;
    }
}

function closeDeployEnvStatusModal() {
    const modal = document.getElementById('deploy-env-status-modal');
    if (modal) modal.classList.remove('active');
}

async function openDeployEnvStatusModal() {
    const modal = document.getElementById('deploy-env-status-modal');
    const body = document.getElementById('deploy-env-status-body');
    if (!modal || !body) return;

    const status = await refreshDeployEnvStatusBadge(true);
    const ok = !status.missingVars || status.missingVars.length === 0;

    const iconSvgOk = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
        '<path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';

    const iconSvgBad = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
        '<path d="M12 9v4" stroke-linecap="round"/>' +
        '<path d="M12 17h.01" stroke-linecap="round"/>' +
        '<path d="M10.29 3.86l-7.4 12.82A2 2 0 004.62 20h14.76a2 2 0 001.73-3.32l-7.4-12.82a2 2 0 00-3.42 0z" stroke-linejoin="round"/>' +
    '</svg>';

    const heroClass = ok ? 'deploy-env-status-hero success' : 'deploy-env-status-hero error';
    const heroTitle = ok ? '部署所需设置已完成' : '还有部署设置待补充';
    const heroSubtitle = ok
        ? ('当前部署平台为 ' + status.platformLabel + '，基础配置已满足，可继续正常使用。')
        : ('当前部署平台为 ' + status.platformLabel + '，请先补全下列设置，再进行重新部署或相关管理操作。');

    let varsHtml = '';
    if (!status.requiredVars || status.requiredVars.length === 0) {
        varsHtml = '<div class="deploy-env-status-hint">当前部署平台无需额外补充 <span class="deploy-env-code">DEPLOY_PLATFROM_*</span> 相关设置。</div>';
    } else {
        varsHtml = '<div class="deploy-env-status-grid">' +
            status.requiredVars.map(function(k) {
                const missing = status.missingVars && status.missingVars.indexOf(k) !== -1;
                return '<div class="deploy-env-var-item">' +
                        '<div class="deploy-env-var-name">' + k + '</div>' +
                        '<div class="deploy-env-var-status ' + (missing ? 'missing' : 'ok') + '">' +
                            (missing ? '未配置' : '已配置') +
                        '</div>' +
                    '</div>';
            }).join('') +
        '</div>';
    }

    let missingHint = '';
    if (!ok && status.missingVars && status.missingVars.length > 0 && status.missingVars[0] !== 'UNKNOWN') {
        missingHint = '<div class="deploy-env-status-hint">缺失项：' +
            status.missingVars.map(function(v) { return '<span class="deploy-env-code">' + v + '</span>'; }).join(' ') +
        '</div>';
    }

    if (!ok && status.missingVars && status.missingVars.length > 0 && status.missingVars[0] === 'UNKNOWN') {
        missingHint = '<div class="deploy-env-status-hint">当前暂时无法获取配置状态，请检查网络或 API 地址是否可访问。</div>';
    }

    body.innerHTML =
        '<div class="' + heroClass + '">' +
            '<div class="deploy-env-status-hero-content">' +
                '<div class="deploy-env-status-hero-icon">' + (ok ? iconSvgOk : iconSvgBad) + '</div>' +
                '<div>' +
                    '<p class="deploy-env-status-hero-title">' + heroTitle + '</p>' +
                    '<div class="deploy-env-status-hero-subtitle">' + heroSubtitle + '</div>' +
                    '<div class="deploy-env-status-chip">' +
                        '<span>平台：</span><strong>' + status.platformLabel + '</strong>' +
                        '<span style="margin-left: 8px;">状态：</span><strong>' + (ok ? '✅ 已就绪' : '⚠️ 待补充') + '</strong>' +
                    '</div>' +
                '</div>' +
            '</div>' +
        '</div>' +
        varsHtml +
        missingHint;

    modal.classList.add('active');

    const modalContainer = modal.querySelector('.modal-container');
    if (modalContainer) {
        modalContainer.style.animation = 'modalSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
    }
}

/* ========================================
   侧边栏切换
   ======================================== */
function removeSidebarOverlay() {
    const overlay = document.querySelector('.sidebar-overlay');
    if (!overlay) return;
    overlay.style.animation = 'overlayFadeOut 0.24s ease-out';
    setTimeout(() => {
        if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
    }, 220);
}

function applyMobileSidebarState(sidebar, open) {
    if (!sidebar) return;
    sidebar.style.display = 'flex';
    sidebar.style.position = 'fixed';
    sidebar.style.top = '0';
    sidebar.style.left = '0';
    sidebar.style.bottom = '0';
    sidebar.style.width = 'min(80vw, 304px)';
    sidebar.style.maxWidth = '304px';
    sidebar.style.minWidth = '0';
    sidebar.style.height = '100dvh';
    sidebar.style.maxHeight = '100dvh';
    sidebar.style.minHeight = '100dvh';
    sidebar.style.borderRadius = '0';
    sidebar.style.overflow = 'auto';
    sidebar.style.zIndex = '1101';
    sidebar.style.opacity = '1';
    sidebar.style.visibility = 'visible';
    sidebar.style.pointerEvents = 'auto';
    sidebar.style.willChange = 'transform';
    sidebar.style.transition = 'transform 0.24s cubic-bezier(0.22, 1, 0.36, 1)';
    sidebar.style.transform = open ? 'translate3d(0, 0, 0)' : 'translate3d(calc(-100% - 14px), 0, 0)';
    document.body.classList.toggle('sidebar-drawer-open', open);
    document.body.style.overflow = open ? 'hidden' : '';
}

function resetDesktopSidebarState(sidebar) {
    if (!sidebar) return;
    sidebar.style.display = '';
    sidebar.style.position = '';
    sidebar.style.top = '';
    sidebar.style.left = '';
    sidebar.style.bottom = '';
    sidebar.style.width = '';
    sidebar.style.maxWidth = '';
    sidebar.style.minWidth = '';
    sidebar.style.height = '';
    sidebar.style.maxHeight = '';
    sidebar.style.minHeight = '';
    sidebar.style.borderRadius = '';
    sidebar.style.overflow = '';
    sidebar.style.zIndex = '';
    sidebar.style.opacity = '';
    sidebar.style.visibility = '';
    sidebar.style.pointerEvents = '';
    sidebar.style.willChange = '';
    sidebar.style.transition = '';
    sidebar.style.transform = '';
    document.body.classList.remove('sidebar-drawer-open');
    document.body.style.overflow = '';
}

function toggleSidebar(forceOpen) {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    const isMobile = window.innerWidth <= 860;
    const nextOpen = typeof forceOpen === 'boolean' ? forceOpen : !sidebar.classList.contains('active');

    if (!isMobile) {
        sidebar.classList.remove('active');
        sidebar.setAttribute('aria-hidden', 'false');
        resetDesktopSidebarState(sidebar);
        removeSidebarOverlay();
        stopSidebarRefreshLoop();
        return;
    }

    sidebar.classList.toggle('active', nextOpen);
    sidebar.setAttribute('aria-hidden', nextOpen ? 'false' : 'true');
    applyMobileSidebarState(sidebar, nextOpen);

    if (!document.getElementById('overlay-animation-styles')) {
        const style = document.createElement('style');
        style.id = 'overlay-animation-styles';
        style.textContent = \`
            @keyframes overlayFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes overlayFadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
        \`;
        document.head.appendChild(style);
    }

    if (nextOpen) {
        let overlay = document.querySelector('.sidebar-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'sidebar-overlay';
            overlay.style.cssText = \`
                position: fixed;
                inset: 0;
                background: rgba(15, 23, 42, 0.42);
                backdrop-filter: blur(6px);
                z-index: 1099;
                animation: overlayFadeIn 0.24s ease-out;
            \`;
            overlay.onclick = function() { toggleSidebar(false); };
            document.body.appendChild(overlay);
        }
        refreshSidebarSnapshot();
        startSidebarRefreshLoop();
    } else {
        removeSidebarOverlay();
        stopSidebarRefreshLoop();
    }
}

function ensureSectionData(section, options = {}) {
    const force = Boolean(options.force);
    const preloadedConfig = options.config;

    if (section === 'preview' && (force || !sectionLoadedState.preview)) {
        sectionLoadedState.preview = true;
        renderPreview(preloadedConfig);
        return;
    }

    if (section === 'env' && hasProtectedUiAccessToken() && (force || !sectionLoadedState.env)) {
        sectionLoadedState.env = true;
        if (preloadedConfig || !configCache) {
            loadEnvVariables(preloadedConfig);
        } else {
            renderEnvList();
        }
        return;
    }

    if (section === 'logs' && hasProtectedUiAccessToken() && (force || !sectionLoadedState.logs)) {
        sectionLoadedState.logs = true;
        fetchRealLogs();
        return;
    }

    if (section === 'request-records' && hasProtectedUiAccessToken() && typeof refreshRequestRecords === 'function') {
        sectionLoadedState['request-records'] = true;
        refreshRequestRecords();
    }
}

/* ========================================
   导航切换
   ======================================== */
function switchSection(section) {
    // 检查是否尝试访问受token保护的section
    if (PROTECTED_UI_SECTIONS.includes(section)) {
        const _reverseProxy = customBaseUrl;

        if (!hasProtectedUiAccessToken()) {
            setTimeout(() => {
                // 获取当前页面的协议、主机和端口
                const protocol = window.location.protocol;
                const host = window.location.host;
                
                // 构造显示的BaseUrl，确保是绝对路径
                let displayBase;
                if (_reverseProxy) {
                    displayBase = _reverseProxy.startsWith('http') 
                        ? _reverseProxy 
                        : (protocol + '//' + host + _reverseProxy);
                } else {
                    displayBase = protocol + '//' + host;
                }
                
                if (displayBase.endsWith('/')) {
                    displayBase = displayBase.slice(0, -1);
                }
                
                customAlert('请在URL中配置相应的TOKEN以访问此功能！\\n\\n访问方式：' + displayBase + '/{TOKEN}', '🔒 需要认证');
            }, 100);
            return;
        }
        
        if (section === 'env') {
            checkDeployPlatformConfig().then(result => {
                if (!result.success) {
                    setTimeout(() => {
                        customAlert(result.message, '⚙️ 配置提示');
                    }, 100);
                } else {
                    performSectionSwitch(section);
                }
            });
            return;
        }
    }
    
    performSectionSwitch(section);
}

function performSectionSwitch(section, isInitialLoad = false) {
    const isMobileView = window.innerWidth <= 860;
    if (!isInitialLoad && activeSectionId === section) {
        if (isMobileView) {
            const sidebar = document.getElementById('sidebar');
            if (sidebar && sidebar.classList.contains('active')) {
                toggleSidebar(false);
            }
        }
        return;
    }

    // 移除所有active类
    document.querySelectorAll('.content-section.active').forEach(s => {
        s.classList.remove('active');
    });
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    
    // 添加active类
    const targetSection = document.getElementById(section + '-section');
    if (targetSection) {
        targetSection.classList.add('active');
    }
    activeSectionId = section;
    
    const activeNav = document.querySelector(\`[data-section="\${section}"]\`);
    if (activeNav) activeNav.classList.add('active');
    document.querySelectorAll('.desktop-command-bar .command-chip').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.section === section);
    });
    
    // 更新移动端标题
    const titles = {
        preview: {
            main: '服务概览',
            sub: 'Service Home',
            kicker: 'Quick Start',
            desc: '快速查看接入地址、当前状态和基础设置。'
        },
        logs: {
            main: '运行日志',
            sub: 'Activity Logs',
            kicker: 'Recent Activity',
            desc: '查看最近运行记录与异常提醒。'
        },
        api: {
            main: '接口测试',
            sub: 'API Tester',
            kicker: 'Access Test',
            desc: '快速测试接口与返回结果。'
        },
        push: {
            main: '推送弹幕',
            sub: 'Manual Push',
            kicker: 'Danmu Push',
            desc: '手动推送弹幕并联动播放器刷新。'
        },
        'request-records': {
            main: '访问记录',
            sub: 'Access History',
            kicker: 'Recent Requests',
            desc: '查看最近访问与调用情况。'
        },
        env: {
            main: '系统设置',
            sub: 'Settings',
            kicker: 'Configuration',
            desc: '管理服务设置、缓存与部署操作。'
        }
    };
    const currentMeta = titles[section] || {
        main: section,
        sub: '',
        kicker: 'Workspace',
        desc: 'LogVar 弹幕 API 页面。'
    };
    const mobileTitle = document.getElementById('mobile-title');
    const mobileSubtitle = document.getElementById('mobile-subtitle');
    if (mobileTitle) {
        mobileTitle.textContent = currentMeta.main;
        if (mobileSubtitle) {
            mobileSubtitle.textContent = currentMeta.sub;
        }
    }

    const desktopKicker = document.getElementById('desktop-active-kicker');
    const desktopTitle = document.getElementById('desktop-active-title');
    const desktopDesc = document.getElementById('desktop-active-desc');
    if (desktopKicker) desktopKicker.textContent = currentMeta.kicker;
    if (desktopTitle) desktopTitle.textContent = currentMeta.main;
    if (desktopDesc) desktopDesc.textContent = currentMeta.desc;

    document.title = currentMeta.main + ' · LogVar弹幕API';
    
    // 仅在移动端且侧边栏已打开时才关闭，避免误触发打开抽屉
    if (!isInitialLoad && isMobileView) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('active')) {
            toggleSidebar(false);
        }
    }

    syncMobileNavigationChrome(true);
    
    // 滚动到顶部
    if (!isInitialLoad) {
        window.scrollTo({ top: 0, behavior: isMobileView ? 'auto' : 'smooth' });
    }
    
    const sectionTitle = (titles && titles[section] && titles[section].main) ? titles[section].main : section;
    if (!isInitialLoad && !isMobileView) {
        addLog(\`切换到\${sectionTitle}模块 📍\`, 'info');
    }

    if (!isInitialLoad || configCache) {
        ensureSectionData(section);
    }

    // 保存当前页面到存储，以便刷新后恢复
    // 安全优化：受 TOKEN/ADMIN_TOKEN 保护的页面仅使用 sessionStorage 记忆，避免关闭页面后仍“卡在管理页”
    try {
        if (PROTECTED_UI_SECTIONS.includes(section)) {
            sessionStorage.setItem('activeSection', section);
            localStorage.removeItem('activeSection');
        } else {
            localStorage.setItem('activeSection', section);
            sessionStorage.setItem('activeSection', section);
        }
    } catch (e) {
        // 忽略存储异常（隐私模式/禁用存储等）
    }
}

/* ========================================
   类别切换
   ======================================== */
function switchCategory(category) {
    currentCategory = category;
    
    // 添加切换动画
    const envList = document.getElementById('env-list');
    envList.style.opacity = '0';
    envList.style.transform = 'translateY(20px)';
    
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    
    setTimeout(() => {
        renderEnvList();
        envList.style.transition = 'all 0.3s ease';
        envList.style.opacity = '1';
        envList.style.transform = 'translateY(0)';
    }, 150);
}

/* ========================================
   自定义弹窗组件
   ======================================== */
function createCustomAlert() {
    if (document.getElementById('custom-alert-overlay')) {
        return;
    }

    const alertHTML = \`
        <div class="modal-overlay" id="custom-alert-overlay">
            <div class="modal-container" style="max-width: 480px;">
                <div class="modal-header">
                    <h3 class="modal-title" id="custom-alert-title">💡 提示</h3>
                    <button class="modal-close" id="custom-alert-close">×</button>
                </div>
                <div class="modal-body">
                    <p id="custom-alert-message" style="color: var(--text-secondary); margin: 0; line-height: 1.7;"></p>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" id="custom-alert-confirm">
                        <span>确定</span>
                    </button>
                </div>
            </div>
        </div>
    \`;

    document.body.insertAdjacentHTML('beforeend', alertHTML);

    const overlay = document.getElementById('custom-alert-overlay');
    const closeBtn = document.getElementById('custom-alert-close');
    const confirmBtn = document.getElementById('custom-alert-confirm');

    function closeAlert() {
        overlay.classList.remove('active');
        setTimeout(() => {
            document.getElementById('custom-alert-title').textContent = '💡 提示';
        }, 300);
    }

    closeBtn.addEventListener('click', closeAlert);
    confirmBtn.addEventListener('click', closeAlert);

    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            closeAlert();
        }
    });
}

function customAlert(message, title = '💡 提示') {
    createCustomAlert();
    initMobileViewportFixes();
    const overlay = document.getElementById('custom-alert-overlay');
    const titleElement = document.getElementById('custom-alert-title');
    const messageElement = document.getElementById('custom-alert-message');

    titleElement.textContent = title;
    messageElement.textContent = message;
    overlay.classList.add('active');
}

function customConfirm(message, title = '❓ 确认') {
    return new Promise((resolve) => {
        createCustomAlert();
    initMobileViewportFixes();
        const overlay = document.getElementById('custom-alert-overlay');
        const titleElement = document.getElementById('custom-alert-title');
        const messageElement = document.getElementById('custom-alert-message');
        const confirmBtn = document.getElementById('custom-alert-confirm');

        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

        titleElement.textContent = title;
        messageElement.textContent = message;

        newConfirmBtn.addEventListener('click', () => {
            overlay.classList.remove('active');
            resolve(true);
        });

        document.getElementById('custom-alert-close').addEventListener('click', () => {
            overlay.classList.remove('active');
            resolve(false);
        });

        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                overlay.classList.remove('active');
                resolve(false);
            }
        });

        overlay.classList.add('active');
    });
}

/* ========================================
   构建API URL
   ======================================== */
function buildApiUrl(path, isSystemPath = false) {
    let res;
    // 如果是系统管理路径且有admin token,则使用admin token
    if (isSystemPath && currentAdminToken && currentAdminToken.trim() !== '' && currentAdminToken.trim() !== '*'.repeat(currentAdminToken.length)) {
        res = '/' + currentAdminToken + path;
    } else {
        // 否则使用普通token
        res = (currentToken ? '/' + currentToken : "") + path;
    }
    
    // 如果配置了自定义基础URL (解决反代问题)
    if (customBaseUrl) {
        // 确保路径以/开头
        const cleanPath = res.startsWith('/') ? res : '/' + res;
        return customBaseUrl + cleanPath;
    }

    return res;
}

function getUrlTokenFromLocation() {
    let urlPath = window.location.pathname;
    if (customBaseUrl) {
        try {
            let proxyPath = customBaseUrl.startsWith('http')
                ? new URL(customBaseUrl).pathname
                : customBaseUrl;

            if (proxyPath.endsWith('/')) {
                proxyPath = proxyPath.slice(0, -1);
            }

            if (proxyPath && urlPath.startsWith(proxyPath)) {
                urlPath = urlPath.substring(proxyPath.length);
            }
        } catch (e) {
            console.error('解析反代路径失败', e);
        }
    }

    const pathParts = urlPath.split('/').filter(part => part !== '');
    return pathParts.length > 0 ? pathParts[0] : '';
}

function hasProtectedUiAccessToken() {
    const urlToken = getUrlTokenFromLocation();
    if (!urlToken) {
        return false;
    }

    if (currentAdminToken && currentAdminToken.trim() !== '' && urlToken === currentAdminToken) {
        return true;
    }

    if (originalToken && urlToken === originalToken) {
        return true;
    }

    if (currentToken && currentToken !== 'globals.currentToken' && urlToken === currentToken) {
        return true;
    }

    return false;
}

/* ========================================
   加载环境变量
   ======================================== */
function loadEnvVariables(preloadedConfig) {
    showLoadingIndicator('env-list');

    Promise.resolve(preloadedConfig || fetchUiConfig())
        .then(config => {
            applyConfigState(config);
            hideLoadingIndicator('env-list');
            if (activeSectionId === 'env') {
                renderEnvList();
            }
        })
        .catch(error => {
            console.error('Failed to load env variables:', error);
            hideLoadingIndicator('env-list');
            showErrorMessage('env-list', '加载配置失败: ' + error.message);
        });
}

/* ========================================
   显示加载指示器
   ======================================== */
function showLoadingIndicator(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = \`
            <div style="text-align: center; padding: 3rem;">
                <div class="loading-spinner" style="margin: 0 auto;"></div>
                <p style="margin-top: 1rem; color: var(--text-secondary); font-weight: 500;">加载中...</p>
            </div>
        \`;
    }
}

function hideLoadingIndicator(containerId) {
    // 加载指示器会被实际内容替换
}

function showErrorMessage(containerId, message) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = \`
            <div style="text-align: center; padding: 3rem; color: var(--danger-color);">
                <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
                <p style="font-weight: 600;">\${message}</p>
            </div>
        \`;
    }
}

/* ========================================
   更新API端点信息
   ======================================== */
function updateApiEndpoint(preloadedConfig) {
  return Promise.resolve(preloadedConfig || fetchUiConfig())
    .then(config => {
      let _reverseProxy = customBaseUrl; // 使用全局配置

      // 获取当前页面的协议、主机和端口
      const protocol = window.location.protocol;
      const host = window.location.host;
      const token = config.originalEnvVars?.TOKEN || '87654321'; // 默认token值
      const adminToken = config.originalEnvVars?.ADMIN_TOKEN;

      originalToken = token;
      currentAdminToken = adminToken || '';

      // 获取URL路径并提取token
      let urlPath = window.location.pathname;
      if(_reverseProxy) {
          try {
              let proxyPath = _reverseProxy.startsWith('http') 
                  ? new URL(_reverseProxy).pathname 
                  : _reverseProxy;
              
              if (proxyPath.endsWith('/')) {
                  proxyPath = proxyPath.slice(0, -1);
              }
              if(proxyPath && urlPath.startsWith(proxyPath)) {
                  urlPath = urlPath.substring(proxyPath.length);
              }
          } catch(e) { /* ignore */ }
      }

      const pathParts = urlPath.split('/').filter(part => part !== '');
      const urlToken = pathParts.length > 0 ? pathParts[0] : '';
      let apiToken = '********';
      
      // 判断是否使用默认token
      if (token === '87654321') {
        // 如果是默认token，则显示真实token
        apiToken = token;
      } else {
        // 如果不是默认token，则检查URL中的token是否匹配，匹配则显示真实token，否则显示星号
        if (urlToken === token || (adminToken !== "" && urlToken === adminToken)) {
          apiToken = token; // 更新全局token变量
        }
      }
      
      // 构造API端点URL
      let baseUrlStr;
      if (_reverseProxy) {
          // 如果配置了反代，且是相对路径，则补全协议和主机，确保显示为绝对路径
          baseUrlStr = _reverseProxy.startsWith('http') 
              ? _reverseProxy 
              : (protocol + '//' + host + _reverseProxy);
      } else {
          baseUrlStr = protocol + '//' + host;
      }

      // 确保 baseUrlStr 不以斜杠结尾
      let cleanBaseUrl = baseUrlStr;
      if (cleanBaseUrl.endsWith('/')) {
          cleanBaseUrl = cleanBaseUrl.slice(0, -1);
      }
      const apiEndpoint = cleanBaseUrl + '/' + apiToken;
      
      setApiEndpointDisplay(apiEndpoint);
      return config; // 返回配置信息，以便链式调用
    })
    .catch(error => {
      console.error('获取配置信息失败:', error);
      // 出错时显示默认值
      const protocol = window.location.protocol;
      const host = window.location.host;
      let _reverseProxy = customBaseUrl;
      
      // 构造显示用的BaseUrl
      let baseUrlStr;
      if (_reverseProxy) {
          baseUrlStr = _reverseProxy.startsWith('http') 
              ? _reverseProxy 
              : (protocol + '//' + host + _reverseProxy);
      } else {
          baseUrlStr = protocol + '//' + host;
      }

      let cleanBaseUrl = baseUrlStr;
      if (cleanBaseUrl.endsWith('/')) {
          cleanBaseUrl = cleanBaseUrl.slice(0, -1);
      }
      const apiEndpoint = cleanBaseUrl + '/********';
      
      setApiEndpointDisplay(apiEndpoint);
      
      // 如果是因为反代导致的问题，显示输入框
      const proxyContainer = document.getElementById('proxy-config-container');
      if(proxyContainer) {
          proxyContainer.style.display = 'block';
          // 填充当前输入框（如果有值）
          if(customBaseUrl) {
              document.getElementById('custom-base-url').value = customBaseUrl;
          }
      }

      throw error; // 抛出错误，以便调用者可以处理
    });
}

/* ========================================
   Runtime 版本与运行状态
   ======================================== */
function escapeRuntimeHtml(value) {
    const text = value == null ? '' : String(value);
    if (typeof escapeHtml === 'function') {
        return escapeHtml(text);
    }
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function updateAllLatestVersionElements(text) {
    latestVersion = text || '';
}

function updateVersionStatusAll(state, text) {
    const statusEls = [
        { el: document.getElementById('version-status'), prefix: 'version-status' },
        { el: document.getElementById('mobile-version-status'), prefix: 'mvb-status' },
        { el: document.getElementById('hero-version-status'), prefix: 'hero-version-status' }
    ];

    const stateClass = {
        uptodate: '-uptodate',
        update: '-update',
        failed: '-failed',
        checking: '-checking'
    };

    statusEls.forEach(function(item) {
        if (!item.el) return;
        item.el.className = item.prefix + ' ' + item.prefix + (stateClass[state] || '');
        item.el.textContent = text;
    });
}

function syncCurrentVersionElements(version) {
    ['hero-current-version', 'mobile-current-version'].forEach(function(id) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = version;
        }
    });
}

function compareVersions(v1, v2) {
    const cleanV1 = String(v1 || '').replace(/^v/, '');
    const cleanV2 = String(v2 || '').replace(/^v/, '');
    const parts1 = cleanV1.split('.').map(Number);
    const parts2 = cleanV2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const part1 = parts1[i] || 0;
        const part2 = parts2[i] || 0;
        if (part1 > part2) return 1;
        if (part1 < part2) return -1;
    }

    return 0;
}

function syncRuntimeSummary(info) {
    if (!info) return;

    const versionInfo = info.version || {};
    const runtimeLabel = getRuntimeTypeLabel(info.runtimeType, info);
    currentVersion = String(versionInfo.current || currentVersion || '未知');
    latestVersion = String(versionInfo.latest || '');
    syncCurrentVersionElements(currentVersion);
    updateAllLatestVersionElements(latestVersion);

    const display = info.display || {};
    const platformText = (info.service && info.service.platformLabel) || deployEnvStatus.platformLabel || runtimeLabel;
    const cpuText = Number.isFinite(display.cpuPercent) ? (Math.round(display.cpuPercent || 0) + '%') : '--';
    const memoryText = Number.isFinite(display.memoryPercent) ? (Math.round(display.memoryPercent || 0) + '%') : '--';
    const fallbackStatus = versionInfo.error
        ? '运行时已同步，版本检查失败'
        : (versionInfo.hasUpdate && latestVersion
            ? ('运行时已同步，可更新至 ' + latestVersion)
            : '运行时已同步，可查看实时资源指标');

    if (versionInfo.error) {
        updateVersionStatusAll('failed', '检查失败');
        updateSidebarInfoCard({
            runtimeLabel: runtimeLabel,
            versionState: 'failed',
            versionText: '版本检查失败',
            deployPlatform: platformText,
            cpuText: cpuText,
            memoryText: memoryText,
            serviceStatus: sidebarInfoState.serviceStatus === '正在同步服务状态与版本信息' ? fallbackStatus : sidebarInfoState.serviceStatus
        });
        return;
    }

    if (versionInfo.hasUpdate && latestVersion) {
        updateVersionStatusAll('update', '可更新 ' + latestVersion);
        updateSidebarInfoCard({
            runtimeLabel: runtimeLabel,
            versionState: 'update',
            versionText: '新版本 ' + latestVersion,
            deployPlatform: platformText,
            cpuText: cpuText,
            memoryText: memoryText,
            serviceStatus: sidebarInfoState.serviceStatus === '正在同步服务状态与版本信息' ? fallbackStatus : sidebarInfoState.serviceStatus
        });
        return;
    }

    if (latestVersion) {
        updateVersionStatusAll('uptodate', '已是最新');
        updateSidebarInfoCard({
            runtimeLabel: runtimeLabel,
            versionState: 'uptodate',
            versionText: '当前 ' + currentVersion,
            deployPlatform: platformText,
            cpuText: cpuText,
            memoryText: memoryText,
            serviceStatus: sidebarInfoState.serviceStatus === '正在同步服务状态与版本信息' ? fallbackStatus : sidebarInfoState.serviceStatus
        });
        return;
    }

    updateVersionStatusAll('checking', '检查中...');
    updateSidebarInfoCard({
        runtimeLabel: runtimeLabel,
        versionState: 'checking',
        versionText: currentVersion ? ('当前 ' + currentVersion) : '版本检测中',
        deployPlatform: platformText,
        cpuText: cpuText,
        memoryText: memoryText,
        serviceStatus: sidebarInfoState.serviceStatus === '正在同步服务状态与版本信息' ? fallbackStatus : sidebarInfoState.serviceStatus
    });
}

async function requestRuntimeInfo(forceCheck) {
    const endpoint = buildApiUrl(forceCheck ? '/api/runtime/check-update' : '/api/runtime/info');
    const response = await fetch(endpoint, forceCheck ? { method: 'POST' } : undefined);
    let payload = {};

    try {
        payload = await response.json();
    } catch (error) {
        payload = {};
    }

    if (!response.ok || payload.success === false) {
        throw new Error(payload.message || payload.errorMessage || ('HTTP ' + response.status));
    }

    return payload;
}

async function loadRuntimeInfo(forceCheck) {
    if (!forceCheck && runtimeInfoRequest) {
        return runtimeInfoRequest;
    }

    const request = requestRuntimeInfo(Boolean(forceCheck))
        .then(function(info) {
            const enrichedInfo = enrichRuntimeInfo(info);
            runtimeInfo = enrichedInfo;
            syncRuntimeSummary(enrichedInfo);
            return enrichedInfo;
        })
        .catch(function(error) {
            if (!forceCheck) {
                const pendingInfo = markRuntimeUpdateAsWaiting(error);
                if (pendingInfo) {
                    return pendingInfo;
                }
            }
            updateVersionStatusAll('failed', '检查失败');
            updateSidebarInfoCard({
                versionState: 'failed',
                versionText: '版本检查失败'
            });
            throw error;
        })
        .finally(function() {
            if (runtimeInfoRequest === request) {
                runtimeInfoRequest = null;
            }
        });

    if (!forceCheck) {
        runtimeInfoRequest = request;
    }

    return request;
}

async function refreshRuntimeSummary(forceCheck) {
    try {
        return await loadRuntimeInfo(Boolean(forceCheck));
    } catch (error) {
        console.error('加载运行时信息失败:', error);
        return null;
    }
}

function getRuntimeTypeLabel(type, info) {
    if (type === 'docker') return 'Docker 容器';
    if (type === 'node') return 'Node 本地进程';
    if (type === 'cloud') return (info && info.service && info.service.platformLabel) ? info.service.platformLabel + ' 云部署' : '云平台部署';
    return '未知运行时';
}

function formatRuntimeTimestamp(value) {
    if (!value) return '暂无';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('zh-CN', { hour12: false });
}

function formatRuntimeClock(value) {
    if (!value) return '--:--:--';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '--:--:--';
    return date.toLocaleTimeString('zh-CN', { hour12: false });
}

function formatRuntimeBytes(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) return '不可用';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = number;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
    }
    return (size >= 100 ? size.toFixed(0) : size.toFixed(1)) + ' ' + units[unitIndex];
}

function formatRuntimeRate(bytesPerSecond) {
    const number = Number(bytesPerSecond);
    if (!Number.isFinite(number) || number < 0) return '-- B/s';
    return formatRuntimeBytes(number) + '/s';
}

function clampRuntimePercent(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.min(number, 100));
}

function enrichRuntimeInfo(info) {
    const metrics = info && info.metrics ? info.metrics : {};
    const now = Date.now();
    const currentRx = Number(metrics.networkRx);
    const currentTx = Number(metrics.networkTx);
    let rxRate = null;
    let txRate = null;

    if (runtimeTrafficSample && Number.isFinite(currentRx) && Number.isFinite(currentTx)) {
        const elapsedMs = now - runtimeTrafficSample.time;
        if (elapsedMs > 0 && elapsedMs <= 15000) {
            rxRate = Math.max(0, (currentRx - runtimeTrafficSample.rx) * 1000 / elapsedMs);
            txRate = Math.max(0, (currentTx - runtimeTrafficSample.tx) * 1000 / elapsedMs);
        }
    }

    if (Number.isFinite(currentRx) && Number.isFinite(currentTx)) {
        runtimeTrafficSample = { time: now, rx: currentRx, tx: currentTx };
    } else {
        runtimeTrafficSample = null;
    }

    runtimeLastSyncedAt = now;

    const memoryUsed = Number(metrics.memoryUsed);
    const memoryLimit = Number(metrics.memoryLimit);
    const display = {
        syncedAt: now,
        syncedAtText: formatRuntimeClock(now),
        cpuPercent: clampRuntimePercent(metrics.cpuPercent),
        memoryPercent: (Number.isFinite(memoryUsed) && Number.isFinite(memoryLimit) && memoryLimit > 0)
            ? clampRuntimePercent(memoryUsed * 100 / memoryLimit)
            : 0,
        memoryUsedText: Number.isFinite(memoryUsed) ? formatRuntimeBytes(memoryUsed) : '不可用',
        memoryLimitText: Number.isFinite(memoryLimit) && memoryLimit > 0 ? formatRuntimeBytes(memoryLimit) : '不可用',
        networkRxRateText: formatRuntimeRate(rxRate),
        networkTxRateText: formatRuntimeRate(txRate),
        networkRxTotalText: Number.isFinite(currentRx) ? formatRuntimeBytes(currentRx) : '不可用',
        networkTxTotalText: Number.isFinite(currentTx) ? formatRuntimeBytes(currentTx) : '不可用'
    };

    return {
        ...info,
        display
    };
}

function isRuntimeUpdateActiveState(state) {
    return ['queued', 'pulling', 'recreating', 'waiting'].includes(String(state || ''));
}

function getRuntimeUpdateStateText(update) {
    const state = update && update.state ? update.state : 'idle';
    if (state === 'queued') return '已排队';
    if (state === 'pulling') return '拉取镜像';
    if (state === 'recreating') return '重建容器';
    if (state === 'waiting') return '等待恢复';
    if (state === 'success') return '已完成';
    if (state === 'failed') return '失败';
    return '空闲';
}

function getRuntimeUpdateStateTone(update) {
    const state = update && update.state ? update.state : 'idle';
    if (state === 'failed') return 'danger';
    if (state === 'success') return 'ok';
    if (isRuntimeUpdateActiveState(state)) return 'warn';
    return 'neutral';
}

function markRuntimeUpdateAsWaiting(error) {
    if (!runtimeInfo || !runtimeInfo.update || !isRuntimeUpdateActiveState(runtimeInfo.update.state)) {
        return null;
    }

    const waitingMessage = '服务正在重启，等待新容器恢复响应';
    const logs = Array.isArray(runtimeInfo.update.logs) ? runtimeInfo.update.logs.slice() : [];
    const lastLog = logs.length ? logs[logs.length - 1] : null;
    if (!lastLog || lastLog.message !== waitingMessage) {
        logs.push({
            time: new Date().toISOString(),
            message: waitingMessage
        });
    }

    runtimeInfo = {
        ...runtimeInfo,
        update: {
            ...runtimeInfo.update,
            state: 'waiting',
            message: error && error.message ? ('服务短暂不可达：' + error.message) : waitingMessage,
            logs: logs.slice(-40)
        },
        display: {
            ...(runtimeInfo.display || {}),
            syncedAt: Date.now(),
            syncedAtText: formatRuntimeClock(Date.now())
        }
    };

    syncRuntimeSummary(runtimeInfo);
    return runtimeInfo;
}

function getRuntimeHint(info) {
    const isAdmin = Boolean(info && info.auth && info.auth.isAdmin);
    if (!info) return '暂无可用的运行时信息。';

    if (info.runtimeType === 'docker') {
        if (isRuntimeUpdateActiveState(info.update && info.update.state)) {
            return info.update && info.update.state === 'waiting'
                ? '容器正在重建或重启，页面会自动轮询并在服务恢复后同步最终结果。'
                : '在线更新正在后台执行，页面会自动轮询镜像拉取和容器重建进度。';
        }
        if (!info.supportsOnlineUpdate) {
            return '要启用 Docker 在线更新，需要把 docker.sock 挂载进容器，并设置 ENABLE_RUNTIME_CONTROL=true。';
        }
        if (!isAdmin) {
            return '当前仅可查看状态。使用 ADMIN_TOKEN 访问后，才能执行在线更新。';
        }
        return '在线更新会拉取最新镜像并重建当前容器。是否保留旧容器备份由 DOCKER_KEEP_BACKUP 控制。';
    }

    if (info.runtimeType === 'cloud') {
        return isAdmin ? '云平台模式下支持直接触发重新部署。' : '当前仅可查看状态。使用 ADMIN_TOKEN 访问后，才能触发重新部署。';
    }

    return 'Node 模式当前支持查看进程状态与资源占用，暂不支持在线更新。';
}

function buildRuntimeSummaryCards(info) {
    const versionInfo = info.version || {};
    const display = info.display || {};
    const isCloudRuntime = info && info.runtimeType === 'cloud';
    const cards = [
        {
            label: '当前版本',
            value: versionInfo.current || '未知',
            meta: isCloudRuntime ? '当前部署版本' : '服务版本',
            tone: 'neutral',
            mono: true
        },
        {
            label: isCloudRuntime ? '最新发布' : '最新版本',
            value: versionInfo.latest || (versionInfo.error ? '检查失败' : '未知'),
            meta: versionInfo.hasUpdate ? '发现可更新版本' : (isCloudRuntime ? '版本检查结果' : '镜像检查结果'),
            tone: versionInfo.hasUpdate ? 'warn' : (versionInfo.error ? 'danger' : 'neutral'),
            mono: true
        },
        {
            label: '更新状态',
            value: getRuntimeUpdateStateText(info.update || {}),
            meta: '在线更新任务',
            tone: getRuntimeUpdateStateTone(info.update || {})
        },
        {
            label: '更新时间',
            value: display.syncedAtText || '--:--:--',
            meta: '最近一次采样',
            tone: 'neutral',
            mono: true
        }
    ];

    return cards.map(function(card) {
        return '<div class="runtime-status-card runtime-status-card-' + escapeRuntimeHtml(card.tone || 'neutral') + '">' +
            '<span class="runtime-status-card-label">' + escapeRuntimeHtml(card.label) + '</span>' +
            '<div class="runtime-status-card-value' + (card.mono ? ' mono' : '') + '">' + escapeRuntimeHtml(card.value) + '</div>' +
            '<div class="runtime-status-card-meta">' + escapeRuntimeHtml(card.meta || '') + '</div>' +
        '</div>';
    }).join('');
}

function buildRuntimeMetricCards(info) {
    const metrics = info.metrics || {};
    const display = info.display || {};
    const cards = [
        {
            label: 'CPU',
            value: metrics.cpuText || '不可用',
            meta: '容器处理器占用',
            percent: display.cpuPercent || 0,
            tone: 'cpu'
        },
        {
            label: '内存',
            value: display.memoryUsedText || '不可用',
            meta: '总上限 ' + (display.memoryLimitText || '不可用'),
            percent: display.memoryPercent || 0,
            tone: 'memory'
        },
        {
            label: '网络接收',
            value: display.networkRxRateText || '-- B/s',
            meta: '累计 ' + (display.networkRxTotalText || '不可用'),
            percent: 0,
            tone: 'rx'
        },
        {
            label: '网络发送',
            value: display.networkTxRateText || '-- B/s',
            meta: '累计 ' + (display.networkTxTotalText || '不可用'),
            percent: 0,
            tone: 'tx'
        }
    ];

    return cards.map(function(card) {
        return '<div class="runtime-metric-card runtime-metric-card-' + escapeRuntimeHtml(card.tone) + '">' +
            '<div class="runtime-metric-head">' +
                '<span class="runtime-metric-label">' + escapeRuntimeHtml(card.label) + '</span>' +
                '<span class="runtime-metric-badge">' + escapeRuntimeHtml(card.label === 'CPU' || card.label === '内存' ? Math.round(card.percent) + '%' : '实时') + '</span>' +
            '</div>' +
            '<div class="runtime-metric-value">' + escapeRuntimeHtml(card.value) + '</div>' +
            '<div class="runtime-metric-meta">' + escapeRuntimeHtml(card.meta) + '</div>' +
            '<div class="runtime-metric-bar"><span style="width:' + escapeRuntimeHtml(String(clampRuntimePercent(card.percent))) + '%"></span></div>' +
        '</div>';
    }).join('');
}

function buildRuntimeDisclosure(key, title, meta, content, open) {
    return '<details class="runtime-disclosure" data-disclosure-key="' + escapeRuntimeHtml(key || title || '') + '"' + (open ? ' open' : '') + '>' +
        '<summary class="runtime-disclosure-summary">' +
            '<span class="runtime-disclosure-title">' + escapeRuntimeHtml(title) + '</span>' +
            '<span class="runtime-disclosure-meta">' + escapeRuntimeHtml(meta || '') + '</span>' +
        '</summary>' +
        '<div class="runtime-disclosure-content">' + content + '</div>' +
    '</details>';
}

function captureRuntimeStatusViewState() {
    const body = document.getElementById('runtime-status-body');
    if (!body) {
        return { openKeys: [], scrollTop: 0 };
    }

    const openKeys = Array.from(body.querySelectorAll('.runtime-disclosure[open]')).map(function(item) {
        return item.dataset.disclosureKey || '';
    }).filter(Boolean);

    return {
        openKeys: openKeys,
        scrollTop: body.scrollTop || 0
    };
}

function restoreRuntimeStatusViewState(viewState) {
    if (!viewState) {
        return;
    }

    const body = document.getElementById('runtime-status-body');
    if (!body) {
        return;
    }

    if (Array.isArray(viewState.openKeys)) {
        Array.from(body.querySelectorAll('.runtime-disclosure')).forEach(function(item) {
            const key = item.dataset.disclosureKey || '';
            item.open = viewState.openKeys.includes(key);
        });
    }

    if (typeof viewState.scrollTop === 'number') {
        body.scrollTop = viewState.scrollTop;
    }
}

function buildRuntimeDetailItems(info) {
    const service = info.service || {};
    const items = [
        { key: '运行时类型', value: getRuntimeTypeLabel(info.runtimeType, info) },
        { key: '当前状态', value: (info.status && info.status.text) || '未知' }
    ];

    if (service.containerName) items.push({ key: '容器名称', value: service.containerName, mono: true });
    if (service.image) items.push({ key: '镜像名称', value: service.image, mono: true });
    if (service.composeProject) items.push({ key: 'Compose Project', value: service.composeProject, mono: true });
    if (service.composeService) items.push({ key: 'Compose Service', value: service.composeService, mono: true });
    if (service.processId) items.push({ key: '进程 PID', value: String(service.processId), mono: true });
    if (service.nodeVersion) items.push({ key: 'Node 版本', value: service.nodeVersion, mono: true });
    if (service.platform) items.push({ key: '平台信息', value: service.platform });
    if (service.startedAt) items.push({ key: '启动时间', value: formatRuntimeTimestamp(service.startedAt) });
    if (service.uptimeSeconds != null) items.push({ key: '运行时长', value: String(service.uptimeSeconds) + ' 秒' });
    if (info.update && info.update.startedAt) items.push({ key: '最近更新开始', value: formatRuntimeTimestamp(info.update.startedAt) });
    if (info.update && info.update.endedAt) items.push({ key: '最近更新结束', value: formatRuntimeTimestamp(info.update.endedAt) });

    return items.map(function(item) {
        return '<div class="runtime-status-detail-item">' +
            '<span class="runtime-status-detail-key">' + escapeRuntimeHtml(item.key) + '</span>' +
            '<div class="runtime-status-detail-value' + (item.mono ? ' mono' : '') + '">' + escapeRuntimeHtml(item.value) + '</div>' +
        '</div>';
    }).join('');
}

function buildRuntimeLogs(info) {
    const logsList = info && info.update && Array.isArray(info.update.logs) ? info.update.logs : [];
    if (!logsList.length) {
        return '<div class="runtime-status-empty">当前还没有更新日志。触发在线更新后，这里会显示最近的进度记录。</div>';
    }

    return '<div class="runtime-status-log-list">' + logsList.map(function(item) {
        return '<div class="runtime-status-log-item">' +
            '<span class="runtime-status-log-time">' + escapeRuntimeHtml(formatRuntimeTimestamp(item.time)) + '</span>' +
            '<p class="runtime-status-log-message">' + escapeRuntimeHtml(item.message) + '</p>' +
        '</div>';
    }).join('') + '</div>';
}

function resolveRuntimePrimaryAction(info) {
    const isAdmin = Boolean(info && info.auth && info.auth.isAdmin);
    const updateState = info && info.update ? info.update.state : 'idle';

    if (!info) {
        return { type: 'none', label: '加载中', disabled: true, title: '' };
    }

    if (info.runtimeType === 'docker') {
        if (isRuntimeUpdateActiveState(updateState)) {
            return {
                type: 'none',
                label: getRuntimeUpdateStateText(info.update || {}),
                disabled: true,
                title: '后台更新任务正在执行'
            };
        }
        if (!info.supportsOnlineUpdate) {
            return { type: 'none', label: '未启用在线更新', disabled: true, title: '需要挂载 docker.sock 并开启 ENABLE_RUNTIME_CONTROL' };
        }
        if (!isAdmin) {
            return { type: 'none', label: '需要管理员权限', disabled: true, title: '请使用 ADMIN_TOKEN 访问后操作' };
        }
        if (!(info.version && info.version.hasUpdate)) {
            return { type: 'none', label: '已是最新版本', disabled: true, title: '当前镜像无需在线更新' };
        }
        return { type: 'update', label: '在线更新', disabled: false, title: '拉取最新镜像并重建当前容器' };
    }

    if (info.runtimeType === 'cloud') {
        if (!info.supportsRedeploy) {
            return { type: 'none', label: '当前不可操作', disabled: true, title: '' };
        }
        if (!isAdmin) {
            return { type: 'none', label: '需要管理员权限', disabled: true, title: '请使用 ADMIN_TOKEN 访问后操作' };
        }
        return { type: 'redeploy', label: '重新部署', disabled: false, title: '调用现有部署流程重新发布服务' };
    }

    return { type: 'none', label: 'Node 模式暂不支持', disabled: true, title: '当前仅支持查看本地进程状态' };
}

function updateRuntimePrimaryActionButton(info) {
    const button = document.getElementById('runtime-primary-action-btn');
    if (!button) return;

    const action = resolveRuntimePrimaryAction(info);
    const text = button.querySelector('span');
    button.dataset.action = action.type;
    button.disabled = Boolean(action.disabled);
    button.title = action.title || '';
    button.className = 'btn ' + (action.type === 'update' || action.type === 'redeploy' ? 'btn-success' : 'btn-primary') + ' btn-modal';
    if (text) {
        text.textContent = action.label;
    } else {
        button.textContent = action.label;
    }
}

function renderRuntimeStatusBody(info) {
    const body = document.getElementById('runtime-status-body');
    if (!body) return;

    const versionInfo = info.version || {};
    const service = info.service || {};
    const display = info.display || {};
    const statusText = info.status && info.status.text ? info.status.text : '未知';
    const heroClass = versionInfo.error ? 'error' : (versionInfo.hasUpdate ? 'has-update' : '');
    const updateMessage = info.update && info.update.message ? info.update.message : '暂无更新任务。';
    const chipClass = versionInfo.error ? 'error' : (versionInfo.hasUpdate ? 'warn' : 'ok');
    const updateState = info.update && info.update.state ? info.update.state : 'idle';
    const serviceMeta = service.containerName || service.platformLabel || service.platform || service.name || 'danmu-api';
    const updateHint = getRuntimeHint(info);

    body.innerHTML =
        '<div class="runtime-status-stack">' +
            '<section class="runtime-status-hero ' + heroClass + '">' +
                '<div class="runtime-status-hero-content">' +
                    '<div class="runtime-status-topbar">' +
                        '<span class="runtime-status-eyebrow">' + escapeRuntimeHtml(getRuntimeTypeLabel(info.runtimeType, info)) + '</span>' +
                        '<span class="runtime-status-live-dot">实时刷新</span>' +
                    '</div>' +
                    '<div class="runtime-status-title-row">' +
                        '<div class="runtime-status-title-block">' +
                            '<h4 class="runtime-status-title">' + escapeRuntimeHtml(statusText) + '</h4>' +
                            '<p class="runtime-status-subtitle">' + escapeRuntimeHtml(serviceMeta) + ' · ' + escapeRuntimeHtml(display.syncedAtText || '--:--:--') + '</p>' +
                        '</div>' +
                        '<div class="runtime-status-chip-row">' +
                            '<span class="runtime-status-chip ' + chipClass + '">' + escapeRuntimeHtml(versionInfo.hasUpdate ? '可更新' : (versionInfo.error ? '检查失败' : '版本正常')) + '</span>' +
                            '<span class="runtime-status-chip">' + escapeRuntimeHtml(getRuntimeUpdateStateText(info.update || {})) + '</span>' +
                            '<span class="runtime-status-chip">' + escapeRuntimeHtml((info.auth && info.auth.isAdmin) ? '管理员' : '只读') + '</span>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</section>' +
            '<div class="runtime-status-summary-grid">' + buildRuntimeSummaryCards(info) + '</div>' +
            '<section class="runtime-status-section runtime-status-section-metrics">' +
                '<div class="runtime-status-section-header">' +
                    '<h4 class="runtime-status-section-title">资源指标</h4>' +
                    '<span class="runtime-status-section-meta">打开弹窗后每秒自动刷新</span>' +
                '</div>' +
                '<div class="runtime-metrics-grid">' + buildRuntimeMetricCards(info) + '</div>' +
            '</section>' +
            '<div class="runtime-status-note runtime-status-note-inline">' + escapeRuntimeHtml(updateHint) + '</div>' +
            buildRuntimeDisclosure(
                'service-detail',
                '服务详情',
                '容器与运行环境',
                '<div class="runtime-status-detail-grid">' + buildRuntimeDetailItems(info) + '</div>',
                false
            ) +
            buildRuntimeDisclosure(
                'update-logs',
                '更新日志',
                updateMessage,
                buildRuntimeLogs(info),
                isRuntimeUpdateActiveState(updateState) || updateState === 'failed'
            ) +
        '</div>';

    updateRuntimePrimaryActionButton(info);
}

function renderRuntimeStatusError(error) {
    const body = document.getElementById('runtime-status-body');
    if (!body) return;

    body.innerHTML = '<div class="runtime-status-error">加载运行时信息失败：' + escapeRuntimeHtml(error && error.message ? error.message : '未知错误') + '</div>';
    updateRuntimePrimaryActionButton(null);
}

function setRuntimeStatusLoading(message) {
    const body = document.getElementById('runtime-status-body');
    if (!body) return;

    body.innerHTML = '<div class="runtime-status-loading">' + escapeRuntimeHtml(message || '正在加载运行时信息...') + '</div>';
    updateRuntimePrimaryActionButton(null);
}

async function openRuntimeStatusModal(forceCheck) {
    const modal = document.getElementById('runtime-status-modal');
    if (!modal) return;

    const modalWasActive = modal.classList.contains('active');
    const viewState = modalWasActive ? captureRuntimeStatusViewState() : null;
    modal.classList.add('active');
    if (!modalWasActive || !runtimeInfo) {
        setRuntimeStatusLoading(forceCheck ? '正在重新检查版本与运行状态...' : '正在加载运行时信息...');
    }

    try {
        const info = await loadRuntimeInfo(Boolean(forceCheck));
        renderRuntimeStatusBody(info);
        restoreRuntimeStatusViewState(viewState);
        startRuntimePolling();
    } catch (error) {
        console.error('打开运行状态面板失败:', error);
        renderRuntimeStatusError(error);
    }
}

function closeRuntimeStatusModal() {
    stopRuntimePolling();
    const modal = document.getElementById('runtime-status-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

async function refreshRuntimeStatusModal() {
    await openRuntimeStatusModal(true);
}

function stopRuntimePolling() {
    if (runtimePollTimer) {
        clearInterval(runtimePollTimer);
        runtimePollTimer = null;
    }
}

function startRuntimePolling() {
    stopRuntimePolling();
    runtimePollTimer = setInterval(async function() {
        const modal = document.getElementById('runtime-status-modal');
        if (!modal || !modal.classList.contains('active') || document.hidden) {
            return;
        }

        if (runtimePollInFlight) {
            return;
        }

        try {
            runtimePollInFlight = true;
            const viewState = captureRuntimeStatusViewState();
            const info = await loadRuntimeInfo(false);
            renderRuntimeStatusBody(info);
            restoreRuntimeStatusViewState(viewState);
        } catch (error) {
            console.error('运行时轮询失败:', error);
        } finally {
            runtimePollInFlight = false;
        }
    }, RUNTIME_MODAL_REFRESH_INTERVAL_MS);
}

async function handleRuntimePrimaryAction() {
    const action = resolveRuntimePrimaryAction(runtimeInfo);
    if (action.disabled) return;

    if (action.type === 'redeploy') {
        closeRuntimeStatusModal();
        if (typeof showDeploySystemModal === 'function') {
            showDeploySystemModal();
        }
        return;
    }

    if (action.type !== 'update') {
        return;
    }

    const confirmed = await customConfirm(
        '将拉取最新镜像并重建当前容器，期间服务会短暂中断。是否继续？',
        '🚀 在线更新'
    );

    if (!confirmed) {
        return;
    }

    const button = document.getElementById('runtime-primary-action-btn');
    const label = button ? button.querySelector('span') : null;
    const oldText = label ? label.textContent : '';
    let shouldRestoreButton = true;

    if (button) button.disabled = true;
    if (label) label.textContent = '提交中...';

    try {
        const response = await fetch(buildApiUrl('/api/runtime/update', true), { method: 'POST' });
        let payload = {};
        try {
            payload = await response.json();
        } catch (error) {
            payload = {};
        }

        if (!response.ok || !payload.success) {
            throw new Error(payload.message || payload.errorMessage || ('HTTP ' + response.status));
        }

        if (!runtimeInfo) runtimeInfo = {};
        if (!runtimeInfo.update) runtimeInfo.update = {};
        runtimeInfo.update.state = 'queued';
        runtimeInfo.update.message = payload.message || '更新任务已启动，等待后台容器接管';
        runtimeInfo.update.startedAt = new Date().toISOString();
        runtimeInfo.update.endedAt = '';
        runtimeInfo.update.logs = (Array.isArray(runtimeInfo.update.logs) ? runtimeInfo.update.logs : []).concat([{
            time: new Date().toISOString(),
            message: '已提交在线更新任务，等待后台容器接管'
        }]).slice(-40);
        renderRuntimeStatusBody(runtimeInfo);
        shouldRestoreButton = false;
        customAlert(payload.message || '在线更新任务已启动，页面会自动刷新阶段状态', '🚀 更新任务已启动');
        addLog('🚀 已提交在线更新任务', 'info');
    } catch (error) {
        console.error('在线更新失败:', error);
        customAlert('在线更新失败：' + error.message, '❌ 更新失败');
        if (runtimeInfo) {
            renderRuntimeStatusBody(runtimeInfo);
        } else {
            renderRuntimeStatusError(error);
        }
    } finally {
        if (shouldRestoreButton) {
            if (button) button.disabled = false;
            if (label && oldText) label.textContent = oldText;
        }
    }
}

function showUpdateGuide() {
    openRuntimeStatusModal(true);
}

/* ========================================
   复制API端点
   ======================================== */
function getApiEndpointElements() {
    return ['mobile-api-endpoint', 'api-endpoint']
        .map(id => document.getElementById(id))
        .filter(Boolean);
}

let apiEndpointFeedbackTimer = null;

function setApiEndpointDisplay(value) {
    getApiEndpointElements().forEach(element => {
        element.textContent = value;
        element.dataset.endpointValue = value;
        element.title = value;
    });
}

function copyApiEndpoint() {
    const endpointElements = getApiEndpointElements();
    const visibleElement = endpointElements.find(element => element.offsetParent !== null) || endpointElements[0];
    if (!visibleElement) {
        return;
    }

    const apiEndpoint = (visibleElement.dataset.endpointValue || visibleElement.textContent || '').trim();
    if (!apiEndpoint) {
        return;
    }

    navigator.clipboard.writeText(apiEndpoint)
        .then(() => {
            if (apiEndpointFeedbackTimer) {
                clearTimeout(apiEndpointFeedbackTimer);
                apiEndpointFeedbackTimer = null;
            }

            endpointElements.forEach(element => {
                if (!element.dataset.endpointValue) {
                    element.dataset.endpointValue = apiEndpoint;
                }
                element.textContent = '✓ 已复制!';
                element.style.color = '#10b981';
            });

            const feedbackCards = new Set();
            endpointElements.forEach(element => {
                const card = element.closest('.api-endpoint-card, .hero-endpoint-panel');
                if (card) {
                    feedbackCards.add(card);
                }
            });

            feedbackCards.forEach(card => {
                card.style.transform = 'translateY(-1px) scale(1.01)';
                card.style.boxShadow = '0 16px 34px rgba(16, 185, 129, 0.18)';
            });

            setTimeout(() => {
                feedbackCards.forEach(card => {
                    card.style.transform = '';
                    card.style.boxShadow = '';
                });
            }, 320);

            apiEndpointFeedbackTimer = setTimeout(() => {
                endpointElements.forEach(element => {
                    element.textContent = element.dataset.endpointValue || apiEndpoint;
                    element.style.color = '';
                });
                apiEndpointFeedbackTimer = null;
            }, 1800);

            addLog('API端点已复制到剪贴板 📋: ' + apiEndpoint, 'success');
        })
        .catch(err => {
            console.error('复制失败:', err);
            customAlert('复制失败: ' + err, '❌ 复制失败');
            addLog('复制API端点失败: ' + err, 'error');
        });
}

/* ========================================
   初始化
   ======================================== */
async function init() {
    // 注意：页面恢复逻辑已移至 DOMContentLoaded 以消除闪烁
    try {
        const config = await fetchUiConfig({ force: true });
        await updateApiEndpoint(config);
        updateCurrentModeDisplay();
        await refreshRuntimeSummary();
        updateDeployEnvStatusBadgeFromConfig(config);
        refreshSidebarConfiguredCount(config);
        setDefaultPushUrl(config);
        checkAndHandleAdminToken();
        applyConfigState(config);
        ensureSectionData(activeSectionId, { force: true, config });
        addLog('🎉 系统初始化完成', 'success');
    } catch (error) {
        console.error('初始化失败:', error);
        addLog('❌ 系统初始化失败: ' + error.message, 'error');
        
        // 确保反代配置框显示
        const proxyContainer = document.getElementById('proxy-config-container');
        if(proxyContainer) {
            proxyContainer.style.display = 'block';
            if(customBaseUrl) {
                document.getElementById('custom-base-url').value = customBaseUrl;
            }
        }
        
    }
    // 初始化弹幕测试相关功能
    if (document.getElementById('danmu-heatmap-canvas')) {
        // 预加载画布
        const canvas = document.getElementById('danmu-heatmap-canvas');
        canvas.width = canvas.offsetWidth;
        canvas.height = 150;

        // 初始化热力图交互（鼠标提示 / 点击查看区间弹幕数）
        if (typeof initDanmuHeatmapInteraction === 'function') {
            initDanmuHeatmapInteraction();
        }
    }
}

/* ========================================
   页面加载完成后初始化
   ======================================== */
document.addEventListener('DOMContentLoaded', function() {
    createCustomAlert();
    initMobileViewportFixes();
    initMobileNavigationChrome();
    updateSidebarInfoCard();
    
    // 1. 优先初始化主题 (防止颜色闪烁)
    initTheme();

    ['hero-version-panel', 'mobile-version-badge'].forEach(function(id) {
        const element = document.getElementById(id);
        if (!element) return;
        element.addEventListener('keydown', function(event) {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openRuntimeStatusModal();
            }
        });
    });

    const runtimeModal = document.getElementById('runtime-status-modal');
    if (runtimeModal) {
        runtimeModal.addEventListener('click', function(event) {
            if (event.target === runtimeModal) {
                closeRuntimeStatusModal();
            }
        });
    }


    // 2. 无闪烁页面恢复逻辑 (核心优化)
    let savedSection = sessionStorage.getItem('activeSection') || localStorage.getItem('activeSection');
    // 没有 URL token 时，避免恢复到受保护页面（例如 /ADMIN_TOKEN 进入后直接关闭导致下次仍停留在管理页）
    const urlToken = getUrlTokenFromLocation();
    if (!urlToken && savedSection && PROTECTED_UI_SECTIONS.includes(savedSection)) {
        try {
            sessionStorage.removeItem('activeSection');
            localStorage.removeItem('activeSection');
        } catch (e) {}
        savedSection = null;
    }

    // 如果保存的页面存在且不是默认的 'preview'
    if (savedSection && savedSection !== 'preview') {
        // [关键步骤 A] 临时注入样式，强制禁用所有过渡动画，防止"淡出淡入"的视觉残留
        const noTransitionStyle = document.createElement('style');
        noTransitionStyle.id = 'temp-no-transition';
        noTransitionStyle.innerHTML = '* { transition: none !important; animation: none !important; }';
        document.head.appendChild(noTransitionStyle);

        // [关键步骤 B] 暴力移除所有默认 active 状态，防止主页露头
        document.querySelectorAll('.content-section.active').forEach(el => {
            el.classList.remove('active');
            el.style.display = 'none'; // 强制隐藏默认页面
        });
        document.querySelectorAll('.nav-item.active').forEach(el => {
            el.classList.remove('active');
        });

        // [关键步骤 C] 立即渲染目标页面
        performSectionSwitch(savedSection, true);

        // [关键步骤 D] 下一帧恢复动画和布局
        requestAnimationFrame(() => {
            setTimeout(() => {
                // 移除禁用动画的样式
                const style = document.getElementById('temp-no-transition');
                if (style) style.remove();
                
                // 清理强制添加的 display: none，交还给 CSS 类控制
                document.querySelectorAll('.content-section').forEach(el => {
                    el.style.display = ''; 
                });
            }, 50); // 极短的延迟确保渲染完成
        });
    }

    // 3. 执行数据加载等异步逻辑
    init();
});

/* ========================================
   添加键盘快捷键
   ======================================== */
document.addEventListener('keydown', function(e) {
    // Alt + T: 切换主题
    if (e.altKey && e.key === 't') {
        e.preventDefault();
        toggleTheme();
    }
    
    // Alt + 数字: 快速切换导航
    if (e.altKey && e.key >= '1' && e.key <= '6') {
        e.preventDefault();
        const sections = ['preview', 'logs', 'api', 'push', 'request-records', 'env'];
        const index = parseInt(e.key) - 1;
        if (sections[index]) {
            switchSection(sections[index]);
        }
    }
});
/* ========================================
   数字动画函数
   ======================================== */
function animateNumber(elementId, start, end, duration) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const range = end - start;
    const increment = range / (duration / 16);
    let current = start;
    
    const timer = setInterval(() => {
        current += increment;
        if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
            current = end;
            clearInterval(timer);
        }
        element.textContent = Math.round(current);
    }, 16);
}
`;
