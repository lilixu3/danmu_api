// language=CSS
export const apiFeatureCssContent = /* css */ `/* ========================================
   接口调试与弹幕模块（API 调试、推送、测试与列表）
   ======================================== */

/* ========================================
   API测试组件
   ======================================== */
.api-test-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.api-info-card {
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(139, 92, 246, 0.1));
    backdrop-filter: var(--blur-sm);
    border-radius: var(--radius-lg);
    padding: 1.5rem;
    border: 1px solid rgba(59, 130, 246, 0.3);
    margin-bottom: 1.5rem;
}

.api-info-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
}

.api-icon {
    font-size: 2rem;
}

.api-info-content {
    flex: 1;
}

.api-name {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
}

.api-description {
    font-size: 0.9375rem;
    color: var(--text-secondary);
    line-height: 1.6;
}

.api-info-details {
    display: flex;
    gap: 2rem;
    flex-wrap: wrap;
}

.api-detail-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.detail-label {
    font-size: 0.875rem;
    color: var(--text-tertiary);
    font-weight: 500;
}

.method-badge {
    padding: 0.375rem 0.875rem;
    border-radius: var(--radius-sm);
    font-size: 0.8125rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.method-get {
    background: var(--gradient-success);
    color: white;
}

.method-post {
    background: var(--gradient-primary);
    color: white;
}

.api-path {
    padding: 0.375rem 0.875rem;
    background: var(--bg-tertiary);
    backdrop-filter: var(--blur-sm);
    border-radius: var(--radius-sm);
    font-family: 'Courier New', monospace;
    font-size: 0.875rem;
    color: var(--text-primary);
    border: 1px solid var(--border-color);
}

.no-params-message {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 2rem;
    background: var(--bg-secondary);
    backdrop-filter: var(--blur-sm);
    border-radius: var(--radius-md);
    border: 2px dashed var(--border-color);
    color: var(--text-secondary);
}

.message-icon {
    font-size: 1.5rem;
}

.param-icon {
    font-size: 1rem;
}

.form-help .help-icon {
    color: var(--primary-color);
}

/* ========================================
   推送弹幕组件
   ======================================== */
.push-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.push-presets-section,
.lan-scan-section {
    margin-top: 1rem;
    padding: 1rem;
    background: var(--bg-tertiary);
    backdrop-filter: var(--blur-sm);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-color);
}

.presets-header,
.lan-scan-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary);
}

.presets-header svg,
.lan-scan-header svg {
    color: var(--primary-color);
}

.presets-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 0.75rem;
}

.preset-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem;
    white-space: nowrap;
}

.preset-btn svg {
    flex-shrink: 0;
}

.lan-scan-controls {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.lan-input-group {
    display: flex;
    gap: 0.5rem;
    align-items: center;
}

.lan-subnet-input {
    flex: 1;
    min-width: 0;
}

.lan-input-separator {
    color: var(--text-tertiary);
    font-weight: 600;
    font-size: 1.25rem;
}

.lan-port-input {
    width: 100px;
}

.lan-scan-btn {
    white-space: nowrap;
}

.scan-btn-text {
    display: inline;
}

.lan-scan-progress {
    padding: 1.5rem;
    text-align: center;
}

.scan-progress-bar {
    width: 100%;
    height: 8px;
    background: var(--bg-tertiary);
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 1rem;
}

.scan-progress-fill {
    height: 100%;
    background: var(--gradient-primary);
    border-radius: 4px;
    transition: width 0.3s ease;
    width: 0;
}

.scan-progress-text {
    font-size: 0.875rem;
    color: var(--text-secondary);
}

.lan-devices-list {
    margin-top: 1rem;
}

.lan-devices-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
}

.devices-count {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary);
}

.lan-devices-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 0.75rem;
}

.lan-device-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: var(--bg-primary);
    backdrop-filter: var(--blur-sm);
    border: 2px solid var(--border-color);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition-fast);
}

.lan-device-card:hover {
    background: var(--bg-secondary);
    border-color: var(--primary-color);
    transform: translateY(-2px);
    box-shadow: var(--shadow-sm);
}

.device-icon {
    font-size: 1.5rem;
    flex-shrink: 0;
}

.device-info {
    flex: 1;
    min-width: 0;
}

.device-ip {
    font-family: 'Courier New', monospace;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
}

.device-type {
    font-size: 0.75rem;
    color: var(--text-secondary);
}

.device-select-icon {
    flex-shrink: 0;
    color: var(--text-tertiary);
}

.lan-scan-empty {
    text-align: center;
    padding: 2rem;
}

.lan-scan-empty .empty-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
    opacity: 0.5;
}

.lan-scan-empty p {
    color: var(--text-primary);
    font-weight: 500;
    margin-bottom: 0.5rem;
}

.empty-hint {
    font-size: 0.8125rem;
    color: var(--text-tertiary);
}

/* 深色模式 - 推送弹幕卡片增强（快速预设 / 局域网扫描） */
[data-theme="dark"] .push-presets-section,
[data-theme="dark"] .lan-scan-section {
    background: linear-gradient(135deg, rgba(17, 24, 39, 0.75), rgba(31, 41, 55, 0.55));
    border: 1px solid rgba(129, 140, 248, 0.18);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35),
                0 0 0 1px rgba(129, 140, 248, 0.06) inset;
}

[data-theme="dark"] .preset-btn.btn-secondary {
    background: rgba(10, 15, 30, 0.55);
    border-color: rgba(129, 140, 248, 0.22);
}

[data-theme="dark"] .preset-btn.btn-secondary:hover:not(:disabled) {
    background: rgba(17, 24, 39, 0.75);
    border-color: rgba(129, 140, 248, 0.45);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45),
                0 0 30px rgba(129, 140, 248, 0.12);
}

[data-theme="dark"] .scan-progress-bar {
    background: rgba(10, 15, 30, 0.55);
    border: 1px solid rgba(129, 140, 248, 0.12);
}

[data-theme="dark"] .lan-device-card {
    background: rgba(10, 15, 30, 0.65);
    border-color: rgba(129, 140, 248, 0.18);
}

[data-theme="dark"] .lan-device-card:hover {
    background: rgba(17, 24, 39, 0.85);
    border-color: rgba(129, 140, 248, 0.55);
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.55),
                0 0 40px rgba(129, 140, 248, 0.12);
}

[data-theme="dark"] .device-select-icon {
    color: rgba(226, 232, 240, 0.55);
}

.search-results-header {
    margin-bottom: 1.5rem;
}

.results-title {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
}

.title-icon {
    font-size: 1.5rem;
}

.results-count {
    padding: 0.25rem 0.75rem;
    background: var(--primary-color);
    color: white;
    border-radius: var(--radius-sm);
    font-size: 0.875rem;
    font-weight: 600;
}

.results-hint {
    margin-top: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
}

.anime-grid,
.anime-grid-container {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 1.5rem;
}

.anime-card {
    background: var(--bg-primary);
    backdrop-filter: var(--blur-md);
    border-radius: var(--radius-lg);
    overflow: hidden;
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
}

.anime-card:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-md);
    border-color: var(--primary-color);
}

.anime-card-image-wrapper {
    position: relative;
    width: 100%;
    padding-top: 133.33%;
    overflow: hidden;
    background: var(--bg-tertiary);
}

.anime-image {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.anime-card-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    opacity: 0;
    transition: opacity var(--transition-fast);
}

.anime-card:hover .anime-card-overlay {
    opacity: 1;
}

.view-icon {
    font-size: 2rem;
}

.view-text {
    font-weight: 600;
    color: white;
    font-size: 0.9375rem;
}

.anime-info {
    padding: 1rem;
}

.anime-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    line-height: 1.4;
}

.anime-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.episode-count {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.8125rem;
    color: var(--text-secondary);
}

.meta-icon {
    font-size: 1rem;
}

.episode-grid {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-top: 2rem;
}

.episode-list-header {
    background: var(--bg-primary);
    backdrop-filter: var(--blur-md);
    border-radius: var(--radius-lg);
    padding: 1.5rem;
    border: 1px solid var(--border-color);
    margin-bottom: 1rem;
}

.episode-anime-title {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 1rem;
}

.episode-anime-icon {
    font-size: 1.75rem;
}

.episode-stats {
    display: flex;
    gap: 1.5rem;
    flex-wrap: wrap;
}

.episode-stat-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--bg-secondary);
    backdrop-filter: var(--blur-sm);
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    color: var(--text-secondary);
}

.episode-stat-icon {
    font-size: 1.125rem;
}

.episode-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.25rem;
    background: var(--bg-primary);
    backdrop-filter: var(--blur-md);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-sm);
    transition: all var(--transition-fast);
}

.episode-item:hover {
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
    border-color: var(--primary-color);
}

.episode-info {
    flex: 1;
    min-width: 0;
    position: relative;
}

.episode-number {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    font-size: 1rem;
    color: var(--text-primary);
    margin-bottom: 0.375rem;
}

.episode-icon {
    font-size: 1.125rem;
    color: var(--primary-color);
}

.episode-title {
    font-size: 0.875rem;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.episode-push-btn {
    flex-shrink: 0;
}

.episode-push-btn.pushed {
    background: var(--success-color) !important;
    border-color: var(--success-color) !important;
    cursor: not-allowed;
}

.push-success-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.625rem;
    background: rgba(16, 185, 129, 0.1);
    color: var(--success-color);
    border-radius: var(--radius-sm);
    font-size: 0.75rem;
    font-weight: 600;
    margin-top: 0.5rem;
    border: 1px solid var(--success-color);
}

.search-empty,
.search-error {
    text-align: center;
    padding: 3rem 2rem;
    background: var(--bg-primary);
    backdrop-filter: var(--blur-md);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border-color);
}

.search-empty .empty-icon,
.search-error .error-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
    opacity: 0.5;
}

.search-empty h3,
.search-error h3 {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
}

.search-empty p,
.search-error p {
    color: var(--text-secondary);
    font-size: 0.9375rem;
    margin-bottom: 1rem;
}

.loading-state {
    text-align: center;
    padding: 3rem 2rem;
    background: var(--bg-primary);
    backdrop-filter: var(--blur-md);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border-color);
}

/* ========================================
   动漫搜索结果 - 移动端适配
   ======================================== */
@media (max-width: 767px) {
    .anime-grid,
    .anime-grid-container {
        grid-template-columns: repeat(3, 1fr) !important;
        gap: 0.75rem;
    }

    .anime-card {
        border-radius: var(--radius-md);
    }

    .anime-card-image-wrapper {
        padding-top: 140%;
    }

    .anime-info {
        padding: 0.5rem;
    }

    .anime-title {
        font-size: 0.75rem;
        margin-bottom: 0.25rem;
        /* 移动端：标题允许自动换行，避免省略号截断 */
        overflow: visible;
        text-overflow: clip;
        display: block;
        -webkit-line-clamp: unset;
        -webkit-box-orient: unset;
        white-space: normal;
        word-break: break-word;
        overflow-wrap: anywhere;
    }

    .anime-meta {
        gap: 0.25rem;
    }

    .episode-count {
        font-size: 0.6875rem;
    }

    .meta-icon {
        font-size: 0.75rem;
    }

    /* 搜索结果标题优化 */
    .search-results-header {
        margin-bottom: 1rem;
    }

    .results-title {
        font-size: 1rem;
        gap: 0.5rem;
    }

    .title-icon {
        font-size: 1.25rem;
    }

    .results-count {
        font-size: 0.75rem;
        padding: 0.125rem 0.5rem;
    }

    .results-hint {
        font-size: 0.75rem;
    }
}

@media (max-width: 479px) {
    .anime-grid,
    .anime-grid-container {
        grid-template-columns: repeat(3, 1fr) !important;
        gap: 0.5rem;
    }

    .anime-info {
        padding: 0.375rem;
    }

    .anime-title {
        font-size: 0.6875rem;
    }

    .episode-count {
        font-size: 0.625rem;
    }

    .meta-icon {
        display: none;
    }
}

/* ========================================
   API 模式切换标签
   ======================================== */
.api-mode-tabs {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
}

.api-mode-tab {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: var(--bg-secondary);
    backdrop-filter: var(--blur-sm);
    border: 2px solid var(--border-color);
    border-radius: var(--radius-lg);
    color: var(--text-secondary);
    font-weight: 600;
    font-size: 0.9375rem;
    cursor: pointer;
    transition: all var(--transition-fast);
}

.api-mode-tab:hover {
    background: var(--bg-tertiary);
    border-color: var(--primary-color);
    color: var(--text-primary);
    transform: translateY(-2px);
    box-shadow: var(--shadow-sm);
}

.api-mode-tab.active {
    background: var(--gradient-primary);
    border-color: var(--primary-color);
    color: white;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.api-mode-tab .btn-icon {
    width: 18px;
    height: 18px;
}

/* ========================================
   弹幕测试容器
   ======================================== */
.danmu-test-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

/* ========================================
   弹幕测试方式切换（避免两个输入框同时出现）
   ======================================== */
.danmu-method-switcher {
    border: 2px solid var(--border-color);
}

.danmu-method-switcher-header {
    margin-bottom: 1rem;
}

.danmu-method-tabs {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-bottom: 1rem;
}

.danmu-method-tab {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    background: var(--bg-secondary);
    border: 2px solid var(--border-color);
    border-radius: var(--radius-lg);
    color: var(--text-secondary);
    font-weight: 700;
    font-size: 0.9375rem;
    cursor: pointer;
    transition: all var(--transition-fast);
}

.danmu-method-tab:hover {
    background: var(--bg-tertiary);
    border-color: var(--primary-color);
    color: var(--text-primary);
    transform: translateY(-2px);
    box-shadow: var(--shadow-sm);
}

.danmu-method-tab.active {
    background: var(--gradient-primary);
    border-color: var(--primary-color);
    color: #fff;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
}

.danmu-method-tab .tab-icon {
    font-size: 1.1rem;
    line-height: 1;
}

.danmu-method-empty {
    padding: 1.25rem;
    border: 1px dashed var(--border-color);
    border-radius: var(--radius-lg);
    background: var(--bg-secondary);
    text-align: center;
}

.danmu-method-empty .empty-icon {
    font-size: 2rem;
    margin-bottom: 0.5rem;
}

.danmu-method-empty .empty-title {
    font-weight: 800;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
}

.danmu-method-empty .empty-desc {
    font-size: 0.875rem;
    color: var(--text-secondary);
}

.danmu-method-panel {
    margin-top: 0.75rem;
}

.danmu-test-methods {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 1.5rem;
}

.danmu-method-card {
    border: 2px solid var(--border-color);
    transition: all var(--transition-fast);
}

.danmu-method-card:hover {
    border-color: var(--primary-color);
    transform: translateY(-4px);
    box-shadow: var(--shadow-lg);
}

.method-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border-color);
}

.method-icon-wrapper {
    width: 56px;
    height: 56px;
    border-radius: var(--radius-lg);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    flex-shrink: 0;
}

.method-icon-wrapper svg {
    width: 28px;
    height: 28px;
    color: white;
}

.method-info {
    flex: 1;
}

.method-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
}

.method-desc {
    font-size: 0.875rem;
    color: var(--text-secondary);
}

/* ========================================
   弹幕信息卡片
   ======================================== */
.danmu-info-card {
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.05), rgba(139, 92, 246, 0.05));
    border: 1px solid rgba(59, 130, 246, 0.2);
}

.danmu-info-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
}

.danmu-title-section {
    flex: 1;
    min-width: 200px;
}

.danmu-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
}

.danmu-subtitle {
    font-size: 0.875rem;
    color: var(--text-secondary);
}

.danmu-actions {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
}

.danmu-actions .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none !important;
    box-shadow: none !important;
}

.danmu-stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 1rem;
}

.danmu-stat-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background: var(--bg-primary);
    backdrop-filter: var(--blur-sm);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-color);
    transition: all var(--transition-fast);
}

.danmu-stat-item:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-sm);
}

.danmu-stat-item .stat-icon {
    font-size: 1.75rem;
    flex-shrink: 0;
}

.danmu-stat-item .stat-content {
    flex: 1;
    min-width: 0;
}

.danmu-stat-item .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1.2;
}

.danmu-stat-item .stat-label {
    font-size: 0.75rem;
    color: var(--text-secondary);
    margin-top: 0.25rem;
}

/* ========================================
   弹幕热力图
   ======================================== */
.danmu-heatmap-card {
    position: relative;
    border: 1px solid rgba(139, 92, 246, 0.2);
}

.heatmap-legend {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
    padding: 0.75rem;
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
}

.legend-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-secondary);
}

.legend-gradient {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
}

.legend-low,
.legend-high {
    font-size: 0.75rem;
    color: var(--text-tertiary);
}

.legend-bar {
    flex: 1;
    height: 20px;
    border-radius: var(--radius-sm);
    background: linear-gradient(to right, 
        rgba(59, 130, 246, 0.2), 
        rgba(139, 92, 246, 0.4), 
        rgba(236, 72, 153, 0.6),
        rgba(239, 68, 68, 0.8));
    border: 1px solid var(--border-color);
}

#danmu-heatmap-canvas {
    width: 100%;
    height: 150px;
    border-radius: var(--radius-md);
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    cursor: pointer;
}

.heatmap-node-info {
    margin-top: 0.75rem;
    padding: 0.75rem 1rem;
    background: var(--bg-secondary);
    border: 1px dashed var(--border-color);
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    color: var(--text-secondary);
    line-height: 1.4;
}

.heatmap-node-info strong {
    color: var(--text-primary);
    font-weight: 700;
}

.heatmap-tooltip {
    position: absolute;
    z-index: 10;
    pointer-events: none;
    display: none;
    max-width: 260px;
    padding: 0.5rem 0.75rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-md);
    font-size: 0.75rem;
    color: var(--text-secondary);
    backdrop-filter: var(--blur-md);
}

.heatmap-tooltip.visible {
    display: block;
}

/* ========================================
   弹幕列表
   ======================================== */
.danmu-list-card {
    border: 1px solid rgba(16, 185, 129, 0.2);
}

.danmu-list-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
}

.danmu-list-filters {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.danmu-filter-btn {
    padding: 0.5rem 1rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
}

.danmu-filter-btn:hover {
    background: var(--bg-tertiary);
    border-color: var(--primary-color);
    color: var(--text-primary);
}

.danmu-filter-btn.active {
    background: var(--primary-color);
    border-color: var(--primary-color);
    color: white;
}

.danmu-list-container {
    max-height: 500px;
    overflow-y: auto;
    border-radius: var(--radius-md);
    background: var(--bg-secondary);
    padding: 1rem;
}

.danmu-list-empty {
    text-align: center;
    padding: 3rem;
    color: var(--text-tertiary);
}

.danmu-list-empty .empty-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
    display: block;
}

.danmu-item {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 0.875rem;
    margin-bottom: 0.5rem;
    background: var(--bg-primary);
    border-radius: var(--radius-md);
    border-left: 3px solid var(--primary-color);
    transition: all var(--transition-fast);
    animation: fadeInUp 0.3s ease-out backwards;
}

.danmu-item:hover {
    background: var(--bg-tertiary);
    transform: translateX(4px);
    box-shadow: var(--shadow-sm);
}

.danmu-item-time {
    font-family: 'Courier New', monospace;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--primary-color);
    min-width: 60px;
    padding: 0.25rem 0.625rem;
    background: rgba(59, 130, 246, 0.1);
    border-radius: var(--radius-sm);
    text-align: center;
}

.danmu-item-content {
    flex: 1;
    min-width: 0;
}

.danmu-item-text {
    color: var(--text-primary);
    font-size: 0.9375rem;
    line-height: 1.6;
    word-break: break-word;
}

.danmu-item-meta {
    display: flex;
    gap: 0.75rem;
    margin-top: 0.5rem;
    font-size: 0.75rem;
    color: var(--text-tertiary);
}

.danmu-item-type {
    padding: 0.125rem 0.5rem;
    background: var(--bg-tertiary);
    border-radius: var(--radius-sm);
    font-weight: 600;
}

.danmu-item.type-top {
    border-left-color: var(--success-color);
}

.danmu-item.type-top .danmu-item-type {
    background: rgba(16, 185, 129, 0.1);
    color: var(--success-color);
}

.danmu-item.type-bottom {
    border-left-color: var(--warning-color);
}

.danmu-item.type-bottom .danmu-item-type {
    background: rgba(245, 158, 11, 0.1);
    color: var(--warning-color);
}

/* ========================================
   弹幕分页优化 - 加载更多样式
   ======================================== */
.load-more-btn {
    padding: 1rem;
    text-align: center;
}

.load-more-btn .btn {
    width: 100%;
    max-width: 300px;
}

.danmu-list-end {
    padding: 1.5rem;
    text-align: center;
    color: var(--text-tertiary);
    font-size: 0.875rem;
}
`;
