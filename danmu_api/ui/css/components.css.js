// language=CSS
export const componentsCssContent = /* css */ `
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

/* ========================================
   按钮组件
   ======================================== */
.btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    border-radius: var(--radius-md);
    font-weight: 500;
    font-size: 0.9375rem;
    cursor: pointer;
    transition: all var(--transition-fast);
    border: 1px solid transparent;
    text-decoration: none;
    white-space: nowrap;
}

.btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.btn-icon {
    width: 18px;
    height: 18px;
    stroke-width: 2;
}

.btn-primary {
    background: var(--primary-color);
    color: white;
}

.btn-primary:hover:not(:disabled) {
    background: var(--primary-hover);
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
}
/* 深色模式按钮增强 */
[data-theme="dark"] .btn-primary {
    background: linear-gradient(135deg, #818cf8 0%, #a78bfa 50%, #c084fc 100%);
    box-shadow: 
        0 4px 16px rgba(129, 140, 248, 0.4),
        0 0 0 1px rgba(255, 255, 255, 0.1) inset,
        0 1px 0 rgba(255, 255, 255, 0.2) inset,
        0 0 20px rgba(129, 140, 248, 0.2);
    position: relative;
    overflow: hidden;
}

[data-theme="dark"] .btn-primary::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(
        circle,
        rgba(255, 255, 255, 0.3) 0%,
        transparent 60%
    );
    transform: scale(0);
    transition: transform 0.6s ease;
}

[data-theme="dark"] .btn-primary:hover::before {
    transform: scale(1);
}

[data-theme="dark"] .btn-primary:hover:not(:disabled) {
    background: linear-gradient(135deg, #a78bfa 0%, #c084fc 50%, #d8b4fe 100%);
    box-shadow: 
        0 8px 32px rgba(129, 140, 248, 0.6),
        0 0 60px rgba(167, 139, 250, 0.4),
        0 0 100px rgba(192, 132, 252, 0.2),
        0 0 0 1px rgba(255, 255, 255, 0.15) inset,
        0 1px 0 rgba(255, 255, 255, 0.3) inset;
    transform: translateY(-4px) scale(1.02);
}

[data-theme="dark"] .btn-primary:active:not(:disabled) {
    transform: translateY(-2px) scale(0.98);
    box-shadow: 
        0 4px 16px rgba(129, 140, 248, 0.4),
        0 0 30px rgba(167, 139, 250, 0.3);
}

[data-theme="dark"] .btn-success {
    background: linear-gradient(135deg, #34d399 0%, #10b981 100%);
    box-shadow: 0 4px 12px rgba(52, 211, 153, 0.3);
}

[data-theme="dark"] .btn-success:hover:not(:disabled) {
    background: linear-gradient(135deg, #6ee7b7 0%, #34d399 100%);
    box-shadow: 0 8px 24px rgba(52, 211, 153, 0.4),
                0 0 40px rgba(110, 231, 183, 0.3);
}

[data-theme="dark"] .btn-danger {
    background: linear-gradient(135deg, #f87171 0%, #ef4444 100%);
    box-shadow: 0 4px 12px rgba(248, 113, 113, 0.3);
}

[data-theme="dark"] .btn-danger:hover:not(:disabled) {
    background: linear-gradient(135deg, #fca5a5 0%, #f87171 100%);
    box-shadow: 0 8px 24px rgba(248, 113, 113, 0.4),
                0 0 40px rgba(252, 165, 165, 0.3);
}

[data-theme="dark"] .btn-warning {
    background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
    box-shadow: 0 4px 12px rgba(251, 191, 36, 0.3);
}

[data-theme="dark"] .btn-warning:hover:not(:disabled) {
    background: linear-gradient(135deg, #fcd34d 0%, #fbbf24 100%);
    box-shadow: 0 8px 24px rgba(251, 191, 36, 0.4),
                0 0 40px rgba(252, 211, 77, 0.3);
}

.btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border-color: var(--border-color);
}

.btn-secondary:hover:not(:disabled) {
    background: var(--bg-tertiary);
    transform: translateY(-2px);
}

.btn-success {
    background: var(--success-color);
    color: white;
}

.btn-success:hover:not(:disabled) {
    background: var(--success-hover);
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
}

.btn-warning {
    background: var(--warning-color);
    color: white;
}

.btn-warning:hover:not(:disabled) {
    background: var(--warning-hover);
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
}

.btn-danger {
    background: var(--danger-color);
    color: white;
}

.btn-danger:hover:not(:disabled) {
    background: var(--danger-hover);
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
}

.btn-sm {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
}

.btn-lg {
    padding: 0.875rem 1.75rem;
    font-size: 1.0625rem;
}

/* ========================================
   卡片组件
   ======================================== */
.card {
    background: var(--bg-primary);
    backdrop-filter: var(--blur-md);
    border-radius: var(--radius-lg);
    padding: 1.5rem;
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-sm);
    transition: all var(--transition-fast);
}

.card:hover {
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
}
/* 深色模式卡片增强 - 玻璃态升级 */
[data-theme="dark"] .card {
    background: rgba(17, 24, 39, 0.7);
    backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid rgba(99, 102, 241, 0.3);
    box-shadow: 
        0 8px 32px rgba(0, 0, 0, 0.5),
        0 0 0 1px rgba(129, 140, 248, 0.1) inset,
        0 2px 0 rgba(255, 255, 255, 0.05) inset,
        0 0 60px rgba(99, 102, 241, 0.05);
    position: relative;
    overflow: hidden;
}

[data-theme="dark"] .card::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
        90deg,
        transparent,
        rgba(129, 140, 248, 0.1),
        transparent
    );
    transition: left 0.7s ease;
}

[data-theme="dark"] .card:hover::before {
    left: 100%;
}

[data-theme="dark"] .card:hover {
    border-color: rgba(129, 140, 248, 0.5);
    background: rgba(17, 24, 39, 0.85);
    box-shadow: 
        0 12px 48px rgba(0, 0, 0, 0.7),
        0 0 0 1px rgba(129, 140, 248, 0.2) inset,
        0 2px 0 rgba(255, 255, 255, 0.08) inset,
        0 0 80px rgba(129, 140, 248, 0.2),
        0 0 120px rgba(167, 139, 250, 0.1);
    transform: translateY(-6px) scale(1.01);
}

.card-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 1rem;
}

.card-desc {
    margin-top: -0.5rem;
    margin-bottom: 1rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
}

/* ========================================
   模态框组件
   ======================================== */
.modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: var(--blur-lg);
    display: none;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 1rem;
}

.modal-overlay.active {
    display: flex;
    animation: fadeIn 0.3s ease;
}

.modal-container {
    background: var(--bg-primary);
    backdrop-filter: var(--blur-md);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-lg);
    max-width: 500px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    border: 1px solid var(--border-color);
}

.modal-lg {
    max-width: 700px;
}

.modal-header {
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.modal-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
}

.modal-close {
    width: 32px;
    height: 32px;
    border: none;
    background: var(--bg-secondary);
    border-radius: 50%;
    font-size: 1.5rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    transition: all var(--transition-fast);
}

.modal-close:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    transform: rotate(90deg);
}

.modal-body {
    padding: 1.5rem;
}

.modal-footer {
    padding: 1.5rem;
    border-top: 1px solid var(--border-color);
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
}

.modal-desc {
    color: var(--text-secondary);
    line-height: 1.7;
}

.modal-list {
    margin: 1rem 0;
    padding-left: 1.5rem;
}

.modal-list li {
    color: var(--text-secondary);
    margin-bottom: 0.5rem;
}

.modal-warning {
    color: var(--warning-color);
    font-weight: 500;
    margin-top: 1rem;
}

.modal-alert {
    background: var(--bg-secondary);
    padding: 1rem;
    border-radius: var(--radius-md);
    margin-top: 1rem;
}

/* ========================================
   成功动画覆盖层
   ======================================== */
.success-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: var(--blur-lg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10001;
    animation: fadeIn 0.3s ease;
}

.success-content {
    text-align: center;
    animation: modalSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.success-icon {
    font-size: 5rem;
    margin-bottom: 1rem;
    animation: pulse 0.6s ease-out;
}

.success-message {
    font-size: 1.5rem;
    font-weight: 600;
    color: white;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

@keyframes successFadeOut {
    from {
        opacity: 1;
    }
    to {
        opacity: 0;
    }
}
/* ========================================
   合并模式与暂存区样式 (Glassmorphism 风格适配)
   ======================================== */

/* 控制栏容器 - 玻璃态卡片 */
.merge-mode-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin: 1rem 0;
    padding: 0.75rem 1rem;
    background: var(--bg-secondary);
    backdrop-filter: var(--blur-sm);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    transition: all 0.3s ease;
    box-shadow: var(--shadow-sm);
}

[data-theme="dark"] .merge-mode-controls {
    background: rgba(255, 255, 255, 0.03);
    border-color: rgba(255, 255, 255, 0.08);
}

/* 暂存区 - 虚线玻璃态容器 */
.staging-area {
    display: none;
    background: rgba(var(--primary-rgb), 0.02); /* 极淡的主色背景 */
    border: 2px dashed var(--border-color);
    border-radius: var(--radius-lg);
    padding: 1rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: center;
    min-height: 64px;
    position: relative;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.staging-area.active {
    display: flex;
    animation: slideDownFade 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* 拖拽进入暂存区时的高亮状态 */
.staging-area:hover,
.staging-tag.drag-over {
    border-color: var(--primary-color);
    background: rgba(var(--primary-rgb), 0.05);
    box-shadow: 0 0 20px rgba(var(--primary-rgb), 0.1) inset;
}

[data-theme="dark"] .staging-area {
    background: rgba(0, 0, 0, 0.15);
    border-color: rgba(255, 255, 255, 0.1);
}

/* 暂存区标签 - 胶囊样式 */
.staging-tag {
    background: var(--bg-primary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    padding: 0.4rem 0.8rem;
    border-radius: 999px; /* 完全圆角 */
    font-size: 0.875rem;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: grab; 
    user-select: none;
    box-shadow: var(--shadow-sm);
    transition: all 0.2s ease;
    backdrop-filter: var(--blur-sm);
}

.staging-tag:active {
    cursor: grabbing;
}

[data-theme="dark"] .staging-tag {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.1);
}

.staging-tag:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
    border-color: var(--primary-color);
}

.staging-tag.dragging {
    opacity: 0.6;
    transform: scale(0.95);
    box-shadow: none;
}

/* 删除按钮 (X) */
.staging-tag .remove-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: rgba(0,0,0,0.05);
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    transition: all 0.2s;
    border: none;
    padding: 0;
}

[data-theme="dark"] .staging-tag .remove-btn {
    background: rgba(255,255,255,0.1);
}

.staging-tag .remove-btn:hover {
    background: var(--danger-color);
    color: white;
    transform: scale(1.1);
}

/* 连接符 & */
.staging-separator {
    color: var(--primary-color);
    font-weight: 800;
    font-size: 1rem;
    opacity: 0.6;
    text-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

/* 确认合并按钮 - 悬浮圆形按钮 */
.confirm-merge-btn {
    margin-left: auto;
    width: 36px;
    height: 36px;
    padding: 0;
    border-radius: 50%;
    border: none;
    background: var(--success-color); /* 还是用绿色表示确认 */
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); /* 绿色阴影 */
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.confirm-merge-btn:hover:not(:disabled) {
    background: var(--success-hover);
    transform: scale(1.1) rotate(10deg);
    box-shadow: 0 6px 16px rgba(16, 185, 129, 0.4);
}

.confirm-merge-btn:disabled {
    background: var(--bg-tertiary);
    color: var(--text-tertiary);
    cursor: not-allowed;
    box-shadow: none;
    transform: scale(0.9);
    opacity: 0.6;
}

/* 可选项列表容器 */
.available-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.625rem;
    margin-top: 1rem;
    padding: 0.5rem;
    background: var(--bg-tertiary);
    border-radius: var(--radius-lg);
    border: 1px solid transparent;
}

[data-theme="dark"] .available-tags {
    border-color: rgba(255, 255, 255, 0.03);
}

/* 可选标签样式 */
.available-tag {
    padding: 0.5rem 1rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all 0.2s ease;
    user-select: none;
    font-size: 0.875rem;
    color: var(--text-secondary);
    display: inline-flex;
    align-items: center;
    box-shadow: var(--shadow-sm);
}

.available-tag:hover {
    background: var(--bg-secondary);
    color: var(--primary-color);
    border-color: var(--primary-color);
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
}

.available-tag.disabled {
    opacity: 0.4;
    cursor: not-allowed;
    background: var(--bg-tertiary);
    color: var(--text-tertiary);
    border-color: transparent;
    pointer-events: none;
    box-shadow: none;
    transform: none;
    filter: grayscale(1);
}

/* 动画定义 */
@keyframes slideDownFade {
    from { 
        opacity: 0; 
        transform: translateY(-15px) scale(0.98); 
    }
    to { 
        opacity: 1; 
        transform: translateY(0) scale(1); 
    }
}


/* ========================================
   请求记录
   ======================================== */
.request-records-summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1rem;
    margin-bottom: 1.25rem;
}

.request-records-summary-card {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    padding: 1rem 1.25rem;
    box-shadow: var(--shadow-sm);
}

.request-records-summary-card .summary-label {
    font-size: 0.75rem;
    color: var(--text-tertiary);
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.request-records-summary-card .summary-value {
    margin-top: 0.35rem;
    font-size: 1.6rem;
    font-weight: 700;
    color: var(--text-primary);
}

.request-records-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.request-record-card {
    margin-bottom: 0;
    padding: 1rem 1.25rem;
}

.request-record-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
}

.request-record-method {
    padding: 0.25rem 0.7rem;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--primary-color);
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
}

.request-record-path {
    flex: 1;
    min-width: 220px;
    padding: 0.35rem 0.75rem;
    border-radius: var(--radius-md);
    border: 1px dashed var(--border-color);
    background: var(--bg-secondary);
    font-family: 'Courier New', monospace;
    font-size: 0.85rem;
    color: var(--text-primary);
    word-break: break-all;
}

.request-record-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-top: 0.6rem;
    font-size: 0.8rem;
    color: var(--text-secondary);
}

.request-record-ip {
    padding: 0.2rem 0.6rem;
    border-radius: 999px;
    border: 1px solid var(--border-color);
    background: var(--bg-secondary);
}

.request-record-params {
    margin-top: 0.8rem;
    padding: 0.85rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-color);
    background: var(--bg-tertiary);
}

.request-record-params-title {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 0.5rem;
}

.request-record-params pre {
    margin: 0;
    font-size: 0.78rem;
    line-height: 1.5;
    font-family: 'Courier New', monospace;
    color: var(--text-primary);
    white-space: pre-wrap;
    word-break: break-word;
}

.request-records-empty,
.request-records-loading {
    text-align: center;
    padding: 2rem 1rem;
    border-radius: var(--radius-lg);
    border: 1px dashed var(--border-color);
    background: var(--bg-primary);
    color: var(--text-secondary);
}

.request-records-empty-icon {
    font-size: 1.6rem;
    margin-bottom: 0.5rem;
}

.request-records-empty-text {
    font-size: 0.9rem;
}

@media (max-width: 768px) {
    .request-records-summary {
        grid-template-columns: 1fr;
    }

    .request-record-header {
        flex-direction: column;
        align-items: flex-start;
    }

    .request-record-path {
        width: 100%;
        min-width: unset;
    }
}

`;