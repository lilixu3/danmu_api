// language=CSS
export const overviewCssContent = /* css */ `/* ========================================
   首页总览模块（内容区块、配置预览、日志查看）
   ======================================== */

/* ========================================
   内容区块样式
   ======================================== */
.content-section {
    display: none;
    animation: fadeInUp 0.4s ease-out;
}

.content-section.active {
    display: block;
}

.section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 2rem;
    padding-bottom: 1.5rem;
    border-bottom: 2px solid var(--border-color);
}

.section-title {
    position: relative;
    font-size: 1.875rem;
    font-weight: 700;
    color: var(--text-primary);
    background: var(--gradient-primary);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    padding-left: 1.25rem;
}

.section-title::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 5px;
    height: 75%;
    background: linear-gradient(180deg, 
        rgba(99, 102, 241, 0.9) 0%, 
        rgba(139, 92, 246, 0.9) 50%,
        rgba(236, 72, 153, 0.9) 100%);
    border-radius: 3px;
    box-shadow: 
        0 0 12px rgba(99, 102, 241, 0.4),
        0 0 24px rgba(139, 92, 246, 0.2);
    animation: titlePulse 3s ease-in-out infinite;
}

[data-theme="dark"] .section-title::before {
    background: linear-gradient(180deg, 
        rgba(129, 140, 248, 1) 0%, 
        rgba(167, 139, 250, 1) 35%,
        rgba(192, 132, 252, 1) 65%,
        rgba(236, 72, 153, 1) 100%);
    box-shadow: 
        0 0 20px rgba(129, 140, 248, 0.8),
        0 0 40px rgba(167, 139, 250, 0.4),
        0 0 60px rgba(192, 132, 252, 0.2);
}

[data-theme="dark"] .section-title::after {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 5px;
    height: 75%;
    background: inherit;
    border-radius: 3px;
    filter: blur(8px);
    opacity: 0.6;
    z-index: -1;
}

@keyframes titlePulse {
    0%, 100% {
        opacity: 1;
        filter: brightness(1);
    }
    50% {
        opacity: 0.8;
        filter: brightness(1.2);
    }
}

.section-desc {
    color: var(--text-secondary);
    font-size: 0.9375rem;
    margin-top: 0.5rem;
    line-height: 1.6;
}

.header-actions {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
}

/* ========================================
   配置预览组件
   ======================================== */
.preview-hero-card {
    background: rgba(255, 255, 255, 1);
    border-radius: var(--radius-xl);
    padding: 2rem;
    margin-bottom: 2rem;
    border: 1px solid var(--border-color);
    box-shadow: none;
}
/* 深色模式预览卡片增强 */
[data-theme="dark"] .preview-hero-card {
    background: rgba(17, 24, 39, 0.8);
    border: 1px solid rgba(99, 102, 241, 0.25);
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.6),
                0 0 60px rgba(99, 102, 241, 0.1),
                inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

[data-theme="dark"] .preview-stat-card {
    background: rgba(17, 24, 39, 0.7);
    border: 1px solid rgba(99, 102, 241, 0.2);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4),
                inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

[data-theme="dark"] .preview-stat-card:hover {
    border-color: rgba(129, 140, 248, 0.4);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5),
                0 0 40px rgba(129, 140, 248, 0.2),
                inset 0 1px 0 rgba(255, 255, 255, 0.08);
    transform: translateY(-6px);
}

[data-theme="dark"] .preview-category {
    background: rgba(17, 24, 39, 0.7);
    border: 1px solid rgba(99, 102, 241, 0.2);
}

[data-theme="dark"] .preview-category:hover {
    border-color: rgba(129, 140, 248, 0.4);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5),
                0 0 40px rgba(99, 102, 241, 0.15);
}

.preview-hero-content {
    display: flex;
    flex-direction: column;
    gap: 2rem;
}

.preview-hero-header {
    display: flex;
    align-items: center;
    gap: 1.5rem;
}

.preview-hero-icon {
    width: 64px;
    height: 64px;
    background: var(--gradient-primary);
    border-radius: var(--radius-lg);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8px 24px rgba(59, 130, 246, 0.3);
}

.preview-hero-icon svg {
    width: 36px;
    height: 36px;
    color: white;
    stroke-width: 2;
}

.preview-hero-titles {
    flex: 1;
}

.preview-hero-title {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
}

.preview-hero-subtitle {
    color: var(--text-secondary);
    font-size: 1rem;
}

.preview-stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1rem;
}

.preview-stat-card {
    background: rgba(248, 250, 252, 1);
    backdrop-filter: none;
    border-radius: var(--radius-lg);
    padding: 1.5rem;
    border: 1px solid var(--border-color);
    transition: all var(--transition-fast);
    display: flex;
    align-items: center;
    gap: 1rem;
}

.preview-stat-card:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-md);
    border-color: var(--primary-color);
}

.stat-card-compact {
    padding: 1.25rem;
}

.stat-icon-wrapper {
    width: 48px;
    height: 48px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.stat-icon-wrapper svg {
    width: 24px;
    height: 24px;
    color: white;
    stroke-width: 2;
}

.stat-icon-primary {
    background: var(--gradient-primary);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.stat-icon-success {
    background: var(--gradient-success);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.stat-icon-warning {
    background: var(--gradient-warning);
    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
}

.stat-icon-deploy {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.stat-icon-status {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    transition: all var(--transition-fast);
}

.stat-icon-status.status-warning {
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
}

.stat-icon-status.status-error {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

.stat-icon-mode {
    background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%);
    box-shadow: 0 4px 12px rgba(236, 72, 153, 0.3);
}

.stat-content {
    flex: 1;
    min-width: 0;
}

.stat-value {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1.2;
    font-family: 'Courier New', monospace;
}

.stat-value-text {
    font-size: 1rem;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.stat-value-status {
    font-size: 0.875rem;
}

.stat-label {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    margin-top: 0.25rem;
    font-weight: 500;
}

.preview-grid {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.preview-category {
    background: var(--bg-primary);
    backdrop-filter: var(--blur-md);
    border-radius: var(--radius-lg);
    padding: 1.5rem;
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-sm);
    transition: all var(--transition-fast);
}

.preview-category:hover {
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
}

.preview-category-header {
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border-color);
}

.preview-category-title {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
}

.category-icon {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.25rem;
    color: white;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.category-badge {
    margin-left: auto;
    padding: 0.25rem 0.75rem;
    background: var(--bg-tertiary);
    backdrop-filter: var(--blur-sm);
    border-radius: var(--radius-sm);
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text-secondary);
}

.preview-items {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.preview-item {
    padding: 1rem;
    background: var(--bg-secondary);
    backdrop-filter: var(--blur-sm);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-color);
    transition: all var(--transition-fast);
}

.preview-item:hover {
    background: var(--bg-tertiary);
    border-color: var(--primary-color);
    transform: translateX(4px);
}

.preview-item-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
    gap: 1rem;
}

.preview-key {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text-primary);
}

.key-icon {
    font-size: 1rem;
}

.preview-type-badge {
    padding: 0.25rem 0.625rem;
    background: var(--primary-color);
    color: white;
    border-radius: var(--radius-sm);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.preview-value-container {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
}

.preview-value {
    flex: 1;
    padding: 0.75rem;
    background: var(--bg-tertiary);
    backdrop-filter: var(--blur-sm);
    border-radius: var(--radius-sm);
    font-family: 'Courier New', monospace;
    font-size: 0.875rem;
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    word-break: break-all;
}

.preview-copy-btn {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    background: var(--bg-primary);
    backdrop-filter: var(--blur-sm);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
}

.preview-copy-btn:hover {
    background: var(--primary-color);
    border-color: var(--primary-color);
    color: white;
    transform: scale(1.1);
}

.preview-copy-btn svg {
    width: 16px;
    height: 16px;
}

.preview-desc {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    font-size: 0.8125rem;
    color: var(--text-tertiary);
    line-height: 1.6;
}

.desc-icon {
    font-size: 1rem;
    flex-shrink: 0;
    margin-top: 2px;
}

.preview-empty,
.preview-error {
    text-align: center;
    padding: 4rem 2rem;
}

.empty-icon,
.error-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
    opacity: 0.5;
}

.preview-empty h3,
.preview-error h3 {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
}

.preview-empty p,
.preview-error p {
    color: var(--text-secondary);
    font-size: 0.9375rem;
}

/* ========================================
   日志查看组件
   ======================================== */
.log-top-actions {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.45rem;
    padding: 0;
    border: none;
    background: transparent;
    box-shadow: none;
}

.log-action-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 34px;
    padding: 0.45rem 0.95rem;
    background: var(--bg-primary);
    color: var(--text-secondary);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    font-size: 0.8125rem;
    font-weight: 600;
    line-height: 1.1;
    box-shadow: none;
}

.log-action-btn:hover:not(:disabled) {
    background: rgba(59, 130, 246, 0.08);
    border-color: rgba(59, 130, 246, 0.36);
    color: var(--primary-color);
}

.log-action-btn.active {
    background: rgba(59, 130, 246, 0.12);
    border-color: rgba(59, 130, 246, 0.42);
    color: var(--primary-color);
}

.log-action-btn.log-action-danger {
    color: #dc2626;
    border-color: rgba(239, 68, 68, 0.3);
    background: rgba(239, 68, 68, 0.06);
}

.log-action-btn.log-action-danger:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.12);
    border-color: rgba(239, 68, 68, 0.46);
    color: #b91c1c;
}

.log-filters {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    align-items: stretch;
    gap: 0.36rem;
    width: 100%;
    margin-bottom: 0.65rem;
    padding: 0.34rem;
    border: 1px solid var(--border-color);
    border-radius: 12px;
    background: var(--bg-secondary);
    box-shadow: none;
}

.log-filter-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.34rem;
    width: 100%;
    min-width: 0;
    height: 31px;
    padding: 0 0.58rem;
    border: 1px solid transparent;
    border-radius: 8px;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
}

.log-filter-btn:hover {
    border-color: rgba(59, 130, 246, 0.3);
    background: rgba(59, 130, 246, 0.06);
    color: var(--primary-color);
}

.log-filter-btn.active {
    border-color: rgba(59, 130, 246, 0.35);
    background: var(--bg-primary);
    color: var(--primary-color);
}

.filter-icon {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #94a3b8;
    flex-shrink: 0;
}

.log-filter-btn[data-filter="error"] .filter-icon {
    background: #ef4444;
}

.log-filter-btn[data-filter="warn"] .filter-icon {
    background: #f59e0b;
}

.log-filter-btn[data-filter="all"] .filter-icon {
    background: #64748b;
}


.filter-text {
    font-size: 0.78125rem;
    font-weight: 600;
    letter-spacing: 0;
}

.filter-badge {
    display: none;
    min-width: 16px;
    height: 16px;
    padding: 0 0.26rem;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: rgba(148, 163, 184, 0.2);
    font-size: 0.65625rem;
    font-weight: 700;
    color: var(--text-secondary);
}

.log-filter-btn.active .filter-badge {
    background: rgba(59, 130, 246, 0.16);
    color: var(--primary-color);
}

.log-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
    padding: 0.45rem 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: 12px;
    background: var(--bg-secondary);
    box-shadow: none;
}

.log-search-group {
    display: flex;
    align-items: center;
    gap: 0.42rem;
    flex: 1;
    min-width: 240px;
    padding: 0.4rem 0.48rem;
    border: 1px solid var(--border-color);
    border-radius: 10px;
    background: var(--bg-primary);
}

.log-search-icon {
    width: 15px;
    height: 15px;
    color: var(--text-tertiary);
    flex-shrink: 0;
}

.log-search-input {
    flex: 1;
    min-width: 100px;
    border: none;
    outline: none;
    background: transparent;
    color: var(--text-primary);
    font-size: 0.8125rem;
}

.log-search-input::placeholder {
    color: var(--text-tertiary);
}

.log-search-clear {
    border: 1px solid transparent;
    border-radius: 7px;
    background: transparent;
    color: var(--primary-color);
    font-size: 0.6875rem;
    font-weight: 600;
    cursor: pointer;
    padding: 0.16rem 0.34rem;
}

.log-search-clear:hover {
    border-color: rgba(59, 130, 246, 0.3);
    background: rgba(59, 130, 246, 0.08);
}

.log-toolbar-actions {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
}

.log-toolbar-status {
    margin-right: 0.2rem;
    font-size: 0.75rem;
    color: var(--text-secondary);
    padding: 0.1rem 0.15rem;
    border: none;
    background: transparent;
}

.log-tool-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 30px;
    padding: 0.3rem 0.62rem;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--bg-primary);
    color: var(--text-secondary);
    font-size: 0.71875rem;
    font-weight: 600;
    line-height: 1.1;
    cursor: pointer;
    transition: all var(--transition-fast);
}

.log-tool-btn:hover {
    border-color: rgba(59, 130, 246, 0.35);
    background: rgba(59, 130, 246, 0.08);
    color: var(--primary-color);
}

.log-tool-btn.active {
    border-color: rgba(59, 130, 246, 0.4);
    background: rgba(59, 130, 246, 0.12);
    color: var(--primary-color);
}

.log-terminal {
    max-height: 620px;
    overflow-y: auto;
    overflow-x: auto;
    padding: 0.72rem 0.85rem;
    border: 1px solid rgba(148, 163, 184, 0.24);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-md);
    background: #0b1220;
    color: #e2e8f0;
    line-height: 1.28;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 0.8125rem;
    font-variant-ligatures: none;
}

.log-terminal.log-wrap-enabled {
    white-space: normal;
}

.log-terminal.log-wrap-enabled .log-line {
    white-space: normal;
    word-break: break-word;
}

.log-terminal.log-wrap-disabled {
    white-space: pre;
}

.log-terminal.log-wrap-disabled .log-line {
    white-space: pre;
}

.log-line {
    display: flex;
    align-items: flex-start;
    gap: 0.34rem;
    padding: 0.01rem 0;
    letter-spacing: 0;
}

.log-line + .log-line {
    margin-top: 0.02rem;
}

.log-line-time {
    color: #94a3b8;
    flex: 0 0 auto;
}

.log-line-level {
    min-width: 2.95em;
    font-weight: 700;
    flex: 0 0 auto;
}

.log-line-text {
    flex: 1;
    min-width: 0;
    color: #e2e8f0;
    line-height: 1.35;
    letter-spacing: 0;
}

.log-terminal.log-wrap-enabled .log-line-text {
    white-space: pre-wrap;
    word-break: break-word;
    overflow-wrap: anywhere;
}

.log-terminal.log-wrap-disabled .log-line-text {
    white-space: pre;
}

.log-line-error .log-line-level,
.log-line-error .log-line-text {
    color: #fca5a5;
}

.log-line-warn .log-line-level,
.log-line-warn .log-line-text {
    color: #fcd34d;
}

.log-line-success .log-line-level,
.log-line-success .log-line-text {
    color: #86efac;
}

.log-line-info .log-line-level {
    color: #93c5fd;
}

.log-highlight {
    padding: 0.03rem 0.16rem;
    border-radius: 4px;
    background: rgba(250, 204, 21, 0.3);
    color: #fef9c3;
}

[data-theme="light"] .log-top-actions,
[data-theme="light"] .log-filters,
[data-theme="light"] .log-toolbar {
    background: #ffffff;
}

[data-theme="light"] .log-top-actions {
    background: transparent;
}

[data-theme="light"] .log-terminal {
    background: #0f172a;
    border-color: rgba(100, 116, 139, 0.34);
}

[data-theme="dark"] .log-top-actions {
    background: transparent;
}

[data-theme="dark"] .log-filters,
[data-theme="dark"] .log-toolbar {
    background: rgba(15, 23, 42, 0.86);
    border-color: rgba(99, 102, 241, 0.2);
}

[data-theme="dark"] .log-action-btn,
[data-theme="dark"] .log-filter-btn,
[data-theme="dark"] .log-tool-btn,
[data-theme="dark"] .log-search-group {
    background: rgba(15, 23, 42, 0.9);
    border-color: rgba(99, 102, 241, 0.24);
}

[data-theme="dark"] .log-filter-btn {
    background: transparent;
}

[data-theme="dark"] .log-action-btn:hover:not(:disabled),
[data-theme="dark"] .log-action-btn.active,
[data-theme="dark"] .log-filter-btn:hover,
[data-theme="dark"] .log-filter-btn.active,
[data-theme="dark"] .log-tool-btn:hover,
[data-theme="dark"] .log-tool-btn.active,
[data-theme="dark"] .log-search-clear:hover {
    border-color: rgba(129, 140, 248, 0.4);
    background: rgba(99, 102, 241, 0.16);
    color: #c7d2fe;
}

[data-theme="dark"] .log-action-btn.log-action-danger {
    border-color: rgba(248, 113, 113, 0.42);
    background: rgba(248, 113, 113, 0.14);
    color: #fca5a5;
}

[data-theme="dark"] .log-action-btn.log-action-danger:hover:not(:disabled) {
    border-color: rgba(252, 165, 165, 0.56);
    background: rgba(248, 113, 113, 0.2);
    color: #fecaca;
}

[data-theme="dark"] .log-toolbar-status {
    color: #cbd5e1;
}

[data-theme="dark"] .log-highlight {
    background: rgba(251, 191, 36, 0.32);
    color: #fef3c7;
}

[data-theme="dark"] .log-empty-state,
[data-theme="dark"] .log-empty-state .empty-icon {
    color: #94a3b8;
}

.log-empty-state {
    text-align: center;
    padding: 4rem 2rem;
    color: var(--text-tertiary);
}

.log-empty-state .empty-icon {
    width: 64px;
    height: 64px;
    margin: 0 auto 1rem;
    color: var(--text-tertiary);
    opacity: 0.5;
}

.log-empty-state .empty-text {
    font-size: 1rem;
    font-weight: 500;
}
`;
