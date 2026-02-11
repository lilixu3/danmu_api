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
.log-filters {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
}

.log-filter-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    background: var(--bg-primary);
    backdrop-filter: var(--blur-md);
    border: 2px solid var(--border-color);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition-fast);
    font-weight: 500;
    color: var(--text-secondary);
}

.log-filter-btn:hover {
    background: var(--bg-secondary);
    border-color: var(--primary-color);
    transform: translateY(-2px);
    box-shadow: var(--shadow-sm);
}

.log-filter-btn.active {
    background: var(--gradient-primary);
    border-color: var(--primary-color);
    color: white;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.filter-icon {
    font-size: 1.25rem;
}

.filter-text {
    font-size: 0.9375rem;
}

.filter-badge {
    display: none;
    padding: 0.125rem 0.5rem;
    background: rgba(255, 255, 255, 0.2);
    border-radius: var(--radius-sm);
    font-size: 0.75rem;
    font-weight: 600;
    min-width: 24px;
    text-align: center;
}

.log-filter-btn.active .filter-badge {
    background: rgba(255, 255, 255, 0.3);
}

.log-terminal {
    background: var(--bg-primary);
    backdrop-filter: var(--blur-md);
    border-radius: var(--radius-lg);
    padding: 1.5rem;
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-md);
    max-height: 600px;
    overflow-y: auto;
    font-family: 'Courier New', monospace;
}

.log-entry {
    display: flex;
    gap: 1rem;
    padding: 0.875rem;
    margin-bottom: 0.5rem;
    background: var(--bg-secondary);
    backdrop-filter: var(--blur-sm);
    border-radius: var(--radius-md);
    border-left: 3px solid var(--border-color);
    transition: all var(--transition-fast);
    animation: fadeInUp 0.3s ease-out;
}

.log-entry:hover {
    background: var(--bg-tertiary);
    transform: translateX(4px);
}

.log-entry.log-error {
    border-left-color: var(--danger-color);
    background: rgba(239, 68, 68, 0.05);
}

.log-entry.log-warn {
    border-left-color: var(--warning-color);
    background: rgba(245, 158, 11, 0.05);
}

.log-entry.log-success {
    border-left-color: var(--success-color);
    background: rgba(16, 185, 129, 0.05);
}

.log-entry.log-info {
    border-left-color: var(--primary-color);
    background: rgba(59, 130, 246, 0.05);
}

.log-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
}

.log-icon {
    font-size: 1rem;
}

.log-time {
    font-size: 0.8125rem;
    color: var(--text-tertiary);
    font-weight: 600;
}

.log-type-tag {
    padding: 0.125rem 0.5rem;
    border-radius: var(--radius-sm);
    font-size: 0.6875rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.log-type-error {
    background: var(--danger-color);
    color: white;
}

.log-type-warn {
    background: var(--warning-color);
    color: white;
}

.log-type-success {
    background: var(--success-color);
    color: white;
}

.log-type-info {
    background: var(--primary-color);
    color: white;
}

.log-content {
    flex: 1;
    min-width: 0;
}

.log-message {
    font-size: 0.875rem;
    color: var(--text-primary);
    line-height: 1.6;
    word-break: break-word;
}

.log-message-full {
    font-size: 0.875rem;
    color: var(--text-primary);
    line-height: 1.6;
    word-break: break-word;
    margin-top: 0.5rem;
    padding: 0.75rem;
    background: var(--bg-tertiary);
    border-radius: var(--radius-sm);
}

.log-expand-btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    margin-top: 0.5rem;
    padding: 0.375rem 0.75rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    font-size: 0.8125rem;
    cursor: pointer;
    transition: all var(--transition-fast);
}

.log-expand-btn:hover {
    background: var(--bg-tertiary);
    border-color: var(--primary-color);
    color: var(--primary-color);
}

.expand-icon {
    width: 14px;
    height: 14px;
    transition: transform var(--transition-fast);
}

.log-expand-btn.expanded .expand-icon {
    transform: rotate(180deg);
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
