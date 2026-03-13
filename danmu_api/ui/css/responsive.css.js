// language=CSS
export const responsiveCssContent = /* css */ `/* ========================================
   响应式覆盖（断点、设备特性与无障碍偏好）
   ======================================== */

/* ========================================
   响应式断点定义
   ======================================== */
/* 
   断点策略：
   - Mobile: < 768px
   - Tablet: 768px - 1024px
   - Desktop: > 1024px
   - Large Desktop: > 1440px
*/

/* ========================================
   移动端适配 (< 768px)
   ======================================== */
@media (max-width: 767px) {
    /* 全局防止溢出 */
    html, body {
        max-width: 100vw;
        overflow-x: hidden;
    }
    
    * {
        max-width: 100%;
    }
    
    .app-container,
    .main-content,
    .sidebar,
    .content-section {
        max-width: 100vw;
        overflow-x: hidden;
    }
    /* 主布局 */
    .main-content {
        margin-left: 0;
        padding: 0 0.75rem 0.75rem;
        max-width: 100vw;
        overflow-x: hidden;
    }

    /* 侧边栏 */
    .sidebar {
        transform: translateX(-100%);
    }

    .sidebar.active {
        transform: translateX(0);
        box-shadow: 4px 0 24px rgba(0, 0, 0, 0.2);
    }

    .sidebar-toggle {
        display: block;
    }

    /* 侧边栏遮罩 */
    .sidebar-overlay {
        animation: overlayFadeIn 0.3s ease-out;
    }

    /* 移动端头部 - 重新设计 */
    .mobile-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1.25rem 0.75rem;
        background: rgba(255, 255, 255, 1);
        backdrop-filter: none;
        border-radius: 0;
        margin-left: -0.75rem;
        margin-right: -0.75rem;
        margin-bottom: 1.25rem;
        width: calc(100% + 1.5rem);
        max-width: none;
        border-bottom: 1px solid var(--border-color);
        box-shadow: 0 6px 24px rgba(0, 0, 0, 0.06);
        position: sticky;
        top: 0;
        z-index: 100;
        animation: slideInDown 0.4s ease-out;
    }

    /* 左侧区域 */
    .mobile-header-left {
        display: flex;
        align-items: center;
        gap: 1rem;
        flex: 1;
        min-width: 0;
    }

    /* 菜单按钮 */
    .mobile-menu-btn {
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 5px;
        width: 44px;
        height: 44px;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        padding: 0;
        cursor: pointer;
        transition: all var(--transition-fast);
        position: relative;
        overflow: hidden;
        flex-shrink: 0;
    }

    .mobile-menu-btn::before {
        content: '';
        position: absolute;
        inset: 0;
        background: var(--gradient-primary);
        opacity: 0;
        transition: opacity var(--transition-fast);
    }

    .mobile-menu-btn:hover::before {
        opacity: 0.1;
    }

    .mobile-menu-btn:active {
        transform: scale(0.95);
    }

    .menu-line {
        display: block;
        width: 20px;
        height: 2.5px;
        background: var(--text-primary);
        border-radius: 2px;
        margin: 0 auto;
        transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        position: relative;
    }

    .sidebar.active ~ .main-content .mobile-menu-btn .menu-line:nth-child(1) {
        transform: translateY(7.5px) rotate(45deg);
    }

    .sidebar.active ~ .main-content .mobile-menu-btn .menu-line:nth-child(2) {
        opacity: 0;
        transform: translateX(-20px);
    }

    .sidebar.active ~ .main-content .mobile-menu-btn .menu-line:nth-child(3) {
        transform: translateY(-7.5px) rotate(-45deg);
    }

    /* Logo区域 */
    .mobile-logo-wrapper {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex: 1;
        min-width: 0;
    }

    .mobile-logo-image {
        width: 36px;
        height: 36px;
        border-radius: var(--radius-md);
        object-fit: cover;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        flex-shrink: 0;
    }

    .mobile-title-group {
        display: flex;
        flex-direction: column;
        gap: 0.125rem;
        flex: 1;
        min-width: 0;
    }

    .mobile-title {
        font-size: 1rem;
        font-weight: 700;
        color: var(--text-primary);
        line-height: 1.2;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        background: var(--gradient-primary);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
    }

    .mobile-subtitle {
        font-size: 0.6875rem;
        font-weight: 500;
        color: var(--text-tertiary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    /* 右侧区域 */
    .mobile-header-right {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-shrink: 0;
    }

    /* 操作按钮 */
    .mobile-action-btn {
        width: 40px;
        height: 40px;
        background: rgba(255, 255, 255, 0.78);
        border: 1px solid rgba(203, 213, 225, 0.72);
        border-radius: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: transform var(--transition-fast), border-color var(--transition-fast), background var(--transition-fast), box-shadow var(--transition-fast);
        position: relative;
        overflow: hidden;
        box-shadow: 0 8px 18px rgba(15, 23, 42, 0.05);
    }

    .mobile-action-btn::before {
        display: none;
    }

    .mobile-action-btn:hover {
        background: rgba(255, 255, 255, 0.94);
        border-color: rgba(79, 70, 229, 0.14);
        box-shadow: 0 10px 18px rgba(15, 23, 42, 0.06);
    }

    .mobile-action-btn:active {
        transform: scale(0.96);
    }

    .mobile-action-icon {
        width: 20px;
        height: 20px;
        color: var(--text-primary);
        transition: all var(--transition-fast);
        position: relative;
        z-index: 1;
    }

    .mobile-action-btn .theme-icon-sun {
        display: block;
    }

    .mobile-action-btn .theme-icon-moon {
        display: none;
    }

    [data-theme="dark"] .mobile-action-btn .theme-icon-sun {
        display: none;
    }

    [data-theme="dark"] .mobile-action-btn .theme-icon-moon {
        display: block;
    }

    /* 状态指示器 */
    .mobile-status-indicator {
        width: 40px;
        height: 40px;
        background: rgba(255, 255, 255, 0.78);
        border: 1px solid rgba(203, 213, 225, 0.72);
        border-radius: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: transform var(--transition-fast), border-color var(--transition-fast), background var(--transition-fast), box-shadow var(--transition-fast);
        box-shadow: 0 8px 18px rgba(15, 23, 42, 0.05);
    }

    .mobile-status-indicator:active {
        transform: scale(0.96);
    }

    .status-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        position: relative;
    }

    .status-dot::before {
        content: '';
        position: absolute;
        inset: -4px;
        border-radius: 50%;
        background: inherit;
        opacity: 0.3;
        animation: pulse 2s ease-in-out infinite;
    }

    .status-dot.status-running {
        background: var(--success-color);
        box-shadow: 0 0 8px var(--success-color);
    }

    .status-dot.status-warning {
        background: var(--warning-color);
        box-shadow: 0 0 8px var(--warning-color);
    }

    .status-dot.status-error {
        background: var(--danger-color);
        box-shadow: 0 0 8px var(--danger-color);
    }

    /* 区块标题 */
    .section-header {
        flex-direction: column;
        align-items: flex-start !important;
        gap: 1rem;
    }

    .section-title {
        font-size: 1.5rem;
    }

    .section-desc {
        font-size: 0.875rem;
    }

    .header-actions {
        width: 100%;
        flex-wrap: wrap;
    }

    .header-actions .btn {
        flex: 1;
        min-width: calc(50% - 0.375rem);
        justify-content: center;
    }

    /* 表单 */
    .form-card {
        padding: 1rem;
    }

    .input-group {
        flex-direction: column;
        width: 100%;
        box-sizing: border-box;
    }

    .input-group .btn {
        width: 100%;
        box-sizing: border-box;
    }
    
    .form-input,
    .form-select,
    .form-textarea {
        max-width: 100%;
        box-sizing: border-box;
    }

    /* 修复移动端键盘/viewport变化导致的元素偶发“消失”问题（Chrome/部分WebView） */
    .section-header,
    .header-actions,
    .danmu-method-panel,
    .danmu-method-switcher,
    .input-group {
        transform: translateZ(0);
        backface-visibility: hidden;
    }

    /* 让浏览器自动滚动聚焦输入框时，预留底部空间，避免把“搜索/匹配”按钮挤出视口 */
    .form-input,
    .form-select,
    .form-textarea {
        scroll-margin-bottom: 240px;
    }

    /* 深色模式下输入框 focus 的 transform 在移动端可能触发重绘异常 */
    [data-theme="dark"] .form-input:focus,
    [data-theme="dark"] .form-select:focus,
    [data-theme="dark"] .form-textarea:focus {
        transform: none;
    }

/* 搜索输入组在移动端保持横向布局 */
    .input-group.search-input-group {
        flex-direction: row;
    }

    .input-group.search-input-group .search-input {
        flex: 1;
        min-width: 0;
    }

    .input-group.search-input-group .search-btn {
        width: auto;
        flex-shrink: 0;
        padding: 0.75rem 1rem;
    }
    
    .search-btn-text {
        display: inline;
    }
    
    /* 模态框按钮在移动端保持横向 */
    .modal-footer-compact {
        flex-direction: row;
        gap: 0.625rem;
        padding: 1rem;
    }
    
    .modal-footer-compact .btn-modal {
        font-size: 0.875rem;
        padding: 0.625rem 1rem;
    }
    /* 按钮 */
    .btn {
        padding: 0.625rem 1rem;
        font-size: 0.875rem;
    }

    .btn-sm {
        padding: 0.5rem 0.875rem;
        font-size: 0.8125rem;
    }

    .btn-lg {
        padding: 0.75rem 1.25rem;
        font-size: 1rem;
    }

    /* 模态框 */
    .modal-container {
        margin: 1rem;
        max-height: calc(100vh - 2rem);
    }

    .modal-header {
        padding: 1rem;
    }

    .modal-body {
        padding: 1rem;
    }

    .modal-footer {
        padding: 1rem;
        flex-direction: column;
    }

    .modal-footer .btn {
        width: 100%;
    }

    /* 页脚 */
    .footer {
        padding: 1.5rem 1rem;
        margin-top: 3rem;
    }

    .footer-links {
        flex-direction: column;
        gap: 0.75rem;
    }

    .footer-link {
        justify-content: center;
    }

    /* 主题切换按钮 */
    .theme-toggle {
        bottom: 1rem;
        right: 1rem;
        width: 48px;
        height: 48px;
    }

    .theme-icon {
        width: 20px;
        height: 20px;
    }

    /* 版本卡片 */
    .version-card {
        margin: 0.75rem;
        padding: 0.875rem;
    }

    .version-item {
        font-size: 0.8125rem;
    }

    .version-update-notice {
        flex-direction: column;
        text-align: center;
    }

    .update-btn {
        width: 100%;
    }

    /* API端点卡片 */
    .endpoint-value {
        font-size: 0.75rem;
    }

    /* 多选标签 */
    .selected-tags,
    .available-tags {
        padding: 0.75rem;
    }

    .selected-tag,
    .available-tag,
    .tag-option {
        font-size: 0.8125rem;
        padding: 0.375rem 0.75rem;
    }

    /* 数字选择器 */
    .number-display {
        font-size: 1.5rem;
    }

    /* 颜色池 */
    .color-pool-controls {
        flex-direction: column;
    }

    .color-pool-controls .btn {
        width: 100%;
    }

    .color-input-wrapper {
        flex-direction: column;
        width: 100%;
    }

    .color-hex-input-wrapper {
        max-width: 100%;
    }

    .color-add-btn {
        width: 100%;
        justify-content: center;
    }

    .color-chip {
        width: 44px;
        height: 44px;
    }

    .pool-stats {
        flex-direction: row;
        align-items: center;
        flex-wrap: nowrap;
    }

    /* 加载状态 */
    .loading-content {
        padding: 2rem;
        margin: 1rem;
    }

    .loading-spinner {
        width: 48px;
        height: 48px;
    }

    .loading-title {
        font-size: 1.125rem;
    }

    /* 卡片 */
    .card {
        padding: 1rem;
        max-width: 100%;
        box-sizing: border-box;
    }
    
    .form-card,
    .preview-hero-card,
    .preview-category,
    .env-item,
    .log-terminal {
        max-width: 100%;
        box-sizing: border-box;
    }

    .log-top-actions {
        width: 100%;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.45rem;
    }

    .log-action-btn {
        width: 100%;
        min-width: 0;
        min-height: 34px;
    }

    .log-filters,
    .log-toolbar {
        width: 100%;
        padding: 0.4rem;
        gap: 0.35rem;
    }

    .log-filters {
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.3rem;
    }

    .log-filter-btn {
        width: 100%;
        min-width: 0;
        padding: 0 0.4rem;
    }

    .log-search-group {
        min-width: 100%;
        padding: 0.36rem 0.46rem;
    }

    .log-toolbar-actions {
        width: 100%;
        gap: 0.35rem;
    }

    .log-toolbar-status {
        width: 100%;
        margin-right: 0;
        margin-bottom: 0;
        padding: 0;
    }

    .log-tool-btn {
        flex: 1;
        min-width: 86px;
    }

    .log-terminal {
        padding: 0.75rem;
    }

    .log-line {
        font-size: 0.76rem;
        gap: 0.3rem;
        padding: 0;
    }

    .log-line-level {
        min-width: 2.9em;
    }
    /* 成功动画 */
    .success-icon {
        font-size: 4rem;
    }

    .success-message {
        font-size: 1.25rem;
    }


    /* 弹幕测试/推送页面：搜索结果卡片标题在移动端允许自动换行，避免被截断 */
    .anime-title {
        overflow: visible;
        text-overflow: clip;
        display: block;
        -webkit-line-clamp: initial;
        -webkit-box-orient: initial;
        white-space: normal;
        word-break: break-word;
        overflow-wrap: anywhere;
    }

}

/* ========================================
   小屏手机优化 (< 480px)
   ======================================== */
@media (max-width: 479px) {
    html {
        font-size: 14px;
    }

    .main-content {
        padding: 0 0.75rem 0.75rem;
    }

    .mobile-header {
        padding: 1.15rem 0.75rem;
        margin-left: -0.75rem;
        margin-right: -0.75rem;
        margin-bottom: 1rem;
        width: calc(100% + 1.5rem);
        max-width: none;
        border-radius: 0;
    }

    .mobile-header-left {
        gap: 0.75rem;
    }

    .mobile-menu-btn {
        width: 40px;
        height: 40px;
    }

    .menu-line {
        width: 18px;
    }

    .mobile-logo-image {
        width: 32px;
        height: 32px;
    }

    .mobile-logo-wrapper {
        gap: 0.625rem;
    }

    .mobile-title {
        font-size: 0.9375rem;
    }

    .mobile-subtitle {
        font-size: 0.625rem;
    }

    .mobile-header-right {
        gap: 0.625rem;
    }

    .mobile-action-btn,
    .mobile-status-indicator {
        width: 36px;
        height: 36px;
    }

    .mobile-action-icon {
        width: 18px;
        height: 18px;
    }

    .status-dot {
        width: 8px;
        height: 8px;
    }

    .section-title {
        font-size: 1.25rem;
    }

    .btn {
        padding: 0.5rem 0.875rem;
        font-size: 0.8125rem;
    }

    .form-input,
    .form-select,
    .form-textarea {
        padding: 0.625rem 0.875rem;
        font-size: 0.875rem;
    }

    .color-chip {
        width: 36px;
        height: 36px;
    }

    .number-btn {
        width: 28px;
        height: 28px;
    }

    .theme-toggle {
        width: 44px;
        height: 44px;
    }
    .search-input-group .search-btn {
        padding: 0.75rem 0.875rem;
    }

    .log-top-actions {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.35rem;
    }

    .log-filters,
    .log-toolbar {
        padding: 0.34rem;
        gap: 0.28rem;
    }

    .log-action-btn {
        min-height: 32px;
        padding: 0 0.46rem;
        font-size: 0.72rem;
    }

    .log-filters {
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.24rem;
    }

    .log-filter-btn {
        width: 100%;
        min-width: 0;
        height: 28px;
        padding: 0 0.28rem;
        font-size: 0.66rem;
    }

    .log-tool-btn {
        min-width: 70px;
        height: 28px;
        padding: 0 0.45rem;
        font-size: 0.68rem;
    }

    .log-toolbar-status {
        font-size: 0.68rem;
        padding: 0;
    }

    .log-line {
        font-size: 0.72rem;
        gap: 0.25rem;
        padding: 0;
    }
    
    .search-btn-text {
        font-size: 0.8125rem;
    }
    
    .modal-footer-compact .btn-modal {
        font-size: 0.8125rem;
        padding: 0.625rem 0.875rem;
        gap: 0.375rem;
    }
    
    .modal-footer-compact .btn-modal .btn-icon {
        width: 16px;
        height: 16px;
    }
}

/* ========================================
   平板适配 (768px - 1024px)
   ======================================== */
@media (min-width: 768px) and (max-width: 1024px) {
    /* 隐藏移动端头部 */
    .mobile-header {
        display: none;
    }

    /* 主布局微调 */
    .main-content {
        padding: 1.5rem;
    }

    /* 侧边栏 */
    .sidebar {
        width: 260px;
    }

    .main-content {
        margin-left: 260px;
    }

    /* 按钮组 */
    .header-actions .btn {
        padding: 0.625rem 1rem;
        font-size: 0.875rem;
    }

    /* 网格布局 */
    .two-col-grid {
        grid-template-columns: 1fr;
    }

    .three-col-grid {
        grid-template-columns: repeat(2, 1fr);
    }

    /* 表单 */
    .input-group .form-input {
        min-width: 200px;
    }

    /* 颜色池 */
    .color-chip {
        width: 48px;
        height: 48px;
    }

    /* 页脚 */
    .footer {
        padding: 1.75rem;
    }
}

/* ========================================
   桌面端适配 (> 1024px)
   ======================================== */
@media (min-width: 1025px) {
    /* 隐藏移动端头部 */
    .mobile-header {
        display: none;
    }

    /* 内容宽度限制 */
    .main-content {
        max-width: 1400px;
    }

    /* 悬浮效果增强 */
    .card:hover {
        transform: translateY(-4px);
    }

    /* 按钮悬浮效果 */
    .btn:hover:not(:disabled) {
        transform: translateY(-2px);
    }

    /* 标签悬浮效果 */
    .tag-option:hover {
        transform: translateY(-3px);
    }

    /* 颜色块悬浮效果 */
    .color-chip:hover {
        transform: scale(1.15);
    }
}

/* ========================================
   大屏幕优化 (> 1440px)
   ======================================== */
@media (min-width: 1441px) {
    html {
        font-size: 17px;
    }

    .sidebar {
        width: 300px;
    }

    .main-content {
        margin-left: 300px;
        padding: 2.5rem;
    }

    .section-title {
        font-size: 2rem;
    }

    /* 网格优化 */
    .four-col-grid {
        grid-template-columns: repeat(4, 1fr);
    }

    /* 更大的卡片间距 */
    .card {
        padding: 2rem;
    }

    /* 页脚 */
    .footer {
        padding: 2.5rem;
    }
}

/* ========================================
   触摸设备优化
   ======================================== */
@media (hover: none) and (pointer: coarse) {
    /* 增大可点击区域 */
    .btn {
        min-height: 44px;
    }

    .nav-item {
        min-height: 48px;
    }

    .tag-option,
    .available-tag,
    .selected-tag {
        min-height: 40px;
    }

    .number-btn {
        min-width: 44px;
        min-height: 44px;
    }

    /* 移除悬浮效果 */
    .card:hover {
        transform: none;
    }

    .btn:hover {
        transform: none;
    }

    /* 增强点击反馈 */
    .btn:active {
        transform: scale(0.97);
    }

    .nav-item:active {
        transform: scale(0.98);
    }

    .tag-option:active,
    .available-tag:active {
        transform: scale(0.95);
    }
}

/* ========================================
   打印样式
   ======================================== */
@media print {
    /* 隐藏不需要打印的元素 */
    .sidebar,
    .theme-toggle,
    .mobile-header,
    .header-actions,
    .btn,
    .nav-menu,
    .footer-links {
        display: none !important;
    }

    /* 重置布局 */
    .main-content {
        margin-left: 0;
        padding: 0;
    }

    /* 移除背景和边框 */
    body,
    .card,
    .form-card {
        background: white !important;
        box-shadow: none !important;
        border: none !important;
    }

    /* 确保文字清晰 */
    body {
        color: black !important;
    }

    /* 分页优化 */
    .card,
    .form-card {
        page-break-inside: avoid;
    }
}

/* ========================================
   横屏模式优化
   ======================================== */
@media (max-width: 767px) and (orientation: landscape) {
    /* 减小垂直间距 */
    .main-content {
        padding: 0 0.75rem 0.75rem;
    }

    .mobile-header {
        padding: 1.05rem 0.75rem;
        margin-left: -0.75rem;
        margin-right: -0.75rem;
        margin-bottom: 0.75rem;
        width: calc(100% + 1.5rem);
        max-width: none;
    }

    .section-header {
        margin-bottom: 1rem;
    }

    /* 紧凑按钮 */
    .btn {
        padding: 0.5rem 0.875rem;
    }

    /* 模态框高度优化 */
    .modal-container {
        max-height: 90vh;
    }

    /* 侧边栏宽度 */
    .sidebar {
        width: 260px;
    }
}

/* ========================================
   减少动画 (用户偏好)
   ======================================== */
@media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
    }

    .loading-spinner {
        animation: none;
        border-top-color: var(--primary-color);
    }
}

/* ========================================
   高对比度模式
   ======================================== */
@media (prefers-contrast: high) {
    :root {
        --border-color: rgba(0, 0, 0, 0.3);
        --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.2);
        --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.3);
        --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.4);
    }

    [data-theme="dark"] {
        --border-color: rgba(255, 255, 255, 0.3);
    }

    /* 增强边框 */
    .card,
    .form-input,
    .form-select,
    .btn,
    .sidebar {
        border-width: 2px;
    }

    /* 减少透明度 */
    .backdrop-blur {
        backdrop-filter: none;
    }
}

/* ========================================
   深色模式用户偏好
   ======================================== */
@media (prefers-color-scheme: dark) {
    /* 如果用户偏好深色，但未手动设置主题，则自动应用深色 */
    :root:not([data-theme]) {
        --bg-primary: rgba(15, 23, 42, 0.95);
        --bg-secondary: rgba(30, 41, 59, 0.9);
        --bg-tertiary: rgba(51, 65, 85, 0.85);
        --text-primary: #f1f5f9;
        --text-secondary: #cbd5e1;
        --text-tertiary: #94a3b8;
        --border-color: rgba(71, 85, 105, 0.6);
        --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.3);
        --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.4);
        --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.5);
    }
}

/* ========================================
   深色模式 - 移动端顶栏增强
   ======================================== */
@media (max-width: 767px) {
    [data-theme="dark"] .mobile-header {
        background: rgba(10, 15, 30, 1);
        backdrop-filter: none;
        border: none;
        border-bottom: 1px solid var(--border-color);
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.55);
    }

    [data-theme="dark"] .mobile-header::before,
    [data-theme="dark"] .mobile-header::after {
        content: none;
    }

    @keyframes headerShine {
        0% { left: -100%; }
        50%, 100% { left: 100%; }
    }

    @keyframes headerGlow {
        0%, 100% {
            opacity: 0.5;
            transform: scaleX(1);
        }
        50% {
            opacity: 1;
            transform: scaleX(1.05);
        }
    }

    [data-theme="dark"] .mobile-menu-btn,
    [data-theme="dark"] .mobile-action-btn,
    [data-theme="dark"] .mobile-status-indicator {
        background: rgba(17, 24, 39, 0.75);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(99, 102, 241, 0.25);
        box-shadow: 
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            0 4px 12px rgba(0, 0, 0, 0.3);
        transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    [data-theme="dark"] .mobile-menu-btn:hover,
    [data-theme="dark"] .mobile-action-btn:hover,
    [data-theme="dark"] .mobile-status-indicator:hover {
        background: rgba(17, 24, 39, 0.9);
        border-color: rgba(129, 140, 248, 0.5);
        box-shadow: 
            0 0 30px rgba(129, 140, 248, 0.25),
            0 0 60px rgba(167, 139, 250, 0.15),
            inset 0 1px 0 rgba(255, 255, 255, 0.12),
            0 4px 16px rgba(0, 0, 0, 0.4);
        transform: scale(1.05);
    }

    [data-theme="dark"] .mobile-menu-btn:active,
    [data-theme="dark"] .mobile-action-btn:active,
    [data-theme="dark"] .mobile-status-indicator:active {
        transform: scale(0.95);
        box-shadow: 
            0 0 15px rgba(129, 140, 248, 0.3),
            inset 0 2px 4px rgba(0, 0, 0, 0.3);
    }

    [data-theme="dark"] .mobile-logo-image {
        box-shadow: 
            0 4px 16px rgba(0, 0, 0, 0.5),
            0 0 30px rgba(99, 102, 241, 0.3),
            0 0 60px rgba(129, 140, 248, 0.15);
        border: 1px solid rgba(129, 140, 248, 0.2);
    }

    [data-theme="dark"] .status-dot.status-running {
        box-shadow: 
            0 0 16px var(--success-color),
            0 0 32px rgba(52, 211, 153, 0.4),
            0 0 48px rgba(16, 185, 129, 0.2);
        animation: statusPulse 2s ease-in-out infinite;
    }

    [data-theme="dark"] .status-dot.status-warning {
        box-shadow: 
            0 0 16px var(--warning-color),
            0 0 32px rgba(251, 191, 36, 0.4),
            0 0 48px rgba(245, 158, 11, 0.2);
        animation: statusPulse 2s ease-in-out infinite;
    }

    [data-theme="dark"] .status-dot.status-error {
        box-shadow: 
            0 0 16px var(--danger-color),
            0 0 32px rgba(248, 113, 113, 0.4),
            0 0 48px rgba(239, 68, 68, 0.2);
        animation: statusPulse 1.5s ease-in-out infinite;
    }

    @keyframes statusPulse {
        0%, 100% {
            transform: scale(1);
            opacity: 1;
        }
        50% {
            transform: scale(1.1);
            opacity: 0.8;
        }
    }
}

/* ========================================
   响应式适配
   ======================================== */
@media (max-width: 767px) {
    .api-mode-tabs {
        width: 100%;
    }

    .api-mode-tab {
        flex: 1;
        justify-content: center;
        padding: 0.625rem 1rem;
        font-size: 0.875rem;
    }

    .api-mode-tab .btn-icon {
        width: 16px;
        height: 16px;
    }

    .danmu-method-tabs {
        width: 100%;
    }

    .danmu-method-tab {
        flex: 1;
        justify-content: center;
        padding: 0.625rem 0.875rem;
        font-size: 0.875rem;
    }

    .danmu-info-header {
        flex-direction: column;
        align-items: flex-start;
    }

    .danmu-actions {
        width: 100%;
    }

    .danmu-actions .btn {
        flex: 1;
    }

    .danmu-stats-grid {
        grid-template-columns: repeat(2, 1fr);
    }

    .danmu-list-header {
        flex-direction: column;
        align-items: flex-start;
    }

    .danmu-list-filters {
        width: 100%;
    }

    .danmu-filter-btn {
        flex: 1;
        text-align: center;
        font-size: 0.75rem;
        padding: 0.375rem 0.5rem;
    }

    .danmu-item {
        flex-direction: column;
        gap: 0.5rem;
    }

    .danmu-item-time {
        width: fit-content;
    }
}


/* ========================================
   2026 响应式工作区重构
   ======================================== */
@media (min-width: 1400px) {
    .preview-command-grid {
        grid-template-columns: minmax(0, 1.6fr) minmax(320px, 0.86fr);
    }

    .preview-stats-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
    }
}

@media (max-width: 1279px) {
    .desktop-command-bar {
        grid-template-columns: 1fr;
    }

    .command-bar-actions {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .theme-toggle-inline {
        width: 100%;
        border-radius: 20px;
        justify-self: stretch;
    }

    .preview-command-grid {
        grid-template-columns: 1fr;
    }

}

@media (max-width: 1024px) {
    .app-container {
        width: calc(100% - 24px);
        gap: 16px;
        padding-top: 16px;
    }

    .sidebar {
        width: 280px;
        min-width: 280px;
    }

    .content-section {
        padding: 1.15rem;
    }

    .preview-stats-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (max-width: 767px) {
    .app-container {
        display: block;
        width: 100%;
        padding: 0;
    }

    .sidebar {
        position: fixed;
        inset: 0 auto 0 0;
        width: min(88vw, 340px);
        min-width: 0;
        max-height: 100vh;
        min-height: 100vh;
        border-radius: 0 28px 28px 0;
        transform: translateX(-108%);
    }

    .sidebar.active {
        transform: translateX(0);
    }

    .main-content {
        padding: 0 12px 16px;
    }

    .mobile-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        padding: 1rem 1rem 0.9rem;
        margin: 0 -12px 14px;
        width: calc(100% + 24px);
        border-radius: 0 0 24px 24px;
        border-bottom: 1px solid rgba(148, 163, 184, 0.14);
        background: rgba(255, 255, 255, 0.88);
        backdrop-filter: blur(18px);
        box-shadow: 0 16px 30px rgba(15, 23, 42, 0.08);
    }

    .content-shell {
        gap: 14px;
    }

    .content-section {
        padding: 1rem;
        border-radius: 24px;
    }

    .preview-command-grid {
        grid-template-columns: 1fr;
        display: grid;
        gap: 14px;
    }

    .preview-stats-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.75rem;
    }

    .preview-grid {
        grid-template-columns: 1fr;
    }

    .footer {
        width: calc(100% - 24px);
        padding: 1.35rem;
    }
}

@media (max-width: 560px) {
    .hero-overview-topline {
        gap: 0.42rem;
    }


    .preview-stats-grid {
        grid-template-columns: 1fr;
    }

    .header-actions {
        width: 100%;
    }

    .header-actions .btn {
        flex: 1 1 calc(50% - 8px);
        justify-content: center;
    }

    .preview-hero-title {
        font-size: 1.9rem;
    }

    .mobile-title {
        font-size: 0.96rem;
    }
}

@media (orientation: landscape) and (max-width: 1024px) {
    .mobile-header {
        position: sticky;
        top: 0;
        z-index: 100;
    }

}

[data-theme="dark"] .mobile-header {
    background: rgba(8, 12, 24, 0.9);
    border-bottom-color: rgba(129, 140, 248, 0.16);
}



/* ========================================
   2026 移动底栏服务台响应式
   ======================================== */
@media (max-width: 860px) {
    .hero-overview-topline {
        gap: 0.5rem;
        flex-wrap: nowrap;
        align-items: center;
    }

    .hero-overview-theme .mobile-action-icon {
        width: 12px;
        height: 12px;
    }

    .hero-overview-status .status-dot {
        width: 7px;
        height: 7px;
    }


    .sidebar {
        display: none;
    }

    .app-container {
        width: 100%;
        display: block;
        padding: 0;
    }

    .main-content {
        padding: 0 12px calc(104px + env(safe-area-inset-bottom));
    }

    .mobile-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        position: sticky;
        top: 0;
        z-index: 120;
        padding: 0.95rem 0.1rem 0.85rem;
        margin: 0 0 14px;
        border-bottom: 1px solid rgba(148, 163, 184, 0.12);
        background: rgba(248, 250, 252, 0.86);
        backdrop-filter: blur(18px);
    }

    .mobile-header-left,
    .mobile-header-right {
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    .mobile-header-left {
        flex: 1;
    }

    .mobile-title-group {
        gap: 0.08rem;
    }

    .mobile-title {
        font-size: 1rem;
        line-height: 1.15;
        background: none;
        -webkit-text-fill-color: initial;
        color: var(--text-primary);
    }

    .mobile-subtitle {
        font-size: 0.72rem;
        text-transform: none;
        letter-spacing: 0.04em;
    }

    .mobile-menu-btn {
        display: none !important;
    }


    .mobile-bottom-nav {
        display: block;
        position: fixed;
        left: 12px;
        right: 12px;
        bottom: calc(12px + env(safe-area-inset-bottom));
        z-index: 140;
        padding: 0.55rem;
        border-radius: 28px;
        border: 1px solid rgba(148, 163, 184, 0.14);
        background: rgba(255, 255, 255, 0.82);
        box-shadow: 0 20px 44px rgba(15, 23, 42, 0.14);
        backdrop-filter: blur(22px);
        transition: transform var(--transition-base), opacity var(--transition-base);
    }

    body.mobile-nav-hidden .mobile-bottom-nav {
        transform: translateY(calc(100% + 20px));
        opacity: 0;
        pointer-events: none;
    }

    .content-shell {
        gap: 14px;
    }

    .content-section {
        padding: 1rem;
        border-radius: 24px;
    }

    .preview-command-grid {
        grid-template-columns: 1fr;
    }

    .preview-stats-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .section-header {
        gap: 0.85rem;
    }

    .category-tabs,
    .api-mode-tabs,
    .danmu-method-tabs,
    .log-filters {
        overflow-x: auto;
        flex-wrap: nowrap;
        scrollbar-width: none;
    }

    .category-tabs::-webkit-scrollbar,
    .api-mode-tabs::-webkit-scrollbar,
    .danmu-method-tabs::-webkit-scrollbar,
    .log-filters::-webkit-scrollbar {
        display: none;
    }

    [data-theme="dark"] .mobile-header,
    [data-theme="dark"] .mobile-bottom-nav {
        background: rgba(8, 12, 24, 0.88);
        border-color: rgba(129, 140, 248, 0.16);
    }
}

@media (max-width: 560px) {
    .mobile-bottom-nav {
        left: 10px;
        right: 10px;
        padding: 0.45rem;
    }

    .mobile-nav-item {
        min-width: 64px;
        min-height: 58px;
        padding: 0.55rem 0.65rem;
    }

    .preview-stats-grid {
        grid-template-columns: 1fr;
    }

    .header-actions .btn {
        flex: 1 1 100%;
    }
}




/* ========================================
   2026 首页与底栏重构响应式
   ======================================== */
.desktop-command-bar {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 1rem;
    padding: 0.82rem 0.95rem;
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.86);
    box-shadow: 0 16px 30px rgba(15, 23, 42, 0.08);
}

.command-bar-copy {
    gap: 0.45rem;
    padding-right: 0;
}

.command-title {
    max-width: none;
    font-size: 1.24rem;
    line-height: 1.06;
}

.command-desc {
    max-width: 52ch;
    font-size: 0.82rem;
    line-height: 1.55;
}

.command-shortcuts {
    gap: 0.45rem;
}

.command-chip {
    min-height: 32px;
    padding: 0.38rem 0.72rem;
    border-radius: 13px;
    font-size: 0.76rem;
    background: rgba(255, 255, 255, 0.74);
    border: 1px solid rgba(148, 163, 184, 0.14);
}

.command-bar-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.55rem;
    flex-wrap: wrap;
}

.desktop-status-pill {
    min-height: 40px;
    padding: 0 0.78rem;
    border-radius: 15px;
    gap: 0.5rem;
}

.desktop-status-text {
    font-size: 0.82rem;
}

.theme-toggle-inline {
    width: 40px;
    height: 40px;
    border-radius: 15px;
}

.version-card-inline {
    grid-column: auto;
    min-width: 220px;
    padding: 0.62rem 0.75rem;
    border-radius: 16px;
}

.version-header {
    margin-bottom: 0.5rem;
}

.version-content-inline {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    flex-wrap: wrap;
}

.version-item {
    gap: 0.45rem;
}

.version-label {
    font-size: 0.7rem;
}

.version-value {
    font-size: 0.76rem;
}

.version-update-notice {
    padding: 0.5rem 0.6rem;
    border-radius: 13px;
}

[data-theme="dark"] .desktop-command-bar {
    background: linear-gradient(180deg, rgba(8, 12, 24, 0.9) 0%, rgba(15, 23, 42, 0.92) 100%);
}

@media (max-width: 1280px) {
    .desktop-command-bar {
        grid-template-columns: 1fr;
        align-items: start;
    }

    .command-bar-actions {
        justify-content: flex-start;
    }
}

@media (max-width: 1120px) {
    .hero-main-row,
    .preview-grid {
        grid-template-columns: 1fr;
    }
}

@media (max-width: 860px) {
    .main-content {
        padding: 0 12px calc(72px + env(safe-area-inset-bottom));
        gap: 0;
    }

    .content-shell {
        gap: 12px;
    }

    .content-section {
        padding: 0.95rem;
        border-radius: 24px;
    }

    .preview-command-grid-single {
        margin-bottom: 0.9rem;
    }

    .api-service-hero-refined {
        padding: 0.95rem;
        border-radius: 24px;
    }

    .preview-hero-header-refined {
        align-items: flex-start;
    }

    .api-service-hero-refined .preview-hero-title {
        font-size: 1.72rem;
    }

    .api-service-hero-refined .preview-hero-subtitle {
        font-size: 0.82rem;
        line-height: 1.6;
    }

    .hero-brand-block,
    .hero-service-panel {
        padding: 0.92rem;
        border-radius: 20px;
    }

    .hero-service-body {
        gap: 0.6rem;
    }

    .hero-endpoint-panel {
        min-height: 96px;
        padding: 0.82rem 0.86rem;
        gap: 0.28rem;
    }

    .hero-endpoint-value {
        font-size: 0.8rem;
    }

    .hero-status-rail {
        grid-template-columns: 1fr;
        gap: 0.6rem;
    }

    .hero-status-panel,
    .hero-mode-panel {
        min-height: 65px;
        padding: 0.52rem 0.72rem;
        gap: 0.52rem;
        border-radius: 18px;
    }

    .stat-icon-wrapper {
        width: 36px;
        height: 36px;
    }

    .stat-icon-wrapper svg {
        width: 17.5px;
        height: 17.5px;
    }

    .preview-stats-strip {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.55rem;
        padding: 0;
    }

    .hero-metric-item {
        min-height: 92px;
        padding: 0.78rem 0.74rem;
        border-radius: 16px;
    }

    .preview-grid {
        grid-template-columns: 1fr;
        gap: 0.9rem;
    }

    .preview-category {
        min-height: auto;
        border-radius: 22px;
    }

    .preview-items {
        grid-template-columns: 1fr;
        overflow: visible;
        padding-right: 0;
    }

    .preview-item {
        min-height: auto;
        grid-template-rows: auto auto auto;
    }

    .preview-value {
        min-height: 52px;
        max-height: none;
    }

    .mobile-bottom-nav {
        display: block;
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 140;
        padding: 0.34rem 0.4rem max(0.22rem, env(safe-area-inset-bottom));
        border-radius: 22px 22px 0 0;
        border: 1px solid rgba(148, 163, 184, 0.14);
        border-bottom: 0;
        background: rgba(255, 255, 255, 0.94);
        box-shadow: 0 -10px 28px rgba(15, 23, 42, 0.1);
        backdrop-filter: blur(20px);
        transition: transform var(--transition-base), opacity var(--transition-base);
    }

    .mobile-bottom-nav::before {
        content: '';
        position: absolute;
        top: 0.42rem;
        left: 50%;
        transform: translateX(-50%);
        width: 38px;
        height: 4px;
        border-radius: 999px;
        background: rgba(148, 163, 184, 0.32);
    }

    body.mobile-nav-hidden .mobile-bottom-nav {
        transform: translateY(calc(100% + env(safe-area-inset-bottom) + 6px));
        opacity: 0;
        pointer-events: none;
    }

    .mobile-bottom-nav-scroll {
        display: grid;
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: 0.12rem;
        overflow: visible;
    }

    .mobile-nav-item {
        min-width: 0;
        min-height: 50px;
        padding: 0.42rem 0.12rem 0.32rem;
        gap: 0.18rem;
        border-radius: 14px;
        background: transparent;
        border: 1px solid transparent;
        box-shadow: none;
    }

    .mobile-nav-item.active {
        background: rgba(79, 70, 229, 0.08);
        border-color: rgba(79, 70, 229, 0.16);
        box-shadow: none;
    }

    .mobile-nav-item span {
        font-size: 0.62rem;
    }

    .mobile-nav-icon {
        width: 17px;
        height: 17px;
    }

    [data-theme="dark"] .mobile-bottom-nav {
        background: rgba(11, 17, 29, 0.96);
        border-color: rgba(108, 128, 166, 0.2);
        box-shadow: 0 -10px 30px rgba(2, 6, 23, 0.32);
    }

    [data-theme="dark"] .mobile-bottom-nav::before {
        background: rgba(139, 163, 255, 0.18);
    }

    [data-theme="dark"] .mobile-nav-item {
        background: transparent;
        border-color: transparent;
        box-shadow: none;
    }

    [data-theme="dark"] .mobile-nav-item.active {
        background: linear-gradient(180deg, rgba(70, 88, 164, 0.34) 0%, rgba(39, 54, 114, 0.34) 100%);
        border-color: rgba(139, 163, 255, 0.22);
        box-shadow: none;
    }
}

@media (max-width: 560px) {
    .main-content {
        padding: 0 10px calc(70px + env(safe-area-inset-bottom));
    }

    .content-section {
        padding: 0.85rem;
    }

    .api-service-hero-refined {
        padding: 0.88rem;
    }

    .api-service-hero-refined .preview-hero-icon {
        width: 52px;
        height: 52px;
        border-radius: 16px;
    }

    .api-service-hero-refined .preview-hero-icon svg {
        width: 24px;
        height: 24px;
    }

    .api-service-hero-refined .preview-hero-title {
        font-size: 1.48rem;
    }

    .hero-metric-item {
        min-height: 84px;
        padding: 0.72rem;
    }

    .preview-items {
        gap: 0.6rem;
    }

    .mobile-bottom-nav {
        padding: 0.26rem 0.28rem max(0.14rem, env(safe-area-inset-bottom));
        border-radius: 18px 18px 0 0;
    }



    .mobile-nav-item {
        min-height: 46px;
        padding: 0.34rem 0.04rem 0.24rem;
    }

    .mobile-nav-item span {
        font-size: 0.56rem;
    }
}

/* ========================================
   2026 移动顶栏重构收口
   ======================================== */
@media (max-width: 860px) {
    .mobile-header {
        display: block;
        position: sticky;
        top: 0;
        z-index: 145;
        margin: 0 -12px 6px;
        width: calc(100% + 24px);
        /* 浏览器已处理顶部安全区，站内顶栏不再额外叠加 */
        padding: 8px 14px 8px;
        border: 0;
        border-bottom: 1px solid rgba(148, 163, 184, 0.14);
        border-radius: 0;
        background: rgba(245, 247, 250, 0.96);
        backdrop-filter: blur(20px);
        box-shadow: 0 10px 26px rgba(15, 23, 42, 0.08);
    }

    body.mobile-nav-hidden .mobile-header {
        transform: translateY(calc(-100% - 8px));
        opacity: 0;
        pointer-events: none;
    }

    .mobile-header-left,
    .mobile-header-right {
        min-width: 0;
        display: flex;
        align-items: center;
    }

    .mobile-header-left {
        flex: 1;
    }

    .mobile-header-right {
        gap: 0.55rem;
        flex-shrink: 0;
    }

    .mobile-logo-wrapper {
        gap: 0.78rem;
        min-width: 0;
    }

    .mobile-title-group {
        gap: 0.22rem;
        min-width: 0;
    }

    .mobile-header-kicker {
        color: var(--text-tertiary);
    }

    .mobile-title-row {
        gap: 0.48rem;
    }

    .mobile-title {
        max-width: 100%;
        font-size: 1.02rem;
        font-weight: 800;
        line-height: 1.15;
        color: var(--text-primary);
        background: none;
        -webkit-text-fill-color: initial;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .mobile-subtitle {
        display: inline-flex;
        align-items: center;
        min-width: 0;
        max-width: 38vw;
        padding: 0.18rem 0.48rem;
        border-radius: 999px;
        background: rgba(148, 163, 184, 0.12);
        color: #475569;
        font-size: 0.64rem;
        font-weight: 700;
        line-height: 1.2;
        letter-spacing: 0.04em;
        text-transform: none;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .mobile-action-btn,
    .mobile-status-indicator {
        width: 40px;
        height: 40px;
        border-radius: 14px;
        border: 1px solid rgba(203, 213, 225, 0.72);
        background: rgba(255, 255, 255, 0.82);
        box-shadow: 0 8px 18px rgba(15, 23, 42, 0.05);
    }

    .mobile-action-btn:hover,
    .mobile-status-indicator:hover {
        background: rgba(255, 255, 255, 0.96);
        border-color: rgba(79, 70, 229, 0.14);
        box-shadow: 0 10px 18px rgba(15, 23, 42, 0.06);
    }

    .mobile-action-btn::before {
        display: none;
    }

    .mobile-action-btn:active,
    .mobile-status-indicator:active {
        transform: scale(0.96);
    }

    .mobile-service-mark {
        width: 40px;
        height: 40px;
        border-radius: 14px;
    }

    [data-theme="dark"] .mobile-header {
        background: rgba(11, 17, 29, 0.94);
        border-bottom-color: rgba(108, 128, 166, 0.18);
        box-shadow: 0 14px 28px rgba(2, 6, 23, 0.24);
    }

    [data-theme="dark"] .mobile-action-btn,
    [data-theme="dark"] .mobile-status-indicator {
        background: rgba(18, 26, 44, 0.9);
        border-color: rgba(108, 128, 166, 0.2);
        box-shadow: none;
    }

    [data-theme="dark"] .mobile-subtitle {
        background: rgba(139, 163, 255, 0.12);
        color: #cdd9ff;
    }

    [data-theme="dark"] .mobile-service-mark {
        background: rgba(139, 163, 255, 0.12);
        border-color: rgba(139, 163, 255, 0.18);
        color: #cdd9ff;
    }
}

@media (max-width: 560px) {
    .mobile-header {
        margin: 0 -10px 12px;
        width: calc(100% + 20px);
        padding: 8px 12px 10px;
    }

    .mobile-title {
        font-size: 0.96rem;
    }

    .mobile-subtitle {
        max-width: 34vw;
        padding: 0.16rem 0.44rem;
        font-size: 0.6rem;
    }

    .mobile-action-btn,
    .mobile-status-indicator,
    .mobile-service-mark {
        width: 36px;
        height: 36px;
        border-radius: 12px;
    }
}


/* ========================================
   2026 桌面 / 平板首页顶区收口
   ======================================== */
.desktop-command-bar {
    display: flex;
    align-items: center;
    gap: 0.62rem;
    padding: 0.48rem 0.62rem;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.82);
    border: 1px solid rgba(148, 163, 184, 0.14);
    backdrop-filter: blur(18px);
    box-shadow: 0 8px 20px rgba(15, 23, 42, 0.05);
}

.command-bar-left {
    display: flex;
    align-items: center;
    gap: 0.52rem;
    flex-shrink: 0;
}

.command-bar-mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 9px;
    border: 1px solid rgba(148, 163, 184, 0.18);
    background: rgba(148, 163, 184, 0.1);
    color: #475569;
    font-size: 0.64rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    flex-shrink: 0;
}

.command-bar-title {
    font-size: 0.88rem;
    font-weight: 700;
    color: var(--text-primary);
    white-space: nowrap;
}

.command-bar-nav {
    display: flex;
    align-items: center;
    gap: 0.38rem;
    flex: 1;
    justify-content: center;
    min-width: 0;
}

.command-bar-nav .command-chip {
    min-height: 28px;
    padding: 0.24rem 0.62rem;
    font-size: 0.74rem;
    border-radius: 999px;
    white-space: nowrap;
}

.command-bar-right {
    display: flex;
    align-items: center;
    gap: 0.38rem;
    flex-shrink: 0;
}

.desktop-command-bar .desktop-status-pill {
    min-height: 30px;
    padding: 0 0.58rem;
    border-radius: 999px;
    gap: 0.38rem;
}

.desktop-command-bar .desktop-status-text {
    font-size: 0.76rem;
}

.desktop-command-bar .theme-toggle-inline {
    width: 30px;
    height: 30px;
    border-radius: 9px;
}

[data-theme="dark"] .desktop-command-bar {
    background: rgba(8, 12, 24, 0.82);
    border-color: rgba(129, 140, 248, 0.16);
    box-shadow: 0 8px 20px rgba(2, 6, 23, 0.18);
}

[data-theme="dark"] .command-bar-mark {
    background: rgba(129, 140, 248, 0.12);
    border-color: rgba(129, 140, 248, 0.18);
    color: #c7d2fe;
}

@media (max-width: 1024px) and (min-width: 861px) {
    .command-bar-title {
        display: none;
    }

    .command-bar-nav .command-chip {
        padding: 0.2rem 0.48rem;
        font-size: 0.7rem;
    }
}

@media (max-width: 860px) {
    .desktop-command-bar {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        position: sticky;
        top: 0;
        z-index: 120;
        padding: 0.72rem 0.75rem;
        border-radius: 16px;
        margin: 0 0 6px;
        width: auto;
        background: rgba(248, 250, 252, 0.88);
        backdrop-filter: blur(18px);
        border: 1px solid rgba(148, 163, 184, 0.12);
        box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06);
        grid-template-columns: none;
    }

    .command-bar-left {
        display: flex;
        align-items: center;
        gap: 0.42rem;
        flex: 1;
        min-width: 0;
    }

    .command-bar-nav {
        display: none;
    }

    .command-bar-mark {
        width: 30px;
        height: 30px;
        border-radius: 9px;
        font-size: 0.62rem;
    }

    .command-bar-title {
        font-size: 0.92rem;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .command-bar-right {
        display: flex;
        align-items: center;
        gap: 0.32rem;
        flex-shrink: 0;
    }

    .desktop-command-bar .desktop-status-pill {
        display: inline-flex;
        align-items: center;
        min-height: 30px;
        height: 30px;
        padding: 0 0.46rem;
        border-radius: 999px;
        gap: 0;
    }

    .desktop-command-bar .desktop-status-text {
        display: none;
    }

    .desktop-command-bar .theme-toggle-inline {
        width: 30px;
        height: 30px;
        min-height: auto;
        border-radius: 9px;
        position: static;
    }

    .desktop-command-bar .theme-toggle-inline .theme-icon {
        width: 15px;
        height: 15px;
    }
}

@media (max-width: 560px) {
    .desktop-command-bar {
        padding: 0.62rem 0.65rem;
        gap: 0.42rem;
        border-radius: 14px;
    }

    .command-bar-mark {
        width: 28px;
        height: 28px;
        font-size: 0.58rem;
    }

    .command-bar-title {
        font-size: 0.86rem;
    }

    .desktop-command-bar .desktop-status-pill,
    .desktop-command-bar .theme-toggle-inline {
        width: 28px;
        height: 28px;
        min-height: 28px;
    }
}

@media (max-width: 860px) {
    [data-theme="dark"] .desktop-command-bar {
        background: rgba(8, 12, 24, 0.88);
        border-color: rgba(129, 140, 248, 0.12);
    }
}

@media (min-width: 861px) {
    .main-content {
        gap: 16px;
    }

    .content-shell {
        gap: 16px;
    }

    .preview-command-grid-single {
        margin-bottom: 0;
    }

    .api-service-hero-refined {
        padding: 1.08rem;
        border-radius: 28px;
    }

    .hero-main-row {
        grid-template-columns: minmax(0, 1.08fr) minmax(340px, 0.92fr);
        gap: 0.9rem;
    }

    .hero-brand-block,
    .hero-service-panel {
        padding: 1rem 1.02rem;
        border-radius: 22px;
    }

    .hero-service-panel {
        justify-content: space-between;
    }

    .hero-status-rail {
        gap: 0.65rem;
    }

    .hero-status-panel,
    .hero-mode-panel {
        min-height: 72px;
    }

    .preview-stats-strip {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.68rem;
    }
}

@media (max-width: 1280px) and (min-width: 861px) {
    .hero-main-row {
        grid-template-columns: minmax(0, 1fr) minmax(286px, 0.82fr);
    }
}

@media (max-width: 1120px) and (min-width: 861px) {
    .hero-main-row,
    .preview-grid {
        grid-template-columns: 1fr;
    }

    .preview-stats-strip {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

/* ========================================
   版本组件响应式
   ======================================== */
/* 移动端显示版本徽章 */
@media (max-width: 860px) {
    .mobile-version-badge {
        display: none;
    }

    .version-status-bar {
        display: none;
    }
}

@media (max-width: 560px) {
    .mobile-version-badge {
        padding: 0.18rem 0.46rem;
    }

    .mvb-version {
        font-size: 0.62rem;
    }

    .mvb-status {
        font-size: 0.58rem;
    }
}

@media (min-width: 861px) {
    .desktop-command-bar {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 0.9rem 1rem;
        padding: 0.72rem 0.84rem;
        border-radius: 24px;
        position: relative;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.88);
        border: 1px solid rgba(148, 163, 184, 0.14);
        box-shadow: 0 12px 26px rgba(15, 23, 42, 0.06);
    }

    .desktop-command-bar::before {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.26) 0%, rgba(255, 255, 255, 0) 48%);
        pointer-events: none;
    }

    .command-bar-left {
        display: flex;
        align-items: center;
        gap: 0.72rem;
        min-width: 0;
    }

    .command-bar-mark {
        width: 38px;
        height: 38px;
        border-radius: 12px;
        border: 1px solid rgba(148, 163, 184, 0.18);
        background: linear-gradient(180deg, rgba(248, 250, 252, 0.98) 0%, rgba(226, 232, 240, 0.92) 100%);
        color: #475569;
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.76);
        flex-shrink: 0;
    }

    .command-bar-copy {
        display: grid;
        gap: 0.14rem;
        min-width: 0;
        padding-right: 0;
    }

    .command-bar-heading {
        display: flex;
        align-items: baseline;
        gap: 0.48rem;
        min-width: 0;
    }

    .desktop-command-bar .command-kicker {
        padding: 0;
        background: transparent;
        color: var(--text-tertiary);
        font-size: 0.6rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
    }

    .desktop-command-bar .command-bar-title {
        max-width: 100%;
        font-size: 1.02rem;
        line-height: 1.08;
        color: var(--text-primary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .desktop-command-bar .command-desc {
        display: none;
        margin: 0;
        max-width: 26ch;
        color: var(--text-secondary);
        font-size: 0.74rem;
        line-height: 1.4;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .command-bar-nav {
        grid-column: 1 / -1;
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.38rem;
        padding-left: 50px;
        min-width: 0;
    }

    .desktop-command-bar .command-chip {
        min-height: 30px;
        padding: 0.24rem 0.66rem;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.78);
        border: 1px solid rgba(148, 163, 184, 0.14);
        color: var(--text-secondary);
        font-size: 0.72rem;
        font-weight: 700;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.74);
    }

    .desktop-command-bar .command-chip.active {
        background: rgba(79, 70, 229, 0.08);
        border-color: rgba(79, 70, 229, 0.16);
        color: #312e81;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.82), 0 8px 18px rgba(79, 70, 229, 0.08);
    }

    .command-bar-right {
        display: flex;
        align-items: center;
        gap: 0.42rem;
        flex-shrink: 0;
    }

    .desktop-command-bar .desktop-status-pill {
        min-height: 38px;
        height: 38px;
        padding: 0 0.78rem;
        border-radius: 14px;
        gap: 0.45rem;
    }

    .desktop-command-bar .desktop-status-text {
        font-size: 0.78rem;
        white-space: nowrap;
    }

    .desktop-command-bar .theme-toggle-inline {
        width: 38px;
        height: 38px;
        min-height: auto;
        border-radius: 14px;
        justify-self: auto;
        box-shadow: 0 10px 22px rgba(15, 23, 42, 0.06);
    }

    .desktop-command-bar .theme-toggle-inline .theme-icon {
        width: 18px;
        height: 18px;
    }

    [data-theme="dark"] .desktop-command-bar {
        background: linear-gradient(180deg, rgba(8, 12, 24, 0.9) 0%, rgba(12, 19, 34, 0.94) 100%);
        border-color: rgba(129, 140, 248, 0.14);
        box-shadow: 0 16px 28px rgba(2, 6, 23, 0.22);
    }

    [data-theme="dark"] .desktop-command-bar .command-kicker {
        color: rgba(198, 208, 235, 0.64);
    }

    [data-theme="dark"] .command-bar-mark {
        background: linear-gradient(180deg, rgba(20, 30, 54, 0.94) 0%, rgba(14, 24, 44, 0.9) 100%);
        border-color: rgba(129, 140, 248, 0.18);
        color: #c7d2fe;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
    }

    [data-theme="dark"] .desktop-command-bar .command-chip {
        background: rgba(15, 23, 42, 0.76);
        border-color: rgba(129, 140, 248, 0.12);
        color: rgba(226, 232, 240, 0.78);
        box-shadow: none;
    }

    [data-theme="dark"] .desktop-command-bar .command-chip.active {
        background: linear-gradient(180deg, rgba(70, 88, 164, 0.32) 0%, rgba(39, 54, 114, 0.32) 100%);
        border-color: rgba(139, 163, 255, 0.2);
        color: #dbe4ff;
        box-shadow: none;
    }
}

@media (min-width: 1260px) {
    .desktop-command-bar {
        grid-template-columns: minmax(0, 1fr) auto auto;
    }

    .command-bar-nav {
        grid-column: auto;
        padding-left: 0;
    }
}

@media (min-width: 1380px) {
    .desktop-command-bar .command-desc {
        display: block;
    }
}

@media (max-width: 860px) {
    .desktop-command-bar {
        display: none !important;
    }
}

`;
