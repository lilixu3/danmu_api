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

.version-icon {
    font-size: 1.25rem;
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
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(139, 92, 246, 0.1));
    border-radius: var(--radius-md);
    border: 1px solid rgba(59, 130, 246, 0.3);
    margin-top: 0.5rem;
}

.update-icon {
    font-size: 1.5rem;
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
    transform: scale(1.1) rotate(15deg);
    box-shadow: 0 8px 32px rgba(59, 130, 246, 0.3);
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
`;
