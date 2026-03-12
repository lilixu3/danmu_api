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
let currentToken = 'globals.currentToken';
let currentAdminToken = '';
let originalToken = '87654321';

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

    if (!isMobile) {
        document.body.classList.remove('mobile-nav-hidden');
        return;
    }

    const currentScrollY = window.scrollY || window.pageYOffset || 0;
    if (forceShow || currentScrollY < 24) {
        document.body.classList.remove('mobile-nav-hidden');
        lastMobileChromeScrollY = currentScrollY;
        return;
    }

    const delta = currentScrollY - lastMobileChromeScrollY;
    if (delta > 14) {
        document.body.classList.add('mobile-nav-hidden');
    } else if (delta < -10) {
        document.body.classList.remove('mobile-nav-hidden');
    }

    lastMobileChromeScrollY = currentScrollY;
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
}

function updateDeployEnvStatusBadgeFromConfig(config) {
    const status = computeDeployEnvStatus(config || {});
    deployEnvStatus = Object.assign({}, deployEnvStatus, status, { lastUpdated: Date.now() });
    applyDeployEnvStatusToBadge(deployEnvStatus);
}

async function refreshDeployEnvStatusBadge(force = false) {
    try {
        const now = Date.now();
        if (!force && deployEnvStatus.lastUpdated && (now - deployEnvStatus.lastUpdated) < 5000) {
            applyDeployEnvStatusToBadge(deployEnvStatus);
            return deployEnvStatus;
        }

        const response = await fetch(buildApiUrl('/api/config'));
        const config = await response.json();
        const status = computeDeployEnvStatus(config);

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
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const isActive = sidebar.classList.contains('active');
    
    sidebar.classList.toggle('active');
    
    // 点击遮罩关闭侧边栏
    if (!isActive) {
        const overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        overlay.style.cssText = \`
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.6);
            backdrop-filter: blur(4px);
            z-index: 999;
            animation: overlayFadeIn 0.3s ease-out;
        \`;
        overlay.onclick = toggleSidebar;
        document.body.appendChild(overlay);
        
        // 添加动画样式
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
    } else {
        const overlay = document.querySelector('.sidebar-overlay');
        if (overlay) {
            overlay.style.animation = 'overlayFadeOut 0.3s ease-out';
            setTimeout(() => overlay.remove(), 300);
        }
    }
}

/* ========================================
   导航切换
   ======================================== */
function switchSection(section) {
    // 检查是否尝试访问受token保护的section
    if (section === 'logs' || section === 'api' || section === 'env' || section === 'push' || section === 'cookie' || section === 'request-records') {
        let _reverseProxy = customBaseUrl; // 使用全局配置

        // 获取URL路径并提取token
        let urlPath = window.location.pathname;
        if(_reverseProxy) {
            // 严谨地移除BaseUrl中的path部分
            try {
                // 如果_reverseProxy包含完整URL，提取pathname
                // 如果只是相对路径，直接使用
                let proxyPath = _reverseProxy.startsWith('http') 
                    ? new URL(_reverseProxy).pathname 
                    : _reverseProxy;
                
                // 确保移除尾部斜杠，防止匹配失败
                if (proxyPath.endsWith('/')) {
                    proxyPath = proxyPath.slice(0, -1);
                }
                
                if(proxyPath && urlPath.startsWith(proxyPath)) {
                    urlPath = urlPath.substring(proxyPath.length);
                }
            } catch(e) {
                console.error("解析反代路径失败", e);
            }
        }
        
        const pathParts = urlPath.split('/').filter(part => part !== '');
        const urlToken = pathParts.length > 0 ? pathParts[0] : '';
        
        if (!urlToken && originalToken !== "87654321") {
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
    // 移除所有active类
    document.querySelectorAll('.content-section').forEach(s => {
        s.classList.remove('active');
        s.style.opacity = '0';
    });
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    
    // 添加active类
    const targetSection = document.getElementById(section + '-section');
    if (targetSection) {
        targetSection.classList.add('active');
        // 如果是初始化加载，直接显示，不走淡入动画避免闪烁
        targetSection.style.opacity = isInitialLoad ? '1' : '1'; 
    }
    
    const activeNav = document.querySelector(\`[data-section="\${section}"]\`);
    if (activeNav) activeNav.classList.add('active');
    document.querySelectorAll('.mobile-nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.section === section);
    });
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
    if (!isInitialLoad && window.innerWidth <= 860) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('active')) {
            toggleSidebar();
        }
    }

    syncMobileNavigationChrome(true);
    
    // 滚动到顶部
    if (!isInitialLoad) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    const sectionTitle = (titles && titles[section] && titles[section].main) ? titles[section].main : section;
    if (!isInitialLoad) {
        addLog(\`切换到\${sectionTitle}模块 📍\`, 'info');
    }

    if (section === 'request-records' && typeof refreshRequestRecords === 'function') {
        refreshRequestRecords();
    }

    // 保存当前页面到存储，以便刷新后恢复
    // 安全优化：受 TOKEN/ADMIN_TOKEN 保护的页面仅使用 sessionStorage 记忆，避免关闭页面后仍“卡在管理页”
    const protectedSections = ['logs', 'api', 'env', 'push', 'request-records'];
    try {
        if (protectedSections.includes(section)) {
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

/* ========================================
   加载环境变量
   ======================================== */
function loadEnvVariables() {
    showLoadingIndicator('env-list');
    
    fetch(buildApiUrl('/api/config', true))
        .then(response => response.json())
        .then(config => {
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
            
            hideLoadingIndicator('env-list');
            renderEnvList();
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
function updateApiEndpoint() {
  return fetch(buildApiUrl('/api/config', true))
    .then(response => {
        // 检查ContentType，如果是HTML说明可能是404页面或反代错误页面
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") === -1) {
             throw new Error("Received HTML instead of JSON. Possible 404 or Proxy Error.");
        }
        if (!response.ok) {
            throw new Error(\`HTTP error! status: \${response.status}\`);
        }
        return response.json();
    })
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
   获取Docker版本并检查更新
   ======================================== */
function getDockerVersion() {
    const url = "https://img.shields.io/docker/v/lilixu3/danmu-api?sort=semver";

    fetch(url)
        .then(response => response.text())
        .then(svgContent => {
            const versionMatch = svgContent.match(/version<\\/text><text.*?>(v[\\d\\.]+)/);

            if (versionMatch && versionMatch[1]) {
                const latest = versionMatch[1];
                // 更新所有最新版本显示元素
                updateAllLatestVersionElements(latest);
                // 检查是否有新版本
                checkForUpdate(latest);
            }
        })
        .catch(error => {
            console.error("Error fetching the SVG:", error);
            // 所有位置显示检查失败
            updateAllLatestVersionElements('获取失败');
            updateVersionStatusAll('failed', '检查失败');
        });
}

/* ========================================
   更新所有最新版本显示元素
   ======================================== */
function updateAllLatestVersionElements(text) {
    latestVersion = text;
    const ids = [];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = text;
            el.style.animation = 'pulse 0.6s ease-out';
        }
    });
}

/* ========================================
   更新所有版本状态徽章
   state: 'uptodate' | 'update' | 'failed' | 'checking'
   ======================================== */
function updateVersionStatusAll(state, text, latestVer) {
    const statusEls = [
        { el: document.getElementById('version-status'), prefix: 'version-status' },
        { el: document.getElementById('mobile-version-status'), prefix: 'mvb-status' },
        { el: document.getElementById('hero-version-status'), prefix: 'hero-version-status' }
    ];

    const stateClass = {
        'uptodate': '-uptodate',
        'update': '-update',
        'failed': '-failed',
        'checking': '-checking'
    };

    statusEls.forEach(({ el, prefix }) => {
        if (!el) return;
        el.className = prefix + ' ' + prefix + (stateClass[state] || '');
        el.textContent = text;
        if (state === 'update' && latestVer) {
            el.style.cursor = 'pointer';
            el.onclick = function() { showUpdateGuide(); };
        } else {
            el.style.cursor = '';
            el.onclick = null;
        }
    });
}

/* ========================================
   检查版本更新
   ======================================== */
function checkForUpdate(latestVer) {
    const currentVersionElement = document.getElementById('hero-current-version');
    if (!currentVersionElement) return;

    const curVer = currentVersionElement.textContent.trim();
    currentVersion = curVer;
    latestVersion = latestVer;

    // 比较版本号
    if (compareVersions(latestVer, curVer) > 0) {
        updateVersionStatusAll('update', '\\u2191 有新版本 ' + latestVer, latestVer);
        addLog(\`🎉 发现新版本: \${latestVer} (当前: \${curVer})\`, 'info');
    } else {
        updateVersionStatusAll('uptodate', '\\u2713 已是最新');
        addLog(\`✅ 当前已是最新版本: \${curVer}\`, 'success');
    }
}

/* ========================================
   版本号比较函数
   ======================================== */
function compareVersions(v1, v2) {
    // 移除 'v' 前缀
    const cleanV1 = v1.replace(/^v/, '');
    const cleanV2 = v2.replace(/^v/, '');
    
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

/* ========================================
   显示更新指南
   ======================================== */
function showUpdateGuide() {
    const curVer = currentVersion || '未知';
    const latVer = latestVersion || '未知';

    const guideMessage = \`
📦 版本更新提示

当前版本: \${curVer}
最新版本: \${latVer}

更新方法：

🐳 Docker 部署：
1. 停止当前容器: docker stop danmu-api
2. 拉取最新镜像: docker pull lilixu3/danmu-api:latest
3. 重新启动容器

☁️ 云平台部署 (Vercel/Netlify/Cloudflare)：
1. 进入项目仓库
2. 拉取最新代码: git pull origin main
3. 推送到部署分支触发自动部署

💡 提示：更新前请备份重要配置！
    \`.trim();
    
    customAlert(guideMessage, '🔄 更新指南');
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
        await updateApiEndpoint();
        updateCurrentModeDisplay();
        getDockerVersion();
        const config = await fetchAndSetConfig();
        updateDeployEnvStatusBadgeFromConfig(config);
        setDefaultPushUrl(config);
        checkAndHandleAdminToken();
        loadEnvVariables();
        renderEnvList();
        renderPreview();
        addLog('🎉 系统初始化完成', 'success');
        fetchRealLogs();
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
        
        // 即使初始化失败，也要尝试获取日志
        fetchRealLogs();
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
    
    // 1. 优先初始化主题 (防止颜色闪烁)
    initTheme();


    // 2. 无闪烁页面恢复逻辑 (核心优化)
    let savedSection = sessionStorage.getItem('activeSection') || localStorage.getItem('activeSection');
    // 没有 URL token 时，避免恢复到受保护页面（例如 /ADMIN_TOKEN 进入后直接关闭导致下次仍停留在管理页）
    const urlPath = window.location.pathname;
    const pathParts = urlPath.split('/').filter(part => part !== '');
    const urlToken = pathParts.length > 0 ? pathParts[0] : '';
    const protectedSections = ['logs', 'api', 'env', 'push', 'request-records'];
    if (!urlToken && savedSection && protectedSections.includes(savedSection)) {
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
