// language=CSS
export const settingsCssContent = /* css */ `/* ========================================
   系统配置模块（颜色池、Cookie 编辑器、环境变量配置与状态模态）
   ======================================== */

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

[data-theme="dark"] 

/* 可选标签样式 */

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
   颜色池编辑器 - 提示区
   ======================================== */
.color-pool-hint {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    margin-bottom: 1rem;
    padding: 0.75rem 1rem;
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(139, 92, 246, 0.05));
    border-left: 3px solid var(--primary-color);
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.08);
}

.color-pool-hint::before {
    content: '💡';
    font-size: 1rem;
    flex-shrink: 0;
}

/* ========================================
   颜色池编辑器 - 控制区
   ======================================== */
.color-pool-controls {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
    margin-bottom: 1rem;
    padding: 1rem;
    background: linear-gradient(135deg, var(--bg-secondary), var(--bg-tertiary));
    border-radius: var(--radius-lg);
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-sm);
}

/* 输入区占满整行 */
.color-pool-controls .color-input-group {
    grid-column: 1 / -1;
}

.color-input-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.color-input-group.picker-active {
    z-index: 10003;
}

.color-input-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.color-input-wrapper {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 0.75rem;
    align-items: stretch;
}

/* ========================================
   高级调色板面板
   ======================================== */
.color-picker-panel-wrapper {
    position: relative;
    z-index: 1;
}

.color-picker-panel-wrapper.picker-active {
    z-index: 10002;
}

.color-picker-trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.625rem 1rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition-fast);
    min-height: 44px;
    min-width: 140px;
}

.color-picker-trigger:hover {
    border-color: var(--primary-color);
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.12);
}

.color-picker-trigger.active {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.color-preview {
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm);
    border: 2px solid rgba(255, 255, 255, 0.9);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15), inset 0 1px 2px rgba(0, 0, 0, 0.1);
    flex-shrink: 0;
    transition: transform var(--transition-fast);
}

.color-picker-trigger:hover .color-preview {
    transform: scale(1.05);
}

.color-picker-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-secondary);
    user-select: none;
    white-space: nowrap;
    flex: 1;
}

.picker-arrow {
    width: 16px;
    height: 16px;
    color: var(--text-tertiary);
    transition: transform var(--transition-fast);
    flex-shrink: 0;
}

.color-picker-trigger.active .picker-arrow {
    transform: rotate(180deg);
}

/* 调色板下拉面板 */
.color-picker-dropdown {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    min-width: 300px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    padding: 1rem;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
    z-index: 10001;
    display: none;
    opacity: 0;
    transform: translateY(-10px) scale(0.95);
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.color-picker-dropdown.active {
    display: block;
    opacity: 1;
    transform: translateY(0) scale(1);
}

/* 主调色板画布 */
.color-picker-canvas-wrapper {
    position: relative;
    width: 100%;
    aspect-ratio: 280 / 180;
    border-radius: var(--radius-md);
    overflow: hidden;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1);
    margin-bottom: 0.75rem;
    cursor: crosshair;
}

#color-picker-canvas {
    display: block;
    width: 100%;
    height: 100%;
}

.color-picker-cursor {
    position: absolute;
    width: 16px;
    height: 16px;
    border: 3px solid white;
    border-radius: 50%;
    pointer-events: none;
    transform: translate(-50%, -50%);
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.3);
}

/* 色相条 */
.color-picker-hue-wrapper {
    position: relative;
    width: 100%;
    height: 20px;
    border-radius: var(--radius-sm);
    overflow: hidden;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1);
    margin-bottom: 1rem;
    cursor: pointer;
}

#color-picker-hue {
    display: block;
    width: 100%;
    height: 100%;
}

.color-hue-cursor {
    position: absolute;
    top: 50%;
    width: 4px;
    height: 140%;
    background: white;
    border-radius: 2px;
    pointer-events: none;
    transform: translate(-50%, -50%);
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.3), 0 2px 6px rgba(0, 0, 0, 0.4);
}

/* 颜色信息区 */
.color-picker-info {
    display: flex;
    gap: 1rem;
    align-items: stretch;
}

.color-preview-large {
    width: 60px;
    height: 60px;
    border-radius: var(--radius-md);
    border: 2px solid rgba(255, 255, 255, 0.9);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    flex-shrink: 0;
}

.color-values {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.color-value-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.color-value-label {
    font-size: 0.6875rem;
    font-weight: 700;
    color: var(--text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    min-width: 32px;
}

.color-value-input {
    flex: 1;
    padding: 0.375rem 0.625rem;
    font-size: 0.8125rem;
    font-family: 'Monaco', 'Consolas', 'Courier New', monospace;
    font-weight: 600;
    color: var(--text-primary);
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    text-transform: uppercase;
}

/* ========================================
   HEX 输入框
   ======================================== */
.color-hex-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    flex: 1;
}

.color-hex-prefix {
    position: absolute;
    left: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--text-tertiary);
    pointer-events: none;
    font-family: 'Monaco', 'Consolas', 'Courier New', monospace;
}

.color-hex-input {
    width: 100%;
    padding: 0.625rem 0.75rem 0.625rem 1.75rem;
    font-size: 0.875rem;
    font-family: 'Monaco', 'Consolas', 'Courier New', monospace;
    font-weight: 600;
    color: var(--text-primary);
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    transition: all var(--transition-fast);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    min-height: 44px;
}

.color-hex-input::placeholder {
    color: var(--text-tertiary);
    font-weight: 500;
    text-transform: none;
}

.color-hex-input:hover {
    border-color: var(--primary-color);
}

.color-hex-input:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
    background: var(--bg-primary);
}

/* ========================================
   添加按钮
   ======================================== */
.color-add-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0 1.25rem;
    min-height: 44px;
    min-width: 90px;
    background: var(--gradient-primary);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-weight: 600;
    font-size: 0.9375rem;
    cursor: pointer;
    transition: all var(--transition-fast);
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25);
    white-space: nowrap;
}

.color-add-btn svg {
    width: 18px;
    height: 18px;
    stroke-width: 2.5;
}

.color-add-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(99, 102, 241, 0.35);
}

.color-add-btn:active {
    transform: translateY(0);
}

/* ========================================
   功能按钮样式
   ======================================== */
.color-pool-controls > .btn {
    min-height: 42px;
    border-radius: var(--radius-md);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    font-weight: 600;
    transition: all var(--transition-fast);
}

.color-pool-controls > .btn:hover {
    transform: translateY(-1px);
}

/* 重置按钮占满两列 */
.color-pool-controls > .btn.btn-danger {
    grid-column: 1 / -1;
}

.btn-icon-text {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
}

/* ========================================
   颜色池容器
   ======================================== */
.color-pool-container {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
    gap: 0.375rem;
    padding: 0.75rem;
    background: var(--bg-secondary);
    border: 2px dashed var(--border-color);
    border-radius: var(--radius-lg);
    min-height: 80px;
    align-content: start;
    transition: all var(--transition-fast);
}

.color-pool-container:hover {
    border-color: var(--primary-color);
    background: var(--bg-tertiary);
}

.color-pool-container.empty {
    display: flex;
    justify-content: center;
    align-items: center;
}

.color-pool-container.empty::before {
    content: '🎨 暂无颜色，请点击上方按钮添加';
    color: var(--text-tertiary);
    font-size: 0.875rem;
    text-align: center;
}

/* ========================================
   颜色块
   ======================================== */
@keyframes colorChipFadeIn {
    from {
        opacity: 0;
        transform: scale(0.6) translateY(20px) rotate(-5deg);
        filter: blur(4px);
    }
    to {
        opacity: 1;
        transform: scale(1) translateY(0) rotate(0deg);
        filter: blur(0);
    }
}

.color-chip {
    width: 100%;
    aspect-ratio: 1;
    min-height: 40px;
    border-radius: var(--radius-sm);
    position: relative;
    cursor: move;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
    transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    border: 1.5px solid rgba(255, 255, 255, 0.5);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    overflow: visible;
    animation: colorChipFadeIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
    position: relative;
}

.color-chip::after {
    content: '';
    position: absolute;
    inset: -2px;
    border-radius: inherit;
    opacity: 0;
    background: inherit;
    filter: blur(8px);
    z-index: -1;
    transition: opacity 0.3s ease;
}

.color-chip:hover::after {
    opacity: 0.6;
}

[data-theme="dark"] .color-chip:hover::after {
    opacity: 0.8;
}

.color-chip:hover {
    transform: translateY(-4px) scale(1.05);
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
    z-index: 10;
    border-color: rgba(255, 255, 255, 0.8);
}

.color-chip:active {
    cursor: grabbing;
}

.color-chip.dragging {
    opacity: 0.6;
    transform: scale(1.1) rotate(3deg);
    cursor: grabbing;
    z-index: 100;
    box-shadow: 0 16px 32px rgba(0, 0, 0, 0.2);
}

/* 颜色块标签 */
.color-hex-label {
    font-size: 0.5625rem;
    font-weight: 700;
    font-family: 'Monaco', 'Consolas', 'Courier New', monospace;
    color: rgba(0, 0, 0, 0.8);
    background: rgba(255, 255, 255, 0.95);
    padding: 0.125rem 0.25rem;
    border-radius: 4px;
    text-shadow: none;
    letter-spacing: 0.3px;
    pointer-events: none;
    user-select: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    backdrop-filter: blur(4px);
}

/* 删除按钮 */
.color-chip .remove-chip-btn {
    position: absolute;
    top: -8px;
    right: -8px;
    width: 24px;
    height: 24px;
    background: var(--danger-color);
    color: white;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 700;
    line-height: 1;
    cursor: pointer;
    opacity: 0;
    transform: scale(0.8);
    transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    z-index: 2;
}

.color-chip:hover .remove-chip-btn {
    opacity: 1;
    transform: scale(1);
}

.color-chip .remove-chip-btn:hover {
    background: var(--danger-hover);
    transform: scale(1.15) rotate(90deg);
}

/* ========================================
   统计徽章
   ======================================== */
.pool-stats {
    display: inline-flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: nowrap;
    white-space: nowrap;
}

.pool-count-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    background: var(--gradient-primary);
    color: white;
    border-radius: 999px;
    font-weight: 600;
    font-size: 0.8125rem;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);
}

.pool-count-icon {
    font-size: 0.9375rem;
}

/* ========================================
   颜色池标题行
   ======================================== */
.color-pool-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
}

.color-pool-title {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-primary);
    display: flex;
    align-items: center;
    gap: 0.375rem;
    flex-shrink: 1;
    min-width: 0;
}

/* ========================================
   批量导入模态框
   ======================================== */
.batch-import-modal {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    z-index: 10000;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    animation: fadeIn 0.3s ease-out;
}

.batch-import-modal.active {
    display: flex;
}

.batch-import-container {
    background: var(--bg-primary);
    border-radius: var(--radius-xl);
    padding: 1.5rem;
    max-width: 540px;
    width: 100%;
    max-height: 85vh;
    overflow-y: auto;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
    animation: modalSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    border: 1px solid var(--border-color);
}

.batch-import-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border-color);
}

.batch-import-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-primary);
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.batch-import-title::before {
    content: '📦';
    font-size: 1.5rem;
}

.batch-import-close {
    width: 36px;
    height: 36px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all var(--transition-fast);
    color: var(--text-secondary);
}

.batch-import-close:hover {
    background: var(--danger-color);
    color: white;
    border-color: var(--danger-color);
    transform: rotate(90deg);
}

.batch-import-body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.batch-import-hint {
    font-size: 0.875rem;
    color: var(--text-secondary);
    padding: 0.75rem 1rem;
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(139, 92, 246, 0.05));
    border-left: 3px solid var(--primary-color);
    border-radius: var(--radius-sm);
    line-height: 1.6;
}

.batch-import-hint code {
    background: rgba(99, 102, 241, 0.15);
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--primary-color);
}

.batch-import-textarea {
    width: 100%;
    min-height: 180px;
    padding: 1rem;
    font-family: 'Monaco', 'Consolas', 'Courier New', monospace;
    font-size: 0.875rem;
    line-height: 1.6;
    color: var(--text-primary);
    background: var(--bg-secondary);
    border: 2px solid var(--border-color);
    border-radius: var(--radius-md);
    resize: vertical;
    transition: all var(--transition-fast);
}

.batch-import-textarea::placeholder {
    color: var(--text-tertiary);
}

.batch-import-textarea:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.batch-import-preview {
    display: block;
    padding: 1rem;
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
    min-height: 60px;
    border: 1px dashed var(--border-color);
}

.batch-import-preview-colors {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.5rem;
}

.batch-import-preview.empty::before {
    content: '预览区 - 输入颜色后显示预览';
    color: var(--text-tertiary);
    font-size: 0.8125rem;
    width: 100%;
    text-align: center;
}

.batch-import-preview-chip {
    width: 36px;
    height: 36px;
    border-radius: var(--radius-sm);
    border: 2px solid rgba(255, 255, 255, 0.85);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    transition: transform var(--transition-fast);
}

.batch-import-preview-chip:hover {
    transform: scale(1.15);
}

.batch-import-footer {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
}

.batch-import-footer .btn {
    min-width: 100px;
}

/* ========================================
   动画
   ======================================== */
@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

@keyframes modalSlideIn {
    from {
        opacity: 0;
        transform: translateY(-20px) scale(0.95);
    }
    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

/* ========================================
   暗色主题适配
   ======================================== */
[data-theme="dark"] .color-chip {
    border-color: rgba(255, 255, 255, 0.2);
}

[data-theme="dark"] .color-chip:hover {
    border-color: rgba(255, 255, 255, 0.4);
}

[data-theme="dark"] .color-hex-label {
    background: rgba(30, 30, 30, 0.95);
    color: rgba(255, 255, 255, 0.9);
}

[data-theme="dark"] .color-preview {
    border-color: rgba(255, 255, 255, 0.3);
}

[data-theme="dark"] .color-picker-dropdown {
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
}

[data-theme="dark"] .batch-import-modal {
    background: rgba(0, 0, 0, 0.8);
}

/* ========================================
   响应式适配
   ======================================== */
@media (max-width: 640px) {
    .color-pool-controls {
        grid-template-columns: 1fr;
        gap: 0.625rem;
    }

    .color-pool-controls > .btn {
        grid-column: auto;
    }

    .color-input-wrapper {
        grid-template-columns: 1fr;
        gap: 0.5rem;
    }

    .color-picker-trigger {
        min-width: 100%;
    }

    .color-add-btn {
        width: 100%;
    }

    .color-pool-container {
        grid-template-columns: repeat(auto-fill, minmax(36px, 1fr));
        gap: 0.375rem;
        padding: 0.5rem;
    }

    .color-chip {
        min-height: 36px;
    }

    .color-hex-label {
        font-size: 0.5rem;
        padding: 0.125rem 0.25rem;
    }

    .batch-import-container {
        padding: 1rem;
        max-height: 90vh;
    }

    .color-picker-dropdown {
        min-width: 280px;
        left: 50%;
        transform: translateX(-50%) translateY(-10px) scale(0.95);
    }

    .color-picker-dropdown.active {
        transform: translateX(-50%) translateY(0) scale(1);
    }
}

@media (max-width: 480px) {
    .color-pool-hint {
        font-size: 0.75rem;
        padding: 0.625rem 0.75rem;
    }

    .pool-count-badge {
        font-size: 0.6875rem;
        padding: 0.1875rem 0.5rem;
    }

    .color-picker-info {
        flex-direction: column;
        gap: 0.75rem;
    }

    .color-preview-large {
        width: 100%;
        height: 48px;
    }

    .color-pool-container {
        grid-template-columns: repeat(auto-fill, minmax(32px, 1fr));
        gap: 0.25rem;
    }

    .color-chip {
        min-height: 32px;
    }

    .color-hex-label {
        font-size: 0.4375rem;
        padding: 0.0625rem 0.1875rem;
    }
}

/* ========================================
   Bilibili Cookie 编辑器样式
   ======================================== */
.bili-cookie-editor {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

/* 状态卡片 */
.bili-cookie-status-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    padding: 1rem;
    transition: all var(--transition-fast);
}

.bili-cookie-status-header {
    display: flex;
    align-items: center;
    gap: 0.875rem;
}

.bili-cookie-status-icon {
    width: 48px;
    height: 48px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all var(--transition-fast);
}

.bili-cookie-status-icon svg {
    width: 24px;
    height: 24px;
    color: white;
}

.bili-cookie-status-icon.loading {
    background: linear-gradient(135deg, #94a3b8, #64748b);
}

.bili-cookie-status-icon.empty {
    background: linear-gradient(135deg, #94a3b8, #64748b);
}

.bili-cookie-status-icon.success {
    background: var(--gradient-success);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.bili-cookie-status-icon.error {
    background: var(--gradient-danger);
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

.bili-cookie-status-icon.warning {
    background: var(--gradient-warning);
    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
}

.bili-status-spinner {
    width: 24px;
    height: 24px;
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

.bili-cookie-status-info {
    flex: 1;
    min-width: 0;
}

.bili-cookie-status-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.125rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.bili-cookie-status-subtitle {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.bili-cookie-status-badge {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 500;
    flex-shrink: 0;
    transition: all var(--transition-fast);
}

.bili-cookie-status-badge .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
}

.bili-cookie-status-badge.loading {
    background: var(--bg-tertiary);
    color: var(--text-secondary);
}

.bili-cookie-status-badge.loading .status-dot {
    background: var(--text-muted);
    animation: bili-pulse 1.5s ease-in-out infinite;
}

.bili-cookie-status-badge.empty {
    background: var(--bg-tertiary);
    color: var(--text-secondary);
}

.bili-cookie-status-badge.empty .status-dot {
    background: var(--text-muted);
}

.bili-cookie-status-badge.success {
    background: rgba(16, 185, 129, 0.1);
    color: var(--success);
}

.bili-cookie-status-badge.success .status-dot {
    background: var(--success);
}

.bili-cookie-status-badge.error {
    background: rgba(239, 68, 68, 0.1);
    color: var(--danger);
}

.bili-cookie-status-badge.error .status-dot {
    background: var(--danger);
}

.bili-cookie-status-badge.warning {
    background: rgba(245, 158, 11, 0.1);
    color: var(--warning);
}

.bili-cookie-status-badge.warning .status-dot {
    background: var(--warning);
}

/* 状态详情 */
.bili-cookie-status-details {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
}

.bili-cookie-detail-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--bg-primary);
    border-radius: var(--radius-md);
}

.bili-cookie-detail-item .detail-icon {
    font-size: 1rem;
    flex-shrink: 0;
}

.bili-cookie-detail-item .detail-label {
    font-size: 0.75rem;
    color: var(--text-secondary);
    flex-shrink: 0;
}

.bili-cookie-detail-item .detail-value {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text-primary);
    margin-left: auto;
    text-align: right;
}

.bili-cookie-detail-item .detail-value.danger {
    color: var(--danger);
    font-weight: 600;
}

.bili-cookie-detail-item .detail-value.warning {
    color: var(--warning);
    font-weight: 600;
}

.bili-cookie-detail-item .detail-value.vip {
    color: #fb7299;
    font-weight: 600;
}

/* 操作按钮卡片 */
.bili-cookie-actions-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    padding: 1rem;
}

.bili-cookie-actions-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-secondary);
    margin-bottom: 0.875rem;
}

.bili-cookie-actions-title .actions-icon {
    font-size: 1rem;
}

.bili-cookie-actions-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.75rem;
}

.bili-action-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    background: var(--bg-primary);
    cursor: pointer;
    transition: all var(--transition-fast);
    text-align: center;
}

.bili-action-btn:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
}

.bili-action-btn .action-btn-icon {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
}

.bili-action-btn .action-btn-icon svg {
    width: 20px;
    height: 20px;
    color: white;
}

.bili-action-btn .action-btn-text {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
}

.bili-action-btn .action-btn-title {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text-primary);
}

.bili-action-btn .action-btn-desc {
    font-size: 0.6875rem;
    color: var(--text-secondary);
}

.bili-action-btn.bili-action-primary .action-btn-icon {
    background: var(--gradient-primary);
}

.bili-action-btn.bili-action-primary:hover {
    border-color: var(--primary);
    background: rgba(59, 130, 246, 0.05);
}

.bili-action-btn.bili-action-secondary .action-btn-icon {
    background: var(--gradient-success);
}

.bili-action-btn.bili-action-secondary:hover {
    border-color: var(--success);
    background: rgba(16, 185, 129, 0.05);
}

.bili-action-btn.bili-action-warning .action-btn-icon {
    background: var(--gradient-warning);
}

.bili-action-btn.bili-action-warning:hover {
    border-color: var(--warning);
    background: rgba(245, 158, 11, 0.05);
}

/* Cookie 输入卡片 */
.bili-cookie-input-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    padding: 1rem;
}

.bili-cookie-input-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
}

.bili-cookie-input-header .form-label {
    display: flex;
    align-items: center;
    gap: 0.375rem;
}

.bili-cookie-input-header .input-icon {
    font-size: 1rem;
}

.bili-toggle-visibility-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    background: var(--bg-primary);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
}

.bili-toggle-visibility-btn:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
}

.bili-toggle-visibility-btn svg {
    width: 16px;
    height: 16px;
}

.bili-cookie-input-wrapper {
    position: relative;
}

.bili-cookie-textarea {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 0.8125rem;
    line-height: 1.5;
    resize: vertical;
}

.bili-cookie-input-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    z-index: 1;
}

.bili-cookie-input-overlay .overlay-text {
    font-size: 0.875rem;
    color: var(--text-secondary);
}

.bili-cookie-input-overlay .overlay-show-btn {
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    background: var(--bg-primary);
    color: var(--text-primary);
    cursor: pointer;
    transition: all var(--transition-fast);
}

.bili-cookie-input-overlay .overlay-show-btn:hover {
    background: var(--bg-tertiary);
    border-color: var(--primary);
}

.bili-cookie-input-hint {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    margin-top: 0.75rem;
    padding: 0.75rem;
    background: rgba(59, 130, 246, 0.05);
    border: 1px solid rgba(59, 130, 246, 0.1);
    border-radius: var(--radius-md);
    font-size: 0.75rem;
    color: var(--text-secondary);
    line-height: 1.5;
}

.bili-cookie-input-hint .hint-icon {
    flex-shrink: 0;
}

/* ========================================
   二维码登录模态框样式
   ======================================== */
#qr-loading.loading-spinner {
    width: 48px;
    height: 48px;
    border: 4px solid var(--bg-tertiary);
    border-top-color: var(--primary-color);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

/* 脉冲动画 */
@keyframes bili-pulse {
    0%, 100% {
        opacity: 1;
    }
    50% {
        opacity: 0.5;
    }
}

/* 移动端适配 */
@media (max-width: 768px) {
    .bili-cookie-status-header {
        flex-wrap: wrap;
    }
    
    .bili-cookie-status-badge {
        order: -1;
        width: 100%;
        justify-content: center;
        margin-bottom: 0.75rem;
    }
    
    .bili-cookie-status-details {
        grid-template-columns: 1fr;
    }
    
    .bili-cookie-actions-grid {
        grid-template-columns: 1fr;
    }
    
    .bili-action-btn {
        flex-direction: row;
        padding: 0.875rem 1rem;
    }
    
    .bili-action-btn .action-btn-text {
        text-align: left;
    }
}

@media (max-width: 480px) {
    .bili-cookie-status-icon {
        width: 40px;
        height: 40px;
    }
    
    .bili-cookie-status-icon svg {
        width: 20px;
        height: 20px;
    }
    
    .bili-action-btn .action-btn-icon {
        width: 36px;
        height: 36px;
    }
    
    .bili-action-btn .action-btn-icon svg {
        width: 18px;
        height: 18px;
    }
}

/* ========================================
   环境变量配置组件
   ======================================== */
.category-tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 2rem;
    flex-wrap: wrap;
    padding: 0.5rem;
    background: var(--bg-primary);
    backdrop-filter: var(--blur-md);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border-color);
}

.tab-btn {
    flex: 1;
    min-width: 120px;
    padding: 0.875rem 1.5rem;
    background: var(--bg-secondary);
    backdrop-filter: var(--blur-sm);
    border: 2px solid transparent;
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    font-weight: 500;
    font-size: 0.9375rem;
    cursor: pointer;
    transition: all var(--transition-fast);
    white-space: nowrap;
}

.tab-btn:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    transform: translateY(-2px);
}

.tab-btn.active {
    background: var(--gradient-primary);
    border-color: var(--primary-color);
    color: white;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.env-grid {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.env-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
    padding: 1.5rem;
    background: var(--bg-primary);
    backdrop-filter: var(--blur-md);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-sm);
    transition: all var(--transition-fast);
}

.env-item:hover {
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
    border-color: var(--primary-color);
}

.env-info {
    flex: 1;
    min-width: 0;
}

.env-key {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
    flex-wrap: wrap;
}

.env-key strong {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
}

.value-type-badge {
    padding: 0.25rem 0.625rem;
    background: var(--primary-color);
    color: white;
    border-radius: var(--radius-sm);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.value-type-badge.multi {
    background: var(--gradient-warning);
}

.value-type-badge.color {
    background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%);
}

.value-type-badge.map {
    background: linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%);
}

.env-value {
    display: block;
    padding: 0.75rem;
    background: var(--bg-secondary);
    backdrop-filter: var(--blur-sm);
    border-radius: var(--radius-md);
    font-family: 'Courier New', monospace;
    font-size: 0.875rem;
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    margin-bottom: 0.5rem;
    word-break: break-all;
}

.env-desc {
    font-size: 0.8125rem;
    color: var(--text-tertiary);
    line-height: 1.6;
}

.env-actions {
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;
}

.env-empty-state {
    text-align: center;
    padding: 4rem 2rem;
}

.env-empty-state .empty-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
    opacity: 0.5;
}

.env-empty-state h3 {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
}

.env-empty-state p {
    color: var(--text-secondary);
    font-size: 0.9375rem;
}

/* ========================================
   响应式JSON显示
   ======================================== */
.response-card {
    background: var(--bg-primary);
    backdrop-filter: var(--blur-md);
    border-radius: var(--radius-lg);
    padding: 1.5rem;
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-sm);
    margin-top: 1.5rem;
}

.response-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border-color);
    flex-wrap: wrap;
}

.response-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: var(--radius-md);
    font-weight: 600;
    font-size: 0.9375rem;
}

.response-status.success {
    background: rgba(16, 185, 129, 0.1);
    color: var(--success-color);
    border: 1px solid var(--success-color);
}

.response-status.error {
    background: rgba(239, 68, 68, 0.1);
    color: var(--danger-color);
    border: 1px solid var(--danger-color);
}

.response-time {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-secondary);
    font-size: 0.875rem;
}

.copy-response-btn {
    margin-left: auto;
}

.copy-response-btn.copied {
    background: var(--success-color) !important;
    border-color: var(--success-color) !important;
}

.response-content {
    padding: 1.5rem;
    background: var(--bg-secondary);
    backdrop-filter: var(--blur-sm);
    border-radius: var(--radius-md);
    font-family: 'Courier New', monospace;
    font-size: 0.875rem;
    line-height: 1.8;
    overflow-x: auto;
    max-height: 600px;
    overflow-y: auto;
    border: 1px solid var(--border-color);
    white-space: pre-wrap;
    word-break: break-word;
}

.response-content.xml {
    white-space: pre-wrap;
    word-break: break-all;
    color: var(--text-primary);
}

.response-content.error {
    color: var(--danger-color);
}

/* JSON语法高亮 */
.json-key {
    color: #8b5cf6;
    font-weight: 600;
}

.json-string {
    color: #10b981;
}

.json-number {
    color: #f59e0b;
}

.json-boolean {
    color: #3b82f6;
    font-weight: 600;
}

.json-null {
    color: #ef4444;
    font-weight: 600;
}

/* ========================================
   自定义对话框
   ======================================== */
.custom-dialog-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: var(--blur-lg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 1rem;
    animation: fadeIn 0.3s ease;
}

.custom-dialog-container {
    background: var(--bg-primary);
    backdrop-filter: var(--blur-md);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-lg);
    max-width: 480px;
    width: 100%;
    border: 1px solid var(--border-color);
    animation: modalSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.custom-dialog-header {
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
}

.custom-dialog-header h3 {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
}

.custom-dialog-body {
    padding: 1.5rem;
}

.custom-dialog-body p {
    color: var(--text-secondary);
    line-height: 1.7;
    margin-bottom: 1rem;
}

.custom-dialog-body p:last-child {
    margin-bottom: 0;
}

.custom-dialog-body strong {
    color: var(--text-primary);
    font-weight: 600;
}

.custom-dialog-actions {
    padding: 1.5rem;
    border-top: 1px solid var(--border-color);
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
}

.custom-dialog-actions .btn {
    flex: 1;
}

/* ========================================
   部署平台环境变量状态 - 顶栏指示器 & 模态框
   ======================================== */
.mobile-status-indicator[data-deploy-ok="0"] {
    border-color: rgba(239, 68, 68, 0.35);
    box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.06);
}

.mobile-status-indicator[data-deploy-ok="1"] {
    border-color: rgba(34, 197, 94, 0.35);
    box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.06);
}

[data-theme="dark"] .mobile-status-indicator[data-deploy-ok="0"] {
    box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.08);
}

[data-theme="dark"] .mobile-status-indicator[data-deploy-ok="1"] {
    box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.08);
}

.deploy-env-status-modal .modal-body {
    padding-top: 0.75rem;
}

.deploy-env-status-hero {
    position: relative;
    padding: 1.25rem 1.25rem 1.1rem;
    border-radius: var(--radius-lg);
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    overflow: hidden;
    margin-bottom: 1rem;
}

.deploy-env-status-hero::before {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--gradient-primary);
    opacity: 0.08;
    pointer-events: none;
}

[data-theme="dark"] .deploy-env-status-hero::before {
    opacity: 0.12;
}

.deploy-env-status-hero.success::before {
    background: radial-gradient(circle at 30% 20%, rgba(34, 197, 94, 0.35), transparent 55%),
                radial-gradient(circle at 80% 70%, rgba(129, 140, 248, 0.25), transparent 55%);
    opacity: 0.9;
}

.deploy-env-status-hero.error::before {
    background: radial-gradient(circle at 30% 20%, rgba(239, 68, 68, 0.35), transparent 55%),
                radial-gradient(circle at 80% 70%, rgba(192, 132, 252, 0.25), transparent 55%);
    opacity: 0.9;
}

.deploy-env-status-hero-content {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 0.9rem;
}

.deploy-env-status-hero-icon {
    width: 44px;
    height: 44px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-sm);
    flex: 0 0 auto;
}

.deploy-env-status-hero-icon svg {
    width: 22px;
    height: 22px;
}

.deploy-env-status-hero-title {
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
}

.deploy-env-status-hero-subtitle {
    margin-top: 0.35rem;
    font-size: 0.9rem;
    color: var(--text-secondary);
    line-height: 1.5;
}

.deploy-env-status-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.3rem 0.6rem;
    border-radius: 999px;
    border: 1px solid var(--border-color);
    background: var(--bg-primary);
    font-size: 0.8rem;
    color: var(--text-secondary);
    margin-top: 0.55rem;
    width: fit-content;
}

.deploy-env-status-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
    margin-top: 0.75rem;
}

.deploy-env-var-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.9rem 1rem;
    border-radius: var(--radius-lg);
    border: 1px solid var(--border-color);
    background: var(--bg-secondary);
    transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.deploy-env-var-item:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
}

.deploy-env-var-name {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 0.85rem;
    color: var(--text-primary);
}

.deploy-env-var-status {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.28rem 0.6rem;
    border-radius: 999px;
    font-size: 0.8rem;
    border: 1px solid transparent;
    font-weight: 600;
}

.deploy-env-var-status.ok {
    color: var(--success-color);
    border-color: rgba(34, 197, 94, 0.25);
    background: rgba(34, 197, 94, 0.08);
}

.deploy-env-var-status.missing {
    color: var(--danger-color);
    border-color: rgba(239, 68, 68, 0.25);
    background: rgba(239, 68, 68, 0.08);
}

[data-theme="dark"] .deploy-env-var-status.ok {
    border-color: rgba(34, 197, 94, 0.35);
    background: rgba(34, 197, 94, 0.12);
}

[data-theme="dark"] .deploy-env-var-status.missing {
    border-color: rgba(239, 68, 68, 0.35);
    background: rgba(239, 68, 68, 0.12);
}

.deploy-env-code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 0.82rem;
    padding: 0.15rem 0.45rem;
    border-radius: 10px;
    border: 1px solid var(--border-color);
    background: var(--bg-primary);
    color: var(--text-primary);
    white-space: nowrap;
}

.deploy-env-status-hint {
    margin-top: 0.9rem;
    padding: 0.9rem 1rem;
    border-radius: var(--radius-lg);
    border: 1px dashed var(--border-color);
    background: var(--bg-tertiary);
    color: var(--text-secondary);
    font-size: 0.875rem;
    line-height: 1.6;
}
`;
