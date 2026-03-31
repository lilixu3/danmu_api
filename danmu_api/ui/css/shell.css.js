// language=CSS
export const shellCssContent = /* css */ `/* ========================================
   应用壳层（侧边栏、导航、版本信息、主题按钮）
   ======================================== */

/* ========================================
   侧边栏
   ======================================== */
.sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    width: 280px;
    background: var(--bg-primary);
    backdrop-filter: var(--blur-md);
    border-right: 1px solid var(--border-color);
    overflow-y: auto;
    transition: transform var(--transition-base);
    z-index: 1000;
    box-shadow: var(--shadow-md);
}
/* 深色模式侧边栏增强 */
[data-theme="dark"] .sidebar {
    background: rgba(10, 15, 30, 0.95);
    border-right: 1px solid rgba(99, 102, 241, 0.2);
    box-shadow: 4px 0 24px rgba(0, 0, 0, 0.5), 
                0 0 40px rgba(99, 102, 241, 0.1);
}

[data-theme="dark"] .sidebar::before {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    width: 1px;
    height: 100%;
    background: linear-gradient(
        to bottom,
        transparent,
        rgba(129, 140, 248, 0.5) 20%,
        rgba(167, 139, 250, 0.5) 50%,
        rgba(192, 132, 252, 0.5) 80%,
        transparent
    );
    opacity: 0.6;
}

.sidebar-header {
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.logo-wrapper {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.logo-image {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-sm);
    object-fit: cover;
}

.logo-text {
    font-size: 1.25rem;
    font-weight: 700;
    background: var(--gradient-primary);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

.sidebar-toggle {
    display: none;
    width: 32px;
    height: 32px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
}

.toggle-icon {
    display: block;
    width: 20px;
    height: 2px;
    background: var(--text-primary);
    position: relative;
    transition: background var(--transition-fast);
}

.toggle-icon::before,
.toggle-icon::after {
    content: '';
    position: absolute;
    width: 20px;
    height: 2px;
    background: var(--text-primary);
    transition: transform var(--transition-base);
}

.toggle-icon::before {
    top: -6px;
}

.toggle-icon::after {
    bottom: -6px;
}

/* ========================================
   导航菜单
   ======================================== */
.nav-menu {
    padding: 1rem;
}

.nav-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    margin-bottom: 0.5rem;
    color: var(--text-secondary);
    text-decoration: none;
    border-radius: var(--radius-md);
    transition: all var(--transition-fast);
    position: relative;
    overflow: hidden;
}

.nav-item::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: var(--primary-color);
    transform: translateX(-100%);
    transition: transform var(--transition-fast);
}

.nav-item:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    transform: translateX(4px);
}

.nav-item.active {
    background: var(--bg-tertiary);
    color: var(--primary-color);
}

.nav-item.active::before {
    transform: translateX(0);
}

.nav-icon {
    width: 20px;
    height: 20px;
    stroke-width: 2;
}

.nav-text {
    font-weight: 500;
    font-size: 0.9375rem;
}

/* ========================================
   版本卡片
   ======================================== */
.version-card {
    margin: 1rem;
    background: var(--bg-secondary);
    backdrop-filter: var(--blur-sm);
    border-radius: var(--radius-lg);
    padding: 1rem;
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-sm);
}

.version-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
}

.version-icon,
.update-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.version-icon {
    width: 2rem;
    height: 2rem;
    border-radius: 0.75rem;
    background: rgba(var(--primary-rgb), 0.08);
    color: var(--primary-color);
}

.version-icon svg,
.update-icon svg {
    width: 1.05rem;
    height: 1.05rem;
}

.version-title {
    font-weight: 600;
    color: var(--text-primary);
    font-size: 0.9375rem;
}

.version-content {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.version-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.875rem;
}

.version-label {
    color: var(--text-secondary);
}

.version-value {
    font-weight: 600;
    color: var(--text-primary);
    font-family: 'Courier New', monospace;
}

.version-latest {
    color: var(--success-color);
}

.version-update-notice {
    display: none;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: rgba(79, 70, 229, 0.08);
    border-radius: var(--radius-md);
    border: 1px solid rgba(79, 70, 229, 0.16);
    margin-top: 0.5rem;
}

.update-icon {
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 0.875rem;
    background: rgba(34, 197, 94, 0.12);
    color: #15803d;
}

[data-theme="dark"] .version-icon {
    background: rgba(129, 140, 248, 0.14);
    color: #c7d2fe;
}

[data-theme="dark"] .update-icon {
    background: rgba(52, 211, 153, 0.14);
    color: #86efac;
}

.update-text {
    flex: 1;
}

.update-title {
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
}

.update-desc {
    font-size: 0.75rem;
    color: var(--text-secondary);
}

.update-btn {
    padding: 0.375rem 0.75rem;
    background: var(--primary-color);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
}

.update-btn:hover {
    background: var(--primary-hover);
    transform: translateY(-1px);
}

/* ========================================
   API端点卡片
   ======================================== */
.api-endpoint-card {
    margin-top: 1rem;
    padding: 0.75rem;
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition-fast);
    border: 1px solid transparent;
}

.api-endpoint-card:hover {
    background: var(--bg-secondary);
    border-color: var(--primary-color);
    transform: translateY(-2px);
    box-shadow: var(--shadow-sm);
}

.endpoint-label {
    display: block;
    font-size: 0.75rem;
    color: var(--text-tertiary);
    margin-bottom: 0.375rem;
}

.endpoint-value {
    font-family: 'Courier New', monospace;
    font-size: 0.8125rem;
    color: var(--text-primary);
    word-break: break-all;
    font-weight: 500;
}

.copy-hint {
    display: block;
    font-size: 0.6875rem;
    color: var(--text-tertiary);
    margin-top: 0.375rem;
    text-align: center;
}

/* ========================================
   主题切换按钮
   ======================================== */
.theme-toggle {
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    width: 56px;
    height: 56px;
    background: var(--bg-primary);
    backdrop-filter: var(--blur-md);
    border: 1px solid var(--border-color);
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: var(--shadow-lg);
    transition: all var(--transition-fast);
    z-index: 999;
}

.theme-toggle:hover {
    transform: scale(1.04) rotate(8deg);
    box-shadow: 0 10px 18px rgba(var(--primary-rgb), 0.18);
}

.theme-icon {
    width: 24px;
    height: 24px;
    color: var(--text-primary);
    transition: all var(--transition-fast);
}

.theme-icon-sun {
    display: block;
}

.theme-icon-moon {
    display: none;
}

[data-theme="dark"] .theme-icon-sun {
    display: none;
}

[data-theme="dark"] .theme-icon-moon {
    display: block;
}


/* ========================================
   2026 控制台壳层重构
   ======================================== */
.mobile-header {
    display: none;
}

.sidebar {
    position: sticky;
    top: 20px;
    width: clamp(286px, 22vw, var(--shell-width));
    min-width: clamp(286px, 22vw, var(--shell-width));
    max-height: calc(100vh - 40px);
    min-height: calc(100vh - 40px);
    border-radius: 30px;
    overflow: hidden;
    border: 1px solid rgba(148, 163, 184, 0.16);
    background: rgba(255, 255, 255, 0.88);
    box-shadow: var(--surface-shadow-strong);
    backdrop-filter: blur(18px);
}

.sidebar::before {
    content: '';
    position: absolute;
    inset: 0;
    background: none;
    pointer-events: none;
}

.sidebar-header {
    position: relative;
    padding: 1.5rem 1.5rem 1.25rem;
    border-bottom: 1px solid rgba(148, 163, 184, 0.14);
}

.brand-panel {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    min-width: 0;
}

.brand-kicker,
.nav-group-label,
.command-kicker,
.preview-hero-eyebrow,
.side-card-kicker,
.sidebar-footer-kicker {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    width: fit-content;
    padding: 0.35rem 0.72rem;
    border-radius: 999px;
    background: rgba(148, 163, 184, 0.12);
    color: #475569;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
}

.logo-wrapper {
    align-items: flex-start;
    gap: 0.95rem;
}

.logo-image {
    width: 56px;
    height: 56px;
    border-radius: 18px;
    box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
}

.brand-copy-group {
    min-width: 0;
}

.logo-text {
    font-size: 1.68rem;
    line-height: 1.05;
    color: var(--text-primary);
    background: none;
    -webkit-text-fill-color: initial;
}

.brand-description {
    margin-top: 0.4rem;
    color: var(--text-secondary);
    font-size: 0.92rem;
    line-height: 1.6;
}

.sidebar-toggle {
    position: absolute;
    top: 1.4rem;
    right: 1.4rem;
}

.sidebar-brief,
.sidebar-footer-card,
.version-card-inline,
.api-endpoint-card-inline,
.desktop-command-bar,
.desktop-status-pill {
    backdrop-filter: blur(18px);
}

.sidebar-brief {
    margin: 1rem 1.25rem 1.15rem;
    padding: 1rem;
    border-radius: 24px;
    border: 1px solid rgba(148, 163, 184, 0.16);
    background: rgba(255, 255, 255, 0.82);
    box-shadow: 0 16px 32px rgba(15, 23, 42, 0.05);
}

.sidebar-brief-head,
.sidebar-brief-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
}

.sidebar-brief-head {
    margin-bottom: 0.75rem;
}

.sidebar-brief-label,
.sidebar-brief-chip {
    font-size: 0.76rem;
    font-weight: 700;
}

.sidebar-brief-label {
    color: var(--text-secondary);
}

.sidebar-brief-chip {
    padding: 0.28rem 0.6rem;
    border-radius: 999px;
    background: rgba(15, 23, 42, 0.06);
    color: var(--text-primary);
}

.sidebar-brief-title {
    color: var(--text-primary);
    font-size: 1rem;
    line-height: 1.7;
    margin-bottom: 0.95rem;
}

.sidebar-brief-actions {
    justify-content: flex-start;
    flex-wrap: wrap;
}

.brief-action,
.command-chip {
    border: 1px solid transparent;
    cursor: pointer;
    transition: transform var(--transition-fast), background var(--transition-fast), border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.brief-action {
    padding: 0.72rem 0.95rem;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.88);
    color: var(--text-primary);
    font-weight: 600;
}

.brief-action:hover {
    transform: translateY(-2px);
    border-color: rgba(99, 102, 241, 0.24);
}

.nav-menu {
    padding: 0 1rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
}

.nav-group-label {
    margin: 0.25rem 0 0.35rem;
}

.nav-item {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.9rem;
    padding: 0.95rem 1rem;
    margin: 0;
    border-radius: 22px;
    border: 1px solid transparent;
    background: transparent;
}

.nav-item::before {
    display: none;
}

.nav-copy {
    display: flex;
    flex-direction: column;
    min-width: 0;
    gap: 0.28rem;
}

.nav-text {
    font-size: 0.98rem;
    font-weight: 700;
    color: var(--text-primary);
}

.nav-meta {
    color: var(--text-secondary);
    font-size: 0.76rem;
    line-height: 1.45;
}

.nav-index {
    font-size: 0.74rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    color: var(--text-tertiary);
}

.nav-item:hover {
    transform: translateY(-2px);
    background: rgba(255, 255, 255, 0.86);
    border-color: rgba(99, 102, 241, 0.18);
}

.nav-item.active {
    color: var(--text-primary);
    background: rgba(79, 70, 229, 0.08);
    border-color: rgba(79, 70, 229, 0.16);
    box-shadow: 0 10px 20px rgba(79, 70, 229, 0.08);
}

.nav-item.active .nav-meta,
.nav-item.active .nav-index {
    color: var(--text-primary);
}

.sidebar-footer-card {
    margin: auto 1.25rem 1.25rem;
    padding: 1rem 1.05rem;
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.84);
    border: 1px solid rgba(148, 163, 184, 0.18);
}

.sidebar-footer-title {
    margin: 0.85rem 0 0.4rem;
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-primary);
}

.sidebar-footer-text {
    color: var(--text-secondary);
    font-size: 0.86rem;
    line-height: 1.7;
}

.desktop-command-bar {
    display: grid;
    grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.95fr);
    gap: 1.25rem;
    align-items: stretch;
    padding: 1.25rem;
    border-radius: 30px;
    background: rgba(255, 255, 255, 0.82);
    border: 1px solid rgba(148, 163, 184, 0.16);
    box-shadow: var(--surface-shadow-soft);
}

.command-bar-copy {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 0.95rem;
}

.command-title {
    font-size: clamp(2rem, 3vw, 2.75rem);
    line-height: 1.08;
    color: var(--text-primary);
}

.command-desc {
    max-width: 56ch;
    color: var(--text-secondary);
    font-size: 1rem;
    line-height: 1.75;
}

.command-shortcuts {
    display: flex;
    flex-wrap: wrap;
    gap: 0.7rem;
}

.command-chip {
    padding: 0.72rem 1rem;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.78);
    color: var(--text-primary);
    font-weight: 700;
    border: 1px solid rgba(203, 213, 225, 0.72);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.62);
}

.command-chip:hover {
    transform: translateY(-1px);
    border-color: rgba(79, 70, 229, 0.14);
    box-shadow: 0 10px 18px rgba(15, 23, 42, 0.05);
}

.command-bar-actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 64px;
    gap: 0.85rem;
}

/* ========================================
   桌面端版本状态条
   ======================================== */
.version-status-bar {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.62rem 1rem;
    border-radius: 16px;
    border: 1px solid rgba(148, 163, 184, 0.16);
    background: rgba(255, 255, 255, 0.88);
    backdrop-filter: blur(18px);
    box-shadow: 0 12px 24px rgba(15, 23, 42, 0.06);
}

.version-status-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.version-badge {
    padding: 0.22rem 0.58rem;
    border-radius: 999px;
    background: rgba(79, 70, 229, 0.08);
    color: #4338ca;
    font-size: 0.78rem;
    font-weight: 700;
    font-family: 'Courier New', monospace;
    border: 1px solid rgba(79, 70, 229, 0.12);
}

.version-divider {
    color: var(--text-tertiary);
    font-size: 0.85rem;
}

.version-status {
    font-size: 0.78rem;
    font-weight: 600;
    transition: color 0.3s ease;
}

.version-status-checking {
    color: var(--text-tertiary);
}

.version-status-uptodate {
    color: #047857;
}

.version-status-update {
    color: #4338ca;
    cursor: pointer;
}

.version-status-update:hover {
    text-decoration: underline;
}

.version-status-failed {
    color: var(--text-tertiary);
}

.version-status-right {
    display: flex;
    align-items: center;
    gap: 0.4rem;
}

.version-latest-label {
    color: var(--text-tertiary);
    font-size: 0.72rem;
    font-weight: 600;
}

.version-latest-value {
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--text-primary);
    font-family: 'Courier New', monospace;
}

/* ========================================
   移动端版本徽章
   ======================================== */
.mobile-version-badge {
    display: none;
    align-items: center;
    gap: 0.34rem;
    padding: 0.22rem 0.58rem;
    border-radius: 999px;
    border: 1px solid rgba(148, 163, 184, 0.16);
    background: rgba(248, 250, 252, 0.92);
    white-space: nowrap;
    cursor: pointer;
    transition: transform var(--transition-fast), border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.mobile-version-badge:hover {
    transform: translateY(-1px);
    border-color: rgba(var(--primary-rgb), 0.22);
    box-shadow: 0 10px 18px rgba(15, 23, 42, 0.08);
}

.mvb-version {
    font-size: 0.68rem;
    font-weight: 700;
    color: var(--text-secondary);
    font-family: 'Courier New', monospace;
}

.mvb-status {
    font-size: 0.64rem;
    font-weight: 600;
}

.mvb-status-checking {
    color: var(--text-tertiary);
}

.mvb-status-uptodate {
    color: #047857;
}

.mvb-status-update {
    color: #4338ca;
}

.mvb-status-failed {
    color: var(--text-tertiary);
}

/* 深色模式版本组件 */
[data-theme="dark"] .version-status-bar {
    background: rgba(8, 12, 24, 0.78);
    border-color: rgba(129, 140, 248, 0.18);
}

[data-theme="dark"] .version-badge {
    background: rgba(129, 140, 248, 0.16);
    color: #c7d2fe;
    border-color: rgba(129, 140, 248, 0.24);
}

[data-theme="dark"] .version-status-uptodate {
    color: #6ee7b7;
}

[data-theme="dark"] .version-status-update {
    color: #a5b4fc;
}

[data-theme="dark"] .mobile-version-badge {
    background: rgba(15, 23, 42, 0.78);
    border-color: rgba(129, 140, 248, 0.16);
}

[data-theme="dark"] .mvb-status-uptodate {
    color: #6ee7b7;
}

[data-theme="dark"] .mvb-status-update {
    color: #a5b4fc;
}

.desktop-status-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.72rem;
    min-height: 60px;
    padding: 0 1rem;
    border-radius: 20px;
    border: 1px solid rgba(203, 213, 225, 0.72);
    background: rgba(255, 255, 255, 0.88);
    color: var(--text-primary);
    cursor: pointer;
    transition: transform var(--transition-fast), border-color var(--transition-fast), background var(--transition-fast), box-shadow var(--transition-fast);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.64);
}

.desktop-status-pill:hover {
    transform: translateY(-1px);
    border-color: rgba(79, 70, 229, 0.14);
    box-shadow: 0 10px 18px rgba(15, 23, 42, 0.05);
}

.desktop-status-pill[data-deploy-ok="1"] {
    border-color: rgba(16, 185, 129, 0.18);
    background: rgba(255, 255, 255, 0.88);
    box-shadow: inset 3px 0 0 rgba(16, 185, 129, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.64);
}

.desktop-status-pill[data-deploy-ok="0"] {
    border-color: rgba(239, 68, 68, 0.18);
    background: rgba(255, 255, 255, 0.88);
    box-shadow: inset 3px 0 0 rgba(239, 68, 68, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.64);
}

.desktop-status-text {
    font-size: 0.95rem;
    font-weight: 700;
}

.version-card-inline,
.api-endpoint-card-inline {
    margin: 0;
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.88);
    border: 1px solid rgba(148, 163, 184, 0.16);
    box-shadow: none;
}

.version-card-inline {
    grid-column: 1 / -1;
    padding: 1rem;
}

.version-content-inline {
    gap: 0.7rem;
}

.api-endpoint-card-inline {
    grid-column: 1 / -1;
    min-height: 84px;
    margin-top: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
}

.theme-toggle-inline {
    position: static;
    width: 64px;
    height: 60px;
    border-radius: 20px;
    justify-self: end;
    box-shadow: none;
}

.theme-toggle-inline:hover {
    transform: translateY(-2px) rotate(8deg);
}

[data-theme="dark"] .sidebar,
[data-theme="dark"] .desktop-command-bar,
[data-theme="dark"] .sidebar-brief,
[data-theme="dark"] .sidebar-footer-card,
[data-theme="dark"] .version-card-inline,
[data-theme="dark"] .api-endpoint-card-inline,
[data-theme="dark"] .desktop-status-pill {
    background: rgba(8, 12, 24, 0.78);
    border-color: rgba(129, 140, 248, 0.18);
}

[data-theme="dark"] .brand-kicker,
[data-theme="dark"] .nav-group-label,
[data-theme="dark"] .command-kicker,
[data-theme="dark"] .preview-hero-eyebrow,
[data-theme="dark"] .side-card-kicker,
[data-theme="dark"] .sidebar-footer-kicker {
    background: rgba(129, 140, 248, 0.14);
    color: #c7d2fe;
}

[data-theme="dark"] .nav-item:hover,
[data-theme="dark"] .brief-action,
[data-theme="dark"] .command-chip,
[data-theme="dark"] .api-endpoint-card {
    background: rgba(15, 23, 42, 0.8);
}

[data-theme="dark"] .nav-item.active {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(168, 85, 247, 0.14) 100%);
}



/* ========================================
   2026 移动底栏与服务台细化
   ======================================== */
.sidebar {
    overflow-x: hidden;
    overflow-y: auto;
}

.desktop-command-bar {
    grid-template-columns: minmax(0, 1.25fr) minmax(360px, 0.92fr);
    align-items: start;
    border-radius: 32px;
    background: rgba(255, 255, 255, 0.82);
}

.command-bar-copy {
    padding-right: 0.5rem;
}

.command-title {
    max-width: 14ch;
}

.command-shortcuts {
    gap: 0.65rem;
}

.command-chip {
    min-height: 42px;
    background: rgba(255, 255, 255, 0.78);
    border: 1px solid rgba(148, 163, 184, 0.14);
}

.command-bar-actions {
    align-self: stretch;
}

.version-card-inline,
.api-endpoint-card-inline,
.desktop-status-pill,
.theme-toggle-inline {
    box-shadow: 0 12px 24px rgba(15, 23, 42, 0.06);
}

.mobile-service-mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    border-radius: 14px;
    border: 1px solid rgba(148, 163, 184, 0.18);
    background: rgba(148, 163, 184, 0.12);
    color: #475569;
    font-size: 0.76rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    box-shadow: none;
    flex-shrink: 0;
}

.mobile-service-label {
    display: block;
    margin-bottom: 0.18rem;
    color: var(--text-tertiary);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.mobile-logo-wrapper {
    gap: 0.8rem;
}

.mobile-logo-image {
    display: none;
}

.mobile-header {
    transition: transform var(--transition-base), opacity var(--transition-base), border-color var(--transition-base), background var(--transition-base), box-shadow var(--transition-base);
}

.mobile-header-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.9rem;
}

.mobile-header-kicker {
    display: inline-flex;
    align-items: center;
    width: fit-content;
    color: var(--text-tertiary);
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.mobile-title-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
}

.mobile-bottom-nav {
    display: none;
}


.mobile-bottom-nav-scroll {
    display: flex;
    gap: 0.6rem;
    overflow-x: auto;
    scrollbar-width: none;
}

.mobile-bottom-nav-scroll::-webkit-scrollbar {
    display: none;
}

.mobile-nav-item {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.3rem;
    min-width: 72px;
    min-height: 62px;
    padding: 0.7rem 0.8rem;
    border: 1px solid transparent;
    border-radius: 22px;
    background: rgba(255, 255, 255, 0.74);
    color: var(--text-secondary);
    font-size: 0.72rem;
    font-weight: 700;
    cursor: pointer;
    transition: transform var(--transition-fast), color var(--transition-fast), background var(--transition-fast), border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.mobile-nav-item.active {
    color: var(--text-primary);
    background: rgba(79, 70, 229, 0.08);
    border-color: rgba(79, 70, 229, 0.16);
    box-shadow: 0 10px 18px rgba(79, 70, 229, 0.08);
}

.mobile-nav-icon {
    width: 18px;
    height: 18px;
    stroke-width: 2;
}

[data-theme="dark"] .desktop-command-bar {
    background: linear-gradient(180deg, rgba(8, 12, 24, 0.82) 0%, rgba(15, 23, 42, 0.78) 100%);
}

[data-theme="dark"] .command-chip {
    background: rgba(15, 23, 42, 0.82);
    border-color: rgba(129, 140, 248, 0.16);
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

`;
