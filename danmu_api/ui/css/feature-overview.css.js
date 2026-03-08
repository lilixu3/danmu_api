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
    flex-wrap: nowrap;
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

.preview-category {
    background: var(--bg-primary);
    backdrop-filter: var(--blur-md);
    border-radius: var(--radius-lg);
    padding: 1.18rem;
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-sm);
    transition: transform var(--transition-fast), border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.preview-category:hover {
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
}

.preview-category-header {
    margin-bottom: 0.9rem;
    padding-bottom: 0.82rem;
    border-bottom: 1px solid var(--border-color);
}

.preview-category-title {
    display: flex;
    align-items: center;
    gap: 0.72rem;
    min-width: 0;
    font-size: 1.06rem;
    font-weight: 700;
    color: var(--text-primary);
}

.category-icon {
    width: 36px;
    height: 36px;
    border-radius: 12px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.82rem;
    font-weight: 800;
    line-height: 1;
    color: white;
    flex-shrink: 0;
}

.category-badge {
    margin-left: auto;
    padding: 0.24rem 0.65rem;
    background: var(--bg-tertiary);
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--text-secondary);
}

.preview-items {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.72rem;
    min-height: 0;
    align-content: start;
    align-items: stretch;
    overflow: auto;
    padding-right: 0.12rem;
}

.preview-item {
    padding: 0.88rem 0.9rem;
    background: var(--bg-secondary);
    backdrop-filter: var(--blur-sm);
    border-radius: 16px;
    border: 1px solid var(--border-color);
    transition: transform var(--transition-fast), border-color var(--transition-fast), background var(--transition-fast), box-shadow var(--transition-fast);
    display: grid;
    grid-template-rows: auto minmax(68px, auto) minmax(38px, auto);
    gap: 0.56rem;
    min-height: 170px;
}

.preview-item:hover {
    background: var(--bg-tertiary);
    border-color: var(--primary-color);
    transform: translateY(-1px);
    box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08);
}

.preview-item-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 0;
    gap: 0.75rem;
}

.preview-key {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
    min-width: 0;
    font-size: 0.92rem;
    font-weight: 700;
    line-height: 1.4;
    color: var(--text-primary);
    word-break: break-word;
}

.key-icon {
    display: none;
}

.preview-type-badge {
    padding: 0.28rem 0.58rem;
    background: rgba(79, 70, 229, 0.08);
    color: #4338ca;
    border: 1px solid rgba(79, 70, 229, 0.12);
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: none;
    letter-spacing: 0.01em;
    flex-shrink: 0;
}

.preview-value-container {
    display: block;
    margin: 0;
}

.preview-value {
    display: -webkit-box;
    width: 100%;
    min-height: 68px;
    max-height: 68px;
    padding: 0.78rem 0.82rem;
    box-sizing: border-box;
    background: var(--bg-tertiary);
    border-radius: 14px;
    font-family: 'Courier New', monospace;
    font-size: 0.82rem;
    line-height: 1.5;
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    overflow: hidden;
    white-space: pre-wrap;
    word-break: break-all;
    overflow-wrap: anywhere;
}

.preview-desc {
    min-height: 2.6em;
    font-size: 0.76rem;
    color: var(--text-tertiary);
    line-height: 1.55;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
}

.preview-desc-empty {
    opacity: 0;
}

.desc-icon {
    display: none;
}

.preview-item-empty {
    border-style: dashed;
}

.preview-item-empty .preview-value {
    color: var(--text-tertiary);
}
.preview-empty,
.preview-error {
    text-align: center;
    padding: 4rem 2rem;
}

.empty-icon,
.error-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 4.5rem;
    height: 4.5rem;
    margin-bottom: 1rem;
    border-radius: 1.5rem;
    background: rgba(var(--primary-rgb), 0.08);
    color: var(--primary-color);
    opacity: 1;
}

.empty-icon svg,
.error-icon svg {
    width: 2rem;
    height: 2rem;
}

.preview-error .error-icon {
    background: rgba(239, 68, 68, 0.12);
    color: #dc2626;
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
    background: rgba(var(--primary-rgb), 0.06);
    border-color: rgba(var(--primary-rgb), 0.22);
    color: var(--primary-color);
}

.log-action-btn.active {
    background: rgba(var(--primary-rgb), 0.1);
    border-color: rgba(var(--primary-rgb), 0.26);
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
    transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);
}

.log-filter-btn:hover {
    border-color: rgba(var(--primary-rgb), 0.2);
    background: rgba(var(--primary-rgb), 0.05);
    color: var(--primary-color);
}

.log-filter-btn.active {
    border-color: rgba(var(--primary-rgb), 0.22);
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
    background: rgba(var(--primary-rgb), 0.12);
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
    border-color: rgba(var(--primary-rgb), 0.22);
    background: rgba(var(--primary-rgb), 0.06);
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
    transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);
}

.log-tool-btn:hover {
    border-color: rgba(var(--primary-rgb), 0.22);
    background: rgba(var(--primary-rgb), 0.06);
    color: var(--primary-color);
}

.log-tool-btn.active {
    border-color: rgba(var(--primary-rgb), 0.26);
    background: rgba(var(--primary-rgb), 0.1);
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


/* ========================================
   2026 首页结构重构
   ======================================== */
.content-section {
    position: relative;
    padding: clamp(1.1rem, 2vw, 1.6rem);
    border-radius: 28px;
    background: rgba(255, 255, 255, 0.82);
    border: 1px solid var(--surface-border-strong);
    box-shadow: var(--surface-shadow-soft);
    overflow: hidden;
}

.content-section::before {
    content: '';
    position: absolute;
    inset: 0 0 auto 0;
    height: 1px;
    background: linear-gradient(90deg, transparent 0%, rgba(148, 163, 184, 0.2) 50%, transparent 100%);
    pointer-events: none;
}

.section-header {
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 1rem;
    margin-bottom: 1.5rem;
    padding-bottom: 1.2rem;
    border-bottom: 1px solid rgba(148, 163, 184, 0.18);
}

.section-title {
    padding-left: 0;
    font-size: clamp(1.6rem, 2.2vw, 2.1rem);
    color: var(--text-primary);
    background: none;
    -webkit-text-fill-color: initial;
}

.section-title::before,
.section-title::after {
    display: none;
}

.section-desc {
    max-width: 60ch;
    margin-top: 0.35rem;
    line-height: 1.75;
}

#proxy-config-container,
.proxy-config-card {
    border-radius: 26px !important;
    border: 1px solid rgba(245, 158, 11, 0.22) !important;
    background: linear-gradient(135deg, rgba(255, 251, 235, 0.95) 0%, rgba(255, 247, 237, 0.98) 100%) !important;
    box-shadow: 0 14px 34px rgba(245, 158, 11, 0.08);
}

.proxy-config-card {
    padding: 1.15rem;
    display: grid;
    gap: 1rem;
}

.proxy-config-header {
    display: flex;
    align-items: flex-start;
    gap: 0.9rem;
}

.proxy-alert-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.75rem;
    height: 2.75rem;
    border-radius: 0.95rem;
    background: rgba(245, 158, 11, 0.14);
    color: #b45309;
    flex-shrink: 0;
}

.proxy-alert-icon svg {
    width: 1.25rem;
    height: 1.25rem;
}

.proxy-alert-title {
    margin: 0 0 0.3rem;
    color: #92400e;
    font-size: 1rem;
    font-weight: 800;
}

.proxy-alert-body {
    margin: 0;
    color: #9a6700;
    font-size: 0.92rem;
    line-height: 1.7;
}

.proxy-config-form {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
}

.proxy-config-form .form-input {
    flex: 1 1 320px;
}

.proxy-config-note {
    margin: 0;
    color: var(--text-secondary);
    font-size: 0.78rem;
    line-height: 1.6;
}

[data-theme="dark"] .proxy-config-card {
    background: linear-gradient(135deg, rgba(56, 36, 10, 0.5) 0%, rgba(35, 23, 8, 0.62) 100%) !important;
    border-color: rgba(245, 158, 11, 0.22) !important;
}

[data-theme="dark"] .proxy-alert-icon {
    background: rgba(245, 158, 11, 0.16);
    color: #fbbf24;
}

[data-theme="dark"] .proxy-alert-title {
    color: #fde68a;
}

[data-theme="dark"] .proxy-alert-body {
    color: #fcd34d;
}


.preview-command-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
    margin-bottom: 1rem;
}

.preview-command-grid-single {
    display: block;
}

.preview-command-grid-single .preview-hero-card {
    margin-bottom: 0;
}

.api-service-hero-refined {
    position: relative;
    overflow: hidden;
    padding: clamp(1.12rem, 2vw, 1.5rem);
    border-radius: 30px;
    border: 1px solid rgba(203, 213, 225, 0.76);
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 14px 24px rgba(15, 23, 42, 0.045);
}

.api-service-hero-refined::before {
    display: none;
}

.preview-hero-content-refined {
    position: relative;
    z-index: 1;
    display: grid;
    gap: 0.95rem;
}

.preview-hero-eyebrow {
    align-self: flex-start;
    margin-bottom: 0.1rem;
    flex-shrink: 0;
}

.hero-overview-topline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.62rem;
    flex-wrap: nowrap;
}

.hero-overview-actions {
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.45rem;
    flex-wrap: nowrap;
    flex-shrink: 0;
    margin-left: auto;
}

.hero-overview-action {
    display: inline-flex;
    align-items: center;
    gap: 0.48rem;
    min-height: 30px;
    padding: 0.3rem 0.58rem;
    border-radius: 999px;
    border: 1px solid rgba(203, 213, 225, 0.72);
    background: rgba(248, 250, 252, 0.92);
    color: var(--text-primary);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.62);
    transition: transform var(--transition-fast), border-color var(--transition-fast), background var(--transition-fast), box-shadow var(--transition-fast);
}

.hero-overview-action:hover {
    transform: translateY(-1px);
    border-color: rgba(79, 70, 229, 0.14);
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 10px 16px rgba(15, 23, 42, 0.05);
}

.hero-overview-action-label {
    font-size: 0.7rem;
    font-weight: 700;
    line-height: 1;
    white-space: nowrap;
}

.hero-overview-status .status-dot {
    width: 8px;
    height: 8px;
    flex-shrink: 0;
}

.hero-overview-action .status-dot::before {
    inset: -3px;
}

.hero-overview-theme .mobile-action-icon {
    width: 14px;
    height: 14px;
}

.hero-overview-theme .theme-icon-moon {
    display: none;
}

.hero-main-row {
    display: grid;
    grid-template-columns: minmax(0, 1.12fr) minmax(360px, 0.9fr);
    gap: 0.95rem;
    align-items: stretch;
}

.hero-brand-block,
.hero-service-panel {
    min-width: 0;
    position: relative;
    border-radius: 24px;
    border: 1px solid rgba(203, 213, 225, 0.66);
    background: rgba(252, 253, 255, 0.92);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.62);
}

.hero-brand-block,
.hero-service-panel {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.08rem 1.12rem;
}

.hero-service-panel {
    justify-content: space-between;
}

.preview-hero-header-refined {
    display: flex;
    align-items: center;
    gap: 0.95rem;
}

.api-service-hero-refined .preview-hero-icon {
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border-radius: 20px;
    border: 1px solid rgba(203, 213, 225, 0.72);
    background: rgba(248, 250, 252, 0.92);
    color: #4f46e5;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.66);
}

.api-service-hero-refined .preview-hero-icon svg {
    width: 30px;
    height: 30px;
    stroke-width: 2.1;
    color: currentColor;
}

.api-service-hero-refined .preview-hero-title {
    margin-bottom: 0.28rem;
    font-size: clamp(1.96rem, 3vw, 2.58rem);
    line-height: 1;
    letter-spacing: -0.04em;
    font-family: Georgia, 'Times New Roman', serif;
}

.api-service-hero-refined .preview-hero-subtitle {
    margin: 0;
    max-width: 52ch;
    font-size: 0.94rem;
    line-height: 1.7;
    color: var(--text-secondary);
}

.hero-status-rail {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
    gap: 0.72rem;
}

.stat-icon-wrapper {
    width: 46px;
    height: 46px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border-radius: 15px;
    border: 1px solid rgba(203, 213, 225, 0.72);
    background: rgba(248, 250, 252, 0.92);
    color: #475569;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.62);
}

.stat-icon-wrapper svg {
    width: 18px;
    height: 18px;
    stroke-width: 2;
}

.stat-icon-status {
    background: rgba(240, 253, 248, 0.96);
    border-color: rgba(16, 185, 129, 0.16);
    color: #047857;
}

.stat-icon-status.status-warning {
    background: rgba(255, 251, 240, 0.96);
    border-color: rgba(245, 158, 11, 0.16);
    color: #b45309;
}

.stat-icon-status.status-error {
    background: rgba(255, 245, 245, 0.96);
    border-color: rgba(239, 68, 68, 0.16);
    color: #b91c1c;
}

.hero-status-panel,
.hero-mode-panel {
    display: flex;
    align-items: center;
    gap: 0.82rem;
    min-width: 0;
    min-height: 96px;
    padding: 0.88rem 0.94rem;
    border-radius: 20px;
    border: 1px solid rgba(203, 213, 225, 0.68);
    background: rgba(255, 255, 255, 0.9);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.62);
}

#system-status-card,
#system-status,
#status-icon-wrapper {
    animation: none !important;
}

#system-status-card.status-running {
    border-color: rgba(16, 185, 129, 0.18);
    background: rgba(255, 255, 255, 0.92);
    box-shadow: inset 3px 0 0 rgba(16, 185, 129, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.62);
}

#system-status-card.status-warning {
    border-color: rgba(245, 158, 11, 0.18);
    background: rgba(255, 255, 255, 0.92);
    box-shadow: inset 3px 0 0 rgba(245, 158, 11, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.62);
}

#system-status-card.status-error {
    border-color: rgba(239, 68, 68, 0.18);
    background: rgba(255, 255, 255, 0.92);
    box-shadow: inset 3px 0 0 rgba(239, 68, 68, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.62);
}

.hero-status-copy {
    min-width: 0;
    flex: 1 1 auto;
    display: grid;
    gap: 0.18rem;
}

.hero-status-label,
.hero-service-kicker,
.hero-metric-label {
    color: var(--text-tertiary);
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

#system-status,
.hero-mode-value {
    margin: 0;
    color: var(--text-primary);
    font-size: 1.08rem;
    line-height: 1.25;
    font-weight: 700;
}

#system-status.status-running {
    color: #047857;
}

#system-status.status-warning {
    color: #b45309;
}

#system-status.status-error {
    color: #b91c1c;
}

.hero-overview-status[data-deploy-ok="1"] {
    border-color: rgba(34, 197, 94, 0.18);
    background: rgba(248, 250, 252, 0.94);
    box-shadow: inset 3px 0 0 rgba(34, 197, 94, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.62);
}

.hero-overview-status[data-deploy-ok="0"] {
    border-color: rgba(239, 68, 68, 0.18);
    background: rgba(248, 250, 252, 0.94);
    box-shadow: inset 3px 0 0 rgba(239, 68, 68, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.62);
}

#status-icon-wrapper,
#mode-icon-wrapper {
    width: 46px;
    height: 46px;
    border-radius: 15px;
    flex-shrink: 0;
}

#status-icon-wrapper svg,
#mode-icon-wrapper svg {
    width: 18px;
    height: 18px;
}

#mode-icon-wrapper.mode-preview {
    background: rgba(241, 245, 249, 0.96);
    border-color: rgba(148, 163, 184, 0.18);
    color: #475569;
}

#mode-icon-wrapper.mode-user {
    background: rgba(238, 242, 255, 0.96);
    border-color: rgba(79, 70, 229, 0.16);
    color: #4338ca;
}

#mode-icon-wrapper.mode-admin {
    background: rgba(255, 245, 245, 0.96);
    border-color: rgba(239, 68, 68, 0.16);
    color: #b91c1c;
}

.hero-service-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.8rem;
}

.hero-service-note {
    color: var(--text-secondary);
    font-size: 0.8rem;
    line-height: 1.5;
}

.hero-service-body {
    display: grid;
    gap: 0.72rem;
    min-height: 0;
}

.hero-endpoint-panel {
    width: 100%;
    display: grid;
    gap: 0.34rem;
    align-content: center;
    min-height: 116px;
    padding: 0.9rem 0.94rem;
    border: 1px solid rgba(203, 213, 225, 0.72);
    border-radius: 22px;
    background: rgba(255, 255, 255, 0.92);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.62);
    text-align: left;
    transition: transform var(--transition-fast), border-color var(--transition-fast), background var(--transition-fast), box-shadow var(--transition-fast);
}

.hero-endpoint-panel:hover {
    transform: translateY(-1px);
    border-color: rgba(79, 70, 229, 0.14);
    box-shadow: 0 10px 18px rgba(15, 23, 42, 0.05);
}

.hero-endpoint-label {
    color: var(--text-tertiary);
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.hero-endpoint-value {
    color: var(--text-primary);
    font-family: 'Courier New', monospace;
    font-size: 0.84rem;
    line-height: 1.55;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
    word-break: break-all;
    overflow-wrap: anywhere;
}

.hero-endpoint-hint {
    color: var(--text-tertiary);
    font-size: 0.7rem;
}

.preview-stats-strip {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.72rem;
    padding: 0;
    background: transparent;
    border: 0;
    box-shadow: none;
}

.service-panel-metrics {
    align-items: stretch;
}

.hero-metric-item {
    position: relative;
    display: grid;
    align-content: start;
    gap: 0.32rem;
    min-height: 98px;
    padding: 0.9rem 0.94rem;
    border-radius: 18px;
    border: 1px solid rgba(203, 213, 225, 0.68);
    background: rgba(255, 255, 255, 0.9);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.62);
}

.hero-metric-main {
    display: flex;
    align-items: baseline;
    gap: 0.34rem;
}

.hero-metric-item .stat-value {
    font-size: clamp(1.52rem, 2.1vw, 1.96rem);
    line-height: 1;
}

.hero-metric-unit,
.hero-metric-meta {
    color: var(--text-secondary);
    font-size: 0.8rem;
}

.hero-metric-item-total {
    background: rgba(255, 255, 255, 0.82);
}

.hero-metric-item-manual {
    background: rgba(255, 255, 255, 0.9);
    border-color: rgba(20, 184, 166, 0.16);
    box-shadow: inset 3px 0 0 rgba(20, 184, 166, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.62);
}

.hero-metric-item-manual .stat-value {
    color: #0f766e;
}

.preview-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
    align-items: stretch;
}

.preview-category,
.preview-item,
.preview-value-container,
.preview-value {
    min-width: 0;
}

.preview-category {
    width: 100%;
    min-height: 386px;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    border-radius: 24px;
    border: 1px solid rgba(203, 213, 225, 0.72);
    background: rgba(255, 255, 255, 0.88);
    box-shadow: 0 12px 24px rgba(15, 23, 42, 0.05);
}

.preview-category-title {
    flex-wrap: nowrap;
}

.preview-item,
.preview-value {
    border-color: rgba(148, 163, 184, 0.14);
}

.preview-item {
    border-radius: 18px;
    background: rgba(248, 250, 252, 0.88);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.58);
}

.preview-value-container {
    display: block;
    align-items: flex-start;
}

.preview-value {
    width: 100%;
    min-height: 68px;
    max-height: 68px;
    box-sizing: border-box;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    background: rgba(255, 255, 255, 0.96);
    border-color: rgba(203, 213, 225, 0.72);
}

[data-theme="dark"] .api-service-hero-refined {
    background: rgba(8, 12, 24, 0.92);
    border-color: rgba(129, 140, 248, 0.18);
    box-shadow: 0 20px 36px rgba(2, 6, 23, 0.26);
}

[data-theme="dark"] .api-service-hero-refined .preview-hero-icon {
    background: rgba(15, 23, 42, 0.84);
    border-color: rgba(129, 140, 248, 0.18);
    color: #aebdff;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

[data-theme="dark"] .hero-overview-action {
    background: rgba(15, 23, 42, 0.78);
    border-color: rgba(129, 140, 248, 0.16);
    box-shadow: none;
}

[data-theme="dark"] .hero-overview-status[data-deploy-ok="1"] {
    border-color: rgba(34, 197, 94, 0.26);
}

[data-theme="dark"] .hero-overview-status[data-deploy-ok="0"] {
    border-color: rgba(239, 68, 68, 0.26);
}

[data-theme="dark"] .hero-overview-theme .theme-icon-sun {
    display: none;
}

[data-theme="dark"] .hero-overview-theme .theme-icon-moon {
    display: block;
}

[data-theme="dark"] .hero-brand-block,
[data-theme="dark"] .hero-service-panel,
[data-theme="dark"] .preview-category,
[data-theme="dark"] .preview-item,
[data-theme="dark"] .preview-value,
[data-theme="dark"] .hero-status-panel,
[data-theme="dark"] .hero-mode-panel,
[data-theme="dark"] .hero-endpoint-panel {
    background: rgba(15, 23, 42, 0.76);
    border-color: rgba(129, 140, 248, 0.16);
    box-shadow: 0 14px 28px rgba(2, 6, 23, 0.2);
}

[data-theme="dark"] #system-status-card.status-running {
    background: rgba(15, 23, 42, 0.78);
    border-color: rgba(34, 197, 94, 0.24);
}

[data-theme="dark"] #system-status-card.status-warning {
    background: rgba(15, 23, 42, 0.78);
    border-color: rgba(245, 158, 11, 0.24);
}

[data-theme="dark"] #system-status-card.status-error {
    background: rgba(15, 23, 42, 0.78);
    border-color: rgba(239, 68, 68, 0.24);
}

[data-theme="dark"] #system-status.status-running {
    color: #6ee7b7;
}

[data-theme="dark"] #system-status.status-warning {
    color: #fbbf24;
}

[data-theme="dark"] #system-status.status-error {
    color: #fca5a5;
}

[data-theme="dark"] .preview-type-badge {
    background: rgba(129, 140, 248, 0.16);
    color: #c7d2fe;
    border-color: rgba(129, 140, 248, 0.24);
}

[data-theme="dark"] .preview-item-empty {
    border-color: rgba(148, 163, 184, 0.22);
}

[data-theme="dark"] .hero-metric-item {
    background: rgba(15, 23, 42, 0.78);
    border-color: rgba(129, 140, 248, 0.16);
    box-shadow: 0 14px 28px rgba(2, 6, 23, 0.18);
}

[data-theme="dark"] .hero-metric-item-manual {
    background: rgba(15, 23, 42, 0.78);
    border-color: rgba(45, 212, 191, 0.2);
}

[data-theme="dark"] .hero-metric-item-manual .stat-value {
    color: #5eead4;
}

[data-theme="dark"] .empty-icon {
    background: rgba(129, 140, 248, 0.12);
    color: #c7d2fe;
}

[data-theme="dark"] .preview-error .error-icon {
    background: rgba(251, 113, 133, 0.14);
    color: #fecdd3;
}

[data-theme="dark"] .hero-metric-item + .hero-metric-item {
    border-left-color: rgba(129, 140, 248, 0.14);
}

[data-theme="dark"] .hero-service-note,
[data-theme="dark"] .hero-metric-unit,
[data-theme="dark"] .hero-metric-meta {
    color: rgba(226, 232, 240, 0.68);
}
`;
