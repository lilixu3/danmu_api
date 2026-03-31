import { globals } from "../configs/globals.js";
import { tokensCssContent } from "./css/tokens.css.js";
import { foundationCssContent } from "./css/foundation.css.js";
import { shellCssContent } from "./css/shell.css.js";
import { sharedComponentsCssContent } from "./css/components-shared.css.js";
import { formsControlsCssContent } from "./css/forms-controls.css.js";
import { overviewCssContent } from "./css/feature-overview.css.js";
import { settingsCssContent } from "./css/feature-settings.css.js";
import { apiFeatureCssContent } from "./css/feature-api.css.js";
import { statusCssContent } from "./css/status.css.js";
import { themeDarkCssContent } from "./css/theme-dark.css.js";
import { responsiveCssContent } from "./css/responsive.css.js";
import { mainJsContent } from "./js/main.js";
import { previewJsContent } from "./js/preview.js";
import { logviewJsContent } from "./js/logview.js";
import { apitestJsContent } from "./js/apitest.js";
import { pushDanmuJsContent } from "./js/pushdanmu.js";
import { requestRecordsJsContent } from "./js/requestrecords.js";
import { systemSettingsJsContent } from "./js/systemsettings.js";
// language=HTML
export const HTML_TEMPLATE = /* html */ `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="theme-color" content="#f6f7fb">
    <title>LogVar弹幕API - 现代化管理平台</title>
    <link rel="icon" type="image/jpg" href="https://i.mji.rip/2025/09/27/eedc7b701c0fa5c1f7c175b22f441ad9.jpeg">
    <script>
        (function () {
            const storedTheme = localStorage.getItem('theme');
            const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            const theme = storedTheme || (prefersDark ? 'dark' : 'light');
            const themeColor = theme === 'dark' ? '#0A0F1E' : '#f6f7fb';
            document.documentElement.setAttribute('data-theme', theme);
            document.documentElement.style.backgroundColor = themeColor;
            document.documentElement.style.colorScheme = theme;
            const themeColorMeta = document.querySelector('meta[name="theme-color"]');
            if (themeColorMeta) {
                themeColorMeta.setAttribute('content', themeColor);
            }
        })();
    </script>
    <style>${tokensCssContent}</style>
    <style>${foundationCssContent}</style>
    <style>${shellCssContent}</style>
    <style>${sharedComponentsCssContent}</style>
    <style>${formsControlsCssContent}</style>
    <style>${overviewCssContent}</style>
    <style>${settingsCssContent}</style>
    <style>${apiFeatureCssContent}</style>
    <style>${statusCssContent}</style>
    <style>${themeDarkCssContent}</style>
    <style>${responsiveCssContent}</style>
</head>

<body>
    <!-- 顶部进度条 -->
    <div class="progress-bar-top" id="progress-bar-top"></div>

    <!-- 主容器 -->
    <div class="app-container">
        <!-- 侧边栏 -->
        <aside class="sidebar" id="sidebar">
            <div class="sidebar-header">
                <div class="brand-panel">
                    <span class="brand-kicker">Danmu Service Hub</span>
                    <div class="logo-wrapper">
                        <img src="https://i.mji.rip/2025/09/27/eedc7b701c0fa5c1f7c175b22f441ad9.jpeg" alt="Logo" class="logo-image">
                        <div class="brand-copy-group">
                            <h1 class="logo-text">LogVar API</h1>
                            <p class="brand-description">弹幕服务接入与管理页面</p>
                        </div>
                    </div>
                </div>
                <button class="sidebar-toggle" id="sidebar-toggle" onclick="toggleSidebar()" type="button" aria-label="切换导航">
                    <span class="toggle-icon"></span>
                </button>
            </div>

            <div class="sidebar-brief">
                <div class="sidebar-brief-head">
                    <span class="sidebar-brief-label">快速开始</span>
                    <span class="sidebar-brief-chip">01 · 首页</span>
                </div>
                <p class="sidebar-brief-title">先查看接入地址和当前状态，再进入测试、日志或访问记录。</p>
                <div class="sidebar-brief-actions">
                    <button class="brief-action" onclick="switchSection('api')" type="button">接口测试</button>
                    <button class="brief-action" onclick="switchSection('request-records')" type="button">访问记录</button>
                </div>
            </div>

            <nav class="nav-menu">
                <div class="nav-group-label">Workspace</div>
                <a href="#preview" class="nav-item active" data-section="preview" onclick="switchSection('preview'); return false;">
                    <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                    </svg>
                    <span class="nav-copy">
                        <span class="nav-text">服务概览</span>
                        <span class="nav-meta">接入地址、状态与基础设置</span>
                    </span>
                    <span class="nav-index">01</span>
                </a>
                <a href="#logs" class="nav-item" data-section="logs" onclick="switchSection('logs'); return false;">
                    <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                    <span class="nav-copy">
                        <span class="nav-text">运行日志</span>
                        <span class="nav-meta">最近动态与异常提醒</span>
                    </span>
                    <span class="nav-index">02</span>
                </a>
                <a href="#api" class="nav-item" data-section="api" onclick="switchSection('api'); return false;">
                    <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                    <span class="nav-copy">
                        <span class="nav-text">接口测试</span>
                        <span class="nav-meta">测试接口与返回结果</span>
                    </span>
                    <span class="nav-index">03</span>
                </a>
                <a href="#push" class="nav-item" data-section="push" onclick="switchSection('push'); return false;">
                    <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                    </svg>
                    <span class="nav-copy">
                        <span class="nav-text">推送弹幕</span>
                        <span class="nav-meta">联动播放器刷新弹幕</span>
                    </span>
                    <span class="nav-index">04</span>
                </a>
                <a href="#request-records" class="nav-item" data-section="request-records" onclick="switchSection('request-records'); return false;">
                    <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="9"/>
                        <path d="M12 7v5l3 2"/>
                    </svg>
                    <span class="nav-copy">
                        <span class="nav-text">访问记录</span>
                        <span class="nav-meta">最近访问与调用情况</span>
                    </span>
                    <span class="nav-index">05</span>
                </a>
                <a href="#env" class="nav-item" data-section="env" id="env-nav-btn" onclick="switchSection('env'); return false;">
                    <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                        <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                    <span class="nav-copy">
                        <span class="nav-text">系统设置</span>
                        <span class="nav-meta">服务设置与部署操作</span>
                    </span>
                    <span class="nav-index">06</span>
                </a>
            </nav>

            <div class="sidebar-footer-card">
                <span class="sidebar-footer-kicker">Adaptive Layout</span>
                <p class="sidebar-footer-title">适合播放器接入与日常维护的统一工作台。</p>
                <p class="sidebar-footer-text">桌面端突出概览与设置，移动端保留常用入口与轻量操作。</p>
            </div>
        </aside>

        <!-- 主内容区 -->
        <main class="main-content">

            <header class="desktop-command-bar">
                <div class="command-bar-left">
                    <span class="command-bar-mark" aria-hidden="true">LV</span>
                    <div class="command-bar-copy">
                        <span class="command-kicker" id="desktop-active-kicker">Workspace</span>
                        <div class="command-bar-heading">
                            <h2 class="command-bar-title" id="desktop-active-title">服务概览</h2>
                            <p class="command-desc" id="desktop-active-desc">快速查看接入地址、当前状态和基础设置。</p>
                        </div>
                    </div>
                </div>
                <div class="command-bar-nav" aria-label="桌面快捷入口">
                    <button class="command-chip active" data-section="preview" onclick="switchSection('preview')" type="button">服务概览</button>
                    <button class="command-chip" data-section="api" onclick="switchSection('api')" type="button">接口测试</button>
                    <button class="command-chip" data-section="logs" onclick="switchSection('logs')" type="button">运行日志</button>
                    <button class="command-chip" data-section="request-records" onclick="switchSection('request-records')" type="button">访问记录</button>
                </div>
                <div class="command-bar-right">
                    <button class="desktop-status-pill" id="desktop-status-pill" title="查看部署配置" onclick="openDeployEnvStatusModal()" type="button" aria-label="查看部署配置">
                        <span class="status-dot status-running" id="desktop-deploy-status-dot"></span>
                        <span class="desktop-status-text" id="desktop-status-text">配置状态</span>
                    </button>
                    <button class="theme-toggle theme-toggle-inline" id="theme-toggle" onclick="toggleTheme(this)" title="切换主题" type="button" aria-label="切换主题">
                        <svg class="theme-icon theme-icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="5"/>
                            <line x1="12" y1="1" x2="12" y2="3"/>
                            <line x1="12" y1="21" x2="12" y2="23"/>
                            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                            <line x1="1" y1="12" x2="3" y2="12"/>
                            <line x1="21" y1="12" x2="23" y2="12"/>
                            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                        </svg>
                        <svg class="theme-icon theme-icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                        </svg>
                    </button>
                </div>
            </header>

            <header class="mobile-header" id="mobile-header">
                <div class="mobile-header-inner">
                    <div class="mobile-header-left">
                        <div class="mobile-logo-wrapper">
                            <span class="mobile-service-mark">LV</span>
                            <div class="mobile-title-group">
                                <span class="mobile-header-kicker">LogVar API</span>
                                <div class="mobile-title-row">
                                    <span class="mobile-title" id="mobile-title">服务概览</span>
                                    <span class="mobile-subtitle" id="mobile-subtitle">Service Home</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="mobile-header-right">
                        <div class="mobile-version-badge" id="mobile-version-badge" onclick="openRuntimeStatusModal()" role="button" tabindex="0" title="查看运行状态与版本信息">
                            <span class="mvb-version" id="mobile-current-version">v${globals.version}</span>
                            <span class="mvb-status mvb-status-checking" id="mobile-version-status">检查中...</span>
                        </div>
                        <button class="mobile-status-indicator" id="mobile-status" title="查看部署配置" onclick="openDeployEnvStatusModal()" type="button" aria-label="查看部署配置">
                            <span class="status-dot status-running" id="deploy-env-status-dot"></span>
                        </button>
                        <button class="mobile-action-btn" onclick="toggleTheme(this)" title="切换主题" type="button" aria-label="切换主题">
                            <svg class="mobile-action-icon theme-icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="5"/>
                                <line x1="12" y1="1" x2="12" y2="3"/>
                                <line x1="12" y1="21" x2="12" y2="23"/>
                                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                                <line x1="1" y1="12" x2="3" y2="12"/>
                                <line x1="21" y1="12" x2="23" y2="12"/>
                                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                            </svg>
                            <svg class="mobile-action-icon theme-icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </header>

            <div class="content-shell">
            <!-- 配置预览 -->
            <section class="content-section active" id="preview-section">
                <div id="proxy-config-container" class="proxy-config-card" style="display: none;">
                    <div class="proxy-config-header">
                        <span class="proxy-alert-icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 9v4"/>
                                <path d="M12 17h.01"/>
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                            </svg>
                        </span>
                        <div>
                            <h3 class="proxy-alert-title">获取配置失败</h3>
                            <p class="proxy-alert-body">检测到无法获取配置。如果您使用了复杂的反向代理：例如将 <code>http://{ip}:9321/</code> 代理到了 <code>http://{ip}:9321/danmu_api/</code>，请在此处手动输入完整的反代后链接（不包含TOKEN和ADMIN_TOKEN的）</p>
                        </div>
                    </div>
                    <div class="proxy-config-form">
                        <input type="text" id="custom-base-url" class="form-input" placeholder="例如: http://192.168.8.1:2333/danmu_api/ (留空保存即恢复默认)">
                        <button class="btn btn-primary" onclick="saveBaseUrl()">保存并刷新</button>
                    </div>
                    <p class="proxy-config-note">设置会保存在浏览器本地存储中，清除网页本地存储或留空后保存即可恢复默认。</p>
                </div>

                <div class="preview-command-grid preview-command-grid-single">
                    <div class="preview-hero-card api-service-hero api-service-hero-refined">
                        <div class="preview-hero-content preview-hero-content-refined">
                            <div class="hero-main-row">
                                <div class="hero-brand-block">
                                    <div class="hero-overview-topline">
                                        <span class="preview-hero-eyebrow">首页概览</span>
                                        <div class="hero-version-tag" id="hero-version-panel" onclick="openRuntimeStatusModal()" role="button" tabindex="0" title="查看运行状态与版本信息">
                                            <span class="hero-version-badge" id="hero-current-version">v${globals.version}</span>
                                            <span class="hero-version-divider">·</span>
                                            <span class="hero-version-status hero-version-status-checking" id="hero-version-status">检查中...</span>
                                        </div>
                                    </div>
                                    <div class="preview-hero-header preview-hero-header-refined">
                                        <div class="preview-hero-icon">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                <path d="M4 7h16M4 12h16M4 17h10"/>
                                                <path d="M18 17l2 2 4-4"/>
                                            </svg>
                                        </div>
                                        <div class="preview-hero-titles">
                                            <h2 class="preview-hero-title">LogVar API</h2>
                                            <p class="preview-hero-subtitle">在这里快速查看接入地址、当前状态和已完成设置。</p>
                                        </div>
                                    </div>
                                    <div class="hero-status-rail">
                                        <div class="hero-status-panel" id="system-status-card">
                                            <span class="stat-icon-wrapper stat-icon-status" id="status-icon-wrapper">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                                                </svg>
                                            </span>
                                            <div class="hero-status-copy">
                                                <span class="hero-status-label">服务状态</span>
                                                <strong class="stat-value stat-value-status" id="system-status">检测中...</strong>
                                            </div>
                                        </div>
                                        <div class="hero-mode-panel">
                                            <span class="stat-icon-wrapper stat-icon-mode mode-preview" id="mode-icon-wrapper" aria-label="预览模式">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                    <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/>
                                                    <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                                                </svg>
                                            </span>
                                            <div class="hero-status-copy">
                                                <span class="hero-status-label">当前访问</span>
                                                <strong class="hero-mode-value" id="current-mode">检测中...</strong>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="hero-service-panel">
                                    <div class="hero-service-header">
                                        <span class="hero-service-kicker">快速开始</span>
                                        <span class="hero-service-note">复制地址后即可接入播放器</span>
                                    </div>
                                    <div class="hero-service-body">
                                        <button class="hero-endpoint-panel" onclick="copyApiEndpoint()" type="button">
                                            <span class="hero-endpoint-label">播放器接入地址</span>
                                            <span class="hero-endpoint-value" id="api-endpoint">加载中...</span>
                                            <span class="hero-endpoint-hint">点击复制接入地址</span>
                                        </button>
                                        <div class="preview-stats-strip service-panel-metrics" id="preview-stats-grid">
                                            <div class="hero-metric-item hero-metric-item-total">
                                                <span class="hero-metric-label">可用设置</span>
                                                <div class="hero-metric-main">
                                                    <strong class="stat-value" id="total-configs">-</strong>
                                                    <span class="hero-metric-unit">项</span>
                                                </div>
                                                <span class="hero-metric-meta">已识别的设置项</span>
                                            </div>
                                            <div class="hero-metric-item hero-metric-item-manual">
                                                <span class="hero-metric-label">已完成设置</span>
                                                <div class="hero-metric-main">
                                                    <strong class="stat-value" id="manual-configs">-</strong>
                                                    <span class="hero-metric-unit">项</span>
                                                </div>
                                                <span class="hero-metric-meta">已填写并生效</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                        </div>
                    </div>
                </div>
                <div class="preview-grid" id="preview-area"></div>
            </section>
            
            <!-- 日志查看 -->
            <section class="content-section" id="logs-section">
                <div class="section-header">
                    <div>
                        <h2 class="section-title">日志查看</h2>
                        <p class="section-desc">实时监控系统运行日志，支持按类型筛选和自动刷新</p>
                    </div>
                    <div class="header-actions log-top-actions">
                        <button class="btn log-action-btn" id="refreshLogsBtn" onclick="refreshLogs()" type="button">刷新</button>
                        <button class="btn log-action-btn" id="autoRefreshBtn" onclick="toggleAutoRefresh()" type="button">自动刷新</button>
                        <button class="btn log-action-btn" onclick="exportLogs()" type="button">导出</button>
                        <button class="btn log-action-btn log-action-danger" onclick="clearLogs()" type="button">清空</button>
                    </div>
                </div>
                
                <!-- 日志过滤器 -->
                <div class="log-filters">
                    <button class="log-filter-btn active" data-filter="all" onclick="setLogFilter('all')" type="button">
                        <span class="filter-icon" aria-hidden="true"></span>
                        <span class="filter-text">全部</span>
                        <span class="filter-badge">0</span>
                    </button>
                    <button class="log-filter-btn" data-filter="error" onclick="setLogFilter('error')" type="button">
                        <span class="filter-icon" aria-hidden="true"></span>
                        <span class="filter-text">错误</span>
                        <span class="filter-badge">0</span>
                    </button>
                    <button class="log-filter-btn" data-filter="warn" onclick="setLogFilter('warn')" type="button">
                        <span class="filter-icon" aria-hidden="true"></span>
                        <span class="filter-text">警告</span>
                        <span class="filter-badge">0</span>
                    </button>
                </div>

                <div class="log-toolbar">
                    <div class="log-search-group">
                        <svg class="log-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        <input
                            type="text"
                            class="log-search-input"
                            id="log-search-input"
                            placeholder="搜索日志关键字（支持时间/级别/文本）"
                            oninput="setLogSearch(this.value)"
                        >
                        <button class="log-search-clear" id="log-search-clear" onclick="clearLogSearch()" type="button" style="display: none;">清空</button>
                    </div>
                    <div class="log-toolbar-actions">
                        <span class="log-toolbar-status" id="log-toolbar-status">显示 0 / 0 条</span>
                        <button class="log-tool-btn active" id="log-wrap-toggle" onclick="toggleLogWrap()" type="button">自动换行</button>
                        <button class="log-tool-btn active" id="log-autoscroll-toggle" onclick="toggleLogAutoScroll()" type="button">自动滚动</button>
                        <button class="log-tool-btn" onclick="copyVisibleLogs()" type="button">复制当前</button>
                    </div>
                </div>
                
                <!-- 日志终端 -->
                <div class="log-terminal log-wrap-enabled" id="log-container" aria-live="polite" aria-label="系统日志输出">
                    <div class="log-empty-state">
                        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke-width="2"/>
                        </svg>
                        <p class="empty-text">暂无日志</p>
                    </div>
                </div>
            </section>

            <!-- 接口调试 -->
            <section class="content-section" id="api-section">
                <div class="section-header">
                    <div>
                        <h2 class="section-title">API 测试平台</h2>
                        <p class="section-desc">可快速测试接口与弹幕效果，并查看返回结果</p>
                    </div>
                    <div class="api-mode-tabs">
                        <button class="api-mode-tab active" data-mode="api-test" onclick="switchApiMode('api-test')">
                            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                            </svg>
                            <span>接口测试</span>
                        </button>
                        <button class="api-mode-tab" data-mode="danmu-test" onclick="switchApiMode('danmu-test')">
                            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/>
                            </svg>
                            <span>弹幕测试</span>
                        </button>
                    </div>
                </div>

                <!-- 接口调试模式 -->
                <div class="api-test-container" id="api-test-mode">
                    <div class="form-card">
                        <label class="form-label">选择接口</label>
                        <select class="form-select" id="api-select" onchange="loadApiParams()">
                            <option value="">请选择接口</option>
                            <option value="searchAnime">搜索动漫 - /api/v2/search/anime</option>
                            <option value="searchEpisodes">搜索剧集 - /api/v2/search/episodes</option>
                            <option value="matchAnime">匹配动漫 - /api/v2/match</option>
                            <option value="getBangumi">获取番剧详情 - /api/v2/bangumi/:animeId</option>
                            <option value="getComment">获取弹幕 - /api/v2/comment/:commentId</option>
                            <option value="getCommentByUrl">通过URL获取弹幕 - /api/v2/comment?url=...&format=json</option>
                            <option value="getSegmentComment">获取分片弹幕 - /api/v2/segmentcomment</option>
                        </select>
                    </div>

                    <div class="form-card" id="api-params" style="display: none;">
                        <h3 class="card-title">接口参数</h3>
                        <div id="params-form"></div>
                        <button class="btn btn-success btn-lg" onclick="testApi()">
                            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" stroke-width="2"/>
                            </svg>
                            <span>发送请求</span>
                        </button>
                    </div>

                    <div class="response-card" id="api-response-container" style="display: none;">
                        <h3 class="card-title">响应结果</h3>
                        <div class="response-content" id="api-response"></div>
                    </div>
                </div>

                <!-- 弹幕测试模式 -->
                <div class="danmu-test-container" id="danmu-test-mode" style="display: none;">
                    <!-- 测试方式选择（避免两个输入框同时出现） -->
                    <div class="form-card danmu-method-switcher">
                        <div class="danmu-method-switcher-header">
                            <h3 class="card-title">弹幕测试方式</h3>
                            <p class="card-desc">请选择「自动匹配」或「手动搜索」开始调试</p>
                        </div>
                        <div class="danmu-method-tabs" role="tablist" aria-label="弹幕测试方式">
                            <button class="danmu-method-tab" data-method="auto" onclick="switchDanmuTestMethod('auto')" aria-label="自动匹配">
                                <span class="tab-icon" aria-hidden="true">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="12" cy="12" r="8"/>
                                        <circle cx="12" cy="12" r="3"/>
                                        <path d="M12 2v2m0 16v2m10-10h-2M4 12H2"/>
                                    </svg>
                                </span>
                                <span>自动匹配</span>
                            </button>
                            <button class="danmu-method-tab" data-method="manual" onclick="switchDanmuTestMethod('manual')" aria-label="手动搜索">
                                <span class="tab-icon" aria-hidden="true">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="11" cy="11" r="7"/>
                                        <path d="m20 20-3.5-3.5"/>
                                    </svg>
                                </span>
                                <span>手动搜索</span>
                            </button>
                        </div>

                        <!-- 未选择方式时的占位提示 -->
                        <div id="danmu-method-empty" class="danmu-method-empty">
                            <div class="empty-icon" aria-hidden="true">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M9 18h6"/>
                                    <path d="M10 22h4"/>
                                    <path d="M12 2a7 7 0 0 0-4 12.74c.63.44 1 1.15 1 1.92V18h6v-1.34c0-.77.37-1.48 1-1.92A7 7 0 0 0 12 2z"/>
                                </svg>
                            </div>
                            <div class="empty-title">先选择一种方式</div>
                            <div class="empty-desc">自动匹配适合直接输入文件名；手动搜索适合精确选择剧集</div>
                        </div>

                        <!-- 自动匹配面板 -->
                        <div id="danmu-method-auto" class="danmu-method-panel" style="display: none;">
                            <div class="method-header" style="margin-top: 0;">
                                <div class="method-icon-wrapper" style="background: var(--gradient-primary);">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
                                    </svg>
                                </div>
                                <div class="method-info">
                                    <h3 class="method-title">自动匹配测试</h3>
                                    <p class="method-desc">通过文件名自动匹配弹幕</p>
                                </div>
                            </div>
                            <div class="form-group">
                                <label class="form-label">文件名</label>
                                <input type="text" class="form-input" id="auto-match-filename" 
                                       placeholder="例如: 生万物 S02E08 或 无忧渡.S01E01.2160p.WEB-DL.H265.DDP.5.1">
                                <small class="form-help">
                                    <span class="help-icon" aria-hidden="true">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M9 18h6"/>
                                            <path d="M10 22h4"/>
                                            <path d="M12 2a7 7 0 0 0-4 12.74c.63.44 1 1.15 1 1.92V18h6v-1.34c0-.77.37-1.48 1-1.92A7 7 0 0 0 12 2z"/>
                                        </svg>
                                    </span>
                                    支持多种格式：季集格式、网盘命名、外语标题等
                                </small>
                            </div>
                            <button class="btn btn-primary btn-lg" onclick="autoMatchDanmu()">
                                <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                                </svg>
                                <span>开始匹配</span>
                            </button>
                        </div>

                        <!-- 手动搜索面板 -->
                        <div id="danmu-method-manual" class="danmu-method-panel" style="display: none;">
                            <div class="method-header" style="margin-top: 0;">
                                <div class="method-icon-wrapper" style="background: var(--gradient-success);">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="11" cy="11" r="8"/>
                                        <path d="m21 21-4.35-4.35"/>
                                    </svg>
                                </div>
                                <div class="method-info">
                                    <h3 class="method-title">手动搜索测试</h3>
                                    <p class="method-desc">搜索动漫并选择集数</p>
                                </div>
                            </div>
                            <div class="form-group">
                                <label class="form-label">搜索关键词</label>
                                <input type="text" class="form-input" id="manual-search-keyword" 
                                       placeholder="例如: 生万物"
                                       onkeypress="if(event.key==='Enter') manualSearchDanmu()">
                                <small class="form-help">
                                    <span class="help-icon" aria-hidden="true">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M9 18h6"/>
                                            <path d="M10 22h4"/>
                                            <path d="M12 2a7 7 0 0 0-4 12.74c.63.44 1 1.15 1 1.92V18h6v-1.34c0-.77.37-1.48 1-1.92A7 7 0 0 0 12 2z"/>
                                        </svg>
                                    </span>
                                    输入动漫名称进行精确搜索
                                </small>
                            </div>
                            <button class="btn btn-success btn-lg" onclick="manualSearchDanmu()">
                                <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <circle cx="11" cy="11" r="8"/>
                                    <path d="m21 21-4.35-4.35"/>
                                </svg>
                                <span>开始搜索</span>
                            </button>
                        </div>
                    </div>

                    <!-- 搜索结果展示 -->
                    <div id="danmu-search-results" style="display: none;"></div>

                    <!-- 弹幕展示区域 -->
                    <div id="danmu-display-area" style="display: none;">
                        <!-- 弹幕信息卡片 -->
                        <div class="form-card danmu-info-card">
                            <div class="danmu-info-header">
                                <div class="danmu-title-section">
                                    <h3 class="danmu-title" id="danmu-title">弹幕数据</h3>
                                    <span class="danmu-subtitle" id="danmu-subtitle">加载中...</span>
                                </div>
                                <div class="danmu-actions">
                                    <button class="btn btn-primary" id="btn-export-json" onclick="exportDanmu('json')">
                                        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                            <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                                        </svg>
                                        <span>导出 JSON</span>
                                    </button>
                                    <button class="btn btn-success" id="btn-export-xml" onclick="exportDanmu('xml')">
                                        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                            <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                                        </svg>
                                        <span>导出 XML</span>
                                    </button>
                                </div>
                            </div>

                            <!-- 统计信息 -->
                            <div class="danmu-stats-grid">
                                <div class="danmu-stat-item">
                                    <span class="stat-icon" aria-hidden="true">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                                        </svg>
                                    </span>
                                    <div class="stat-content">
                                        <div class="stat-value" id="danmu-total-count">0</div>
                                        <div class="stat-label">弹幕总数</div>
                                    </div>
                                </div>
                                <div class="danmu-stat-item">
                                    <span class="stat-icon" aria-hidden="true">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <circle cx="12" cy="13" r="8"/>
                                            <path d="M12 9v4l2.5 1.5"/>
                                            <path d="M9 2h6"/>
                                        </svg>
                                    </span>
                                    <div class="stat-content">
                                        <div class="stat-value" id="danmu-duration">0:00</div>
                                        <div class="stat-label">视频时长</div>
                                    </div>
                                </div>
                                <div class="danmu-stat-item">
                                    <span class="stat-icon" aria-hidden="true">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M4 20V10"/>
                                            <path d="M10 20V4"/>
                                            <path d="M16 20v-7"/>
                                            <path d="M22 20v-4"/>
                                        </svg>
                                    </span>
                                    <div class="stat-content">
                                        <div class="stat-value" id="danmu-density">0</div>
                                        <div class="stat-label">平均密度/分</div>
                                    </div>
                                </div>
                                <div class="danmu-stat-item">
                                    <span class="stat-icon" aria-hidden="true">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M12 3s4 3.5 4 7.5c0 2.5-1.4 4.5-4 4.5s-4-2-4-4.5C8 6.5 12 3 12 3z"/>
                                            <path d="M8 14a4 4 0 1 0 8 0c0-1.5-.8-2.9-2-3.8"/>
                                        </svg>
                                    </span>
                                    <div class="stat-content">
                                        <div class="stat-value" id="danmu-peak-time">--:--</div>
                                        <div class="stat-label">高能时刻</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- 热力图 -->
                        <div class="form-card danmu-heatmap-card">
                            <h3 class="card-title">
                                <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                                </svg>
                                <span>弹幕热力图</span>
                            </h3>
                            <div class="heatmap-legend">
                                <span class="legend-label">弹幕密度：</span>
                                <div class="legend-gradient">
                                    <span class="legend-low">低</span>
                                    <div class="legend-bar"></div>
                                    <span class="legend-high">高</span>
                                </div>
                            </div>
                            <canvas id="danmu-heatmap-canvas"></canvas>
                            <div class="heatmap-node-info" id="heatmap-node-info">点击热力图柱状条，可查看该时间段弹幕数</div>
                        </div>

                        <!-- 弹幕列表 -->
                        <div class="form-card danmu-list-card">
                            <div class="danmu-list-header">
                                <h3 class="card-title">
                                    <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <path d="M4 6h16M4 12h16M4 18h7"/>
                                    </svg>
                                    <span>弹幕列表</span>
                                </h3>
                                <div class="danmu-list-filters">
                                    <button class="danmu-filter-btn active" data-type="all" onclick="filterDanmuList('all')">
                                        全部 (<span id="filter-all-count">0</span>)
                                    </button>
                                    <button class="danmu-filter-btn" data-type="scroll" onclick="filterDanmuList('scroll')">
                                        滚动 (<span id="filter-scroll-count">0</span>)
                                    </button>
                                    <button class="danmu-filter-btn" data-type="top" onclick="filterDanmuList('top')">
                                        顶部 (<span id="filter-top-count">0</span>)
                                    </button>
                                    <button class="danmu-filter-btn" data-type="bottom" onclick="filterDanmuList('bottom')">
                                        底部 (<span id="filter-bottom-count">0</span>)
                                    </button>
                                </div>
                            </div>
                            <div class="danmu-list-container" id="danmu-list-container">
                                <div class="danmu-list-empty">
                                    <span class="empty-icon" aria-hidden="true">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                                        </svg>
                                    </span>
                                    <p>暂无弹幕数据</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <!-- 推送弹幕 -->
            <section class="content-section" id="push-section">
                <div class="section-header">
                    <h2 class="section-title">推送弹幕</h2>
                    <p class="section-desc">支持OK影视等播放器，两端需要在同一局域网或使用公网IP</p>
                </div>
                <div class="push-container">
                    <div class="form-card">
                        <label class="form-label">推送地址</label>
                        <input type="text" class="form-input" id="push-url" placeholder="http://127.0.0.1:9978/action?do=refresh&type=danmaku&path=">
                        
                        <!-- 快速预设 -->
                        <div class="push-presets-section">
                            <div class="presets-header">
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor">
                                    <path d="M13 10V3L4 14h7v7l9-11h-7z" stroke-width="2"/>
                                </svg>
                                <span>快速预设</span>
                            </div>
                            <div class="presets-grid">
                                <button class="btn btn-secondary preset-btn" onclick="applyPushPreset('okvideo')">
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
                                    </svg>
                                    OK影视
                                </button>
                                <button class="btn btn-secondary preset-btn" onclick="applyPushPreset('kodi')">
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                        <circle cx="12" cy="12" r="10"/>
                                        <path d="M12 6v6l4 2" stroke="white" stroke-width="2" fill="none"/>
                                    </svg>
                                    Kodi
                                </button>
                                <button class="btn btn-secondary preset-btn" onclick="applyPushPreset('potplayer')">
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                        <rect x="4" y="4" width="16" height="16" rx="2"/>
                                        <path d="M9 8l6 4-6 4V8z" fill="white"/>
                                    </svg>
                                    PotPlayer
                                </button>
                            </div>
                        </div>

                        <!-- 局域网扫描 -->
                        <div class="lan-scan-section">
                            <div class="lan-scan-header">
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor">
                                    <circle cx="12" cy="12" r="10" stroke-width="2"/>
                                    <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke-width="2"/>
                                </svg>
                                <span>局域网设备扫描</span>
                            </div>
                            <div class="lan-scan-controls">
                                <div class="lan-input-group">
                                    <input type="text" class="form-input lan-subnet-input" id="lanSubnet" value="192.168.1" placeholder="网段">
                                    <span class="lan-input-separator">:</span>
                                    <input type="number" class="form-input lan-port-input" id="lanPort" value="9978" placeholder="端口" min="1" max="65535">
                                    <button class="btn btn-primary lan-scan-btn" id="scanLanBtn" onclick="scanLanDevices()">
                                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor">
                                            <circle cx="11" cy="11" r="8" stroke-width="2"/>
                                            <path d="m21 21-4.35-4.35" stroke-width="2"/>
                                        </svg>
                                        <span class="scan-btn-text">扫描</span>
                                    </button>
                                </div>
                            </div>
                            <div id="lanDevicesList" class="lan-devices-list"></div>
                        </div>
                        
                        <label class="form-label" style="margin-top: 20px;">搜索关键字</label>
                        <div class="input-group search-input-group">
                            <input type="text" class="form-input search-input" id="push-search-keyword" placeholder="请输入搜索关键字" onkeypress="if(event.key==='Enter') searchAnimeForPush()">
                            <button class="btn btn-primary search-btn" onclick="searchAnimeForPush()">
                                <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <circle cx="11" cy="11" r="8" stroke-width="2"/>
                                    <path d="m21 21-4.35-4.35" stroke-width="2"/>
                                </svg>
                                <span class="search-btn-text">搜索</span>
                            </button>
                        </div>
                    </div>
                    <div id="push-anime-list" class="anime-grid" style="display: none;"></div>
                    <div id="push-episode-list" class="episode-grid" style="display: none;"></div>
                </div>
            </section>

            <!-- 请求记录 -->
            <section class="content-section" id="request-records-section">
                <div class="section-header">
                    <div>
                        <h2 class="section-title">访问记录</h2>
                        <p class="section-desc">展示最近的访问与调用记录（云端部署建议开启 Redis 持久化）。</p>
                    </div>
                    <div class="header-actions">
                        <button class="btn btn-secondary" id="btnRequestRecordsRefresh">
                            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M21 12a9 9 0 1 1-2.64-6.36" stroke-width="2"/>
                                <path d="M21 3v6h-6" stroke-width="2"/>
                            </svg>
                            刷新记录
                        </button>
                    </div>
                </div>
                <div class="request-records-summary">
                    <div class="request-records-summary-card">
                        <div class="summary-label">今日访问</div>
                        <div class="summary-value" id="request-records-today">0</div>
                    </div>
                    <div class="request-records-summary-card">
                        <div class="summary-label">累计记录</div>
                        <div class="summary-value" id="request-records-total">0</div>
                    </div>
                </div>
                <div class="request-records-list" id="request-records-list"></div>
            </section>

            <!-- 系统配置 -->
            <section class="content-section" id="env-section">
                <div class="section-header">
                    <div>
                        <h2 class="section-title">系统设置</h2>
                        <p class="section-desc">修改平台配置后，部分部署方式需要重新部署。</p>
                    </div>
                    <div class="header-actions">
                        <button class="btn btn-danger" onclick="showClearCacheModal()">
                            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                            清理缓存
                        </button>
                        <button class="btn btn-success" onclick="showDeploySystemModal()">
                            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
                            </svg>
                            重新部署
                        </button>
                    </div>
                </div>

                <div class="category-tabs">
                    <button class="tab-btn active" onclick="switchCategory('api')">API配置</button>
                    <button class="tab-btn" onclick="switchCategory('source')">源配置</button>
                    <button class="tab-btn" onclick="switchCategory('match')">匹配配置</button>
                    <button class="tab-btn" onclick="switchCategory('danmu')">弹幕配置</button>
                    <button class="tab-btn" onclick="switchCategory('cache')">缓存配置</button>
                    <button class="tab-btn" onclick="switchCategory('system')">系统配置</button>
                </div>

                <div class="env-grid" id="env-list"></div>
            </section>
            </div>

            <nav class="mobile-bottom-nav" id="mobile-bottom-nav" aria-label="移动端导航">
                <div class="mobile-bottom-nav-scroll">
                    <button class="mobile-nav-item active" data-section="preview" onclick="switchSection('preview')" type="button">
                        <svg class="mobile-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 6h16M4 12h16M4 18h10"/></svg>
                        <span>总览</span>
                    </button>
                    <button class="mobile-nav-item" data-section="logs" onclick="switchSection('logs')" type="button">
                        <svg class="mobile-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                        <span>日志</span>
                    </button>
                    <button class="mobile-nav-item" data-section="api" onclick="switchSection('api')" type="button">
                        <svg class="mobile-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                        <span>测试</span>
                    </button>
                    <button class="mobile-nav-item" data-section="push" onclick="switchSection('push')" type="button">
                        <svg class="mobile-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                        <span>推送</span>
                    </button>
                    <button class="mobile-nav-item" data-section="request-records" onclick="switchSection('request-records')" type="button">
                        <svg class="mobile-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                        <span>访问</span>
                    </button>
                    <button class="mobile-nav-item" data-section="env" onclick="switchSection('env')" type="button">
                        <svg class="mobile-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                        <span>设置</span>
                    </button>
                </div>
            </nav>
        </main>
    </div>

    <!-- 模态框：清理缓存 -->
    <div class="modal-overlay" id="clear-cache-modal">
        <div class="modal-container">
            <div class="modal-header">
                <h3 class="modal-title">确认清理缓存</h3>
                <button class="modal-close" onclick="hideClearCacheModal()">×</button>
            </div>
            <div class="modal-body">
                <p class="modal-desc">确定要清理所有缓存吗？这将清除：</p>
                <ul class="modal-list">
                    <li>动漫搜索缓存 (animes)</li>
                    <li>剧集ID缓存 (episodeIds)</li>
                    <li>剧集编号缓存 (episodeNum)</li>
                    <li>最后选择映射缓存 (lastSelectMap)</li>
                    <li>搜索结果缓存</li>
                    <li>弹幕内容缓存</li>
                    <li>请求历史记录</li>
                </ul>
                <p class="modal-warning">清理后可能需要重新登录</p>
            </div>
            <div class="modal-footer modal-footer-compact">
                <button class="btn btn-secondary btn-modal" onclick="hideClearCacheModal()">
                    <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M6 18L18 6M6 6l12 12" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    <span>取消</span>
                </button>
                <button class="btn btn-primary btn-modal" onclick="confirmClearCache()">
                    <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7"/>
                    </svg>
                    <span>确认清理</span>
                </button>
            </div>
        </div>
    </div>

    <!-- 模态框：重新部署 -->
    <div class="modal-overlay" id="deploy-system-modal">
        <div class="modal-container">
            <div class="modal-header">
                <h3 class="modal-title">确认重新部署</h3>
                <button class="modal-close" onclick="hideDeploySystemModal()">×</button>
            </div>
            <div class="modal-body">
                <p class="modal-desc">确定要重新部署系统吗？</p>
                <div class="modal-alert">
                    <p><strong>部署过程中：</strong></p>
                    <ul class="modal-list">
                        <li>系统将短暂不可用</li>
                        <li>所有配置将重新加载</li>
                        <li>服务将自动重启</li>
                    </ul>
                    <p style="margin-top: 10px;">预计耗时：30-90秒</p>
                </div>
            </div>
            <div class="modal-footer modal-footer-compact">
                <button class="btn btn-secondary btn-modal" onclick="hideDeploySystemModal()">
                    <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M6 18L18 6M6 6l12 12" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    <span>取消</span>
                </button>
                <button class="btn btn-success btn-modal" onclick="confirmDeploySystem()">
                    <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
                    </svg>
                    <span>确认部署</span>
                </button>
            </div>
        </div>
    </div>


    <!-- 模态框：部署平台环境变量 -->
    <div class="modal-overlay" id="deploy-env-status-modal">
        <div class="modal-container modal-lg deploy-env-status-modal">
            <div class="modal-header">
                <h3 class="modal-title">部署配置检查</h3>
                <button class="modal-close" onclick="closeDeployEnvStatusModal()">×</button>
            </div>
            <div class="modal-body" id="deploy-env-status-body">
                <!-- 动态内容由 JS 渲染 -->
            </div>
            <div class="modal-footer modal-footer-compact">
                <button class="btn btn-primary btn-modal" onclick="closeDeployEnvStatusModal()">
                    <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M6 18L18 6M6 6l12 12" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    <span>关闭</span>
                </button>
            </div>
        </div>
    </div>

    <!-- 模态框：运行时状态 -->
    <div class="modal-overlay" id="runtime-status-modal">
        <div class="modal-container modal-lg runtime-status-modal">
            <div class="modal-header">
                <h3 class="modal-title">运行状态与版本</h3>
                <button class="modal-close" onclick="closeRuntimeStatusModal()">×</button>
            </div>
            <div class="modal-body" id="runtime-status-body">
                <!-- 动态内容由 JS 渲染 -->
            </div>
            <div class="modal-footer modal-footer-compact">
                <button class="btn btn-secondary btn-modal" id="runtime-refresh-btn" onclick="refreshRuntimeStatusModal()" type="button">
                    <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M21 12a9 9 0 1 1-2.64-6.36" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M21 3v6h-6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span>重新检查</span>
                </button>
                <button class="btn btn-primary btn-modal" id="runtime-primary-action-btn" onclick="handleRuntimePrimaryAction()" type="button" disabled>
                    <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M13 10V3L4 14h7v7l9-11h-7z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span>加载中</span>
                </button>
                <button class="btn btn-primary btn-modal" onclick="closeRuntimeStatusModal()" type="button">
                    <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M6 18L18 6M6 6l12 12" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    <span>关闭</span>
                </button>
            </div>
        </div>
    </div>

    <!-- 模态框：二维码登录 -->
    <div class="modal-overlay" id="qr-login-modal">
        <div class="modal-container">
            <div class="modal-header">
                <h3 class="modal-title">扫码登录 Bilibili</h3>
                <button class="modal-close" onclick="closeQRLoginModal()">×</button>
            </div>
            <div class="modal-body" style="text-align: center;">
                <div id="qr-container" style="display: flex; flex-direction: column; align-items: center; gap: 1rem;">
                    <div class="loading-spinner" id="qr-loading"></div>
                    <p id="qr-status-text" style="color: var(--text-secondary); margin: 0;">正在生成二维码...</p>
                    <div id="qr-code" style="display: none; padding: 1rem; background: white; border-radius: var(--radius-md);"></div>
                    <p id="qr-hint" style="display: none; color: var(--text-secondary); font-size: 0.875rem; margin: 0;">
                        请使用 Bilibili APP 扫描二维码登录
                    </p>
                </div>
            </div>
            <div class="modal-footer modal-footer-compact">
                <button class="btn btn-secondary btn-modal" onclick="closeQRLoginModal()">
                    <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M6 18L18 6M6 6l12 12" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    <span>取消</span>
                </button>
            </div>
        </div>
    </div>

    <!-- 模态框：编辑环境变量 -->
    <div class="modal-overlay" id="env-modal">
        <div class="modal-container modal-lg">
            <div class="modal-header">
                <h3 class="modal-title" id="modal-title">编辑配置项</h3>
                <button class="modal-close" onclick="closeModal()">×</button>
            </div>
            <form id="env-form">
                <div class="modal-body">
                    <div class="form-group">
                        <label class="form-label">变量类别</label>
                        <select class="form-select" id="env-category" disabled>
                            <option value="api">API配置</option>
                            <option value="source">源配置</option>
                            <option value="match">匹配配置</option>
                            <option value="danmu">弹幕配置</option>
                            <option value="cache">缓存配置</option>
                            <option value="system">系统配置</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">变量名</label>
                        <input type="text" class="form-input" id="env-key" placeholder="例如: DB_HOST" required readonly>
                    </div>
                    <div class="form-group">
                        <label class="form-label">值类型</label>
                        <select class="form-select" id="value-type" onchange="renderValueInput()" disabled>
                            <option value="text">文本</option>
                            <option value="boolean">布尔值</option>
                            <option value="number">数字 (1-100)</option>
                            <option value="select">单选</option>
                            <option value="multi-select">多选 (可排序)</option>
                            <option value="map">映射表</option>
                            <option value="timeline-offset">时间轴偏移</option>
                        </select>
                    </div>
                    <div class="form-group" id="value-input-container"></div>
                    <div class="form-group">
                        <label class="form-label">描述</label>
                        <textarea class="form-textarea" id="env-description" placeholder="配置项说明" readonly></textarea>
                    </div>
                </div>
                <div class="modal-footer modal-footer-compact">
                    <button type="button" class="btn btn-secondary btn-modal" onclick="closeModal()">
                        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M6 18L18 6M6 6l12 12" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                        <span>取消</span>
                    </button>
                    <button type="submit" class="btn btn-success btn-modal">
                        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <polyline points="20 6 9 17 4 12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <span>保存</span>
                    </button>
                </div>
            </form>
        </div>
    </div>

    <!-- 加载遮罩 -->
    <div class="loading-overlay" id="loading-overlay">
        <div class="loading-content">
            <div class="loading-spinner"></div>
            <h3 class="loading-title" id="loading-text">正在处理...</h3>
            <p class="loading-desc" id="loading-detail">请稍候</p>
        </div>
    </div>

    <!-- Footer -->
    <footer class="footer">
        <div class="footer-description">
            <p class="footer-text">轻量弹幕 API 服务，支持常见平台弹幕获取，并兼容弹弹play的搜索、详情与弹幕接口。</p>
            <p class="footer-text">本项目仅为个人爱好开发，代码开源。如有任何侵权行为，请联系本人删除。</p>
        </div>
        <div class="footer-links">
            <a href="https://t.me/ddjdd_bot" target="_blank" class="footer-link">
                <span class="footer-link-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.5 4.5 18.3 19a1.5 1.5 0 0 1-2.1 1l-4.3-1.8-2.2 2.1a1 1 0 0 1-1.7-.7v-3l7.2-6.6c.3-.3-.1-.7-.5-.5l-8.8 5.6-3.8-1.3a1.5 1.5 0 0 1 0-2.9L19.3 3a1.5 1.5 0 0 1 2.2 1.5z"/></svg>
                </span>
                <span class="footer-link-text">TG机器人</span>
            </a>
            <a href="https://t.me/logvar_danmu_group" target="_blank" class="footer-link">
                <span class="footer-link-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </span>
                <span class="footer-link-text">TG群组</span>
            </a>
            <a href="https://t.me/logvar_danmu_channel" target="_blank" class="footer-link">
                <span class="footer-link-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11v2"/><path d="M6 8v8"/><path d="M10 6v12"/><path d="M14 8v8"/><path d="M18 4v16"/><path d="M21 10v4"/></svg>
                </span>
                <span class="footer-link-text">TG频道</span>
            </a>
            <a href="https://github.com/huangxd-/danmu_api" target="_blank" class="footer-link">
                <span class="footer-link-icon">
                    <svg class="footer-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                </span>
                <span class="footer-link-text">GitHub</span>
            </a>
        </div>
        <p class="footer-note">有问题提issue或私信机器人都ok</p>
    </footer>
    <script>
        ${mainJsContent}
        ${previewJsContent}
        ${logviewJsContent}
        ${apitestJsContent}
        ${pushDanmuJsContent}
        ${requestRecordsJsContent}
        ${systemSettingsJsContent}
    </script>
</body>
</html>
`;
