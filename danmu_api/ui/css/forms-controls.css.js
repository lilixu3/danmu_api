// language=CSS
export const formsControlsCssContent = /* css */ `/* ========================================
   表单与交互控件（输入、开关、标签、映射与紧凑模态底部）
   ======================================== */

/* ========================================
   表单基础样式
   ======================================== */
.form-group {
    margin-bottom: 1.5rem;
}

.form-label {
    display: block;
    font-weight: 500;
    font-size: 0.9375rem;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
}

.form-label.required::after {
    content: ' *';
    color: var(--danger-color);
}

.form-input,
.form-select,
.form-textarea {
    width: 100%;
    padding: 0.75rem 1rem;
    background: var(--bg-secondary);
    backdrop-filter: var(--blur-sm);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    font-size: 0.9375rem;
    transition: border-color var(--transition-fast), background var(--transition-fast), box-shadow var(--transition-fast), transform var(--transition-fast);
    font-family: inherit;
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
    outline: none;
    border-color: var(--primary-color);
    background: var(--bg-primary);
    box-shadow: 0 0 0 3px rgba(var(--primary-rgb), 0.12);
}

.form-input:hover,
.form-select:hover,
.form-textarea:hover {
    border-color: rgba(var(--primary-rgb), 0.42);
}
/* 深色模式表单增强 */
[data-theme="dark"] .form-input,
[data-theme="dark"] .form-select,
[data-theme="dark"] .form-textarea {
    background: rgba(17, 24, 39, 0.6);
    border: 1px solid rgba(99, 102, 241, 0.2);
    color: var(--text-primary);
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
}

[data-theme="dark"] .form-input:focus,
[data-theme="dark"] .form-select:focus,
[data-theme="dark"] .form-textarea:focus {
    background: rgba(17, 24, 39, 0.9);
    border-color: #818cf8;
    box-shadow: 
        0 0 0 4px rgba(129, 140, 248, 0.15),
        0 0 20px rgba(129, 140, 248, 0.3),
        0 0 40px rgba(167, 139, 250, 0.1),
        inset 0 1px 0 rgba(255, 255, 255, 0.1),
        inset 0 2px 4px rgba(0, 0, 0, 0.2);
    transform: translateY(-1px);
}

[data-theme="dark"] .form-input,
[data-theme="dark"] .form-select,
[data-theme="dark"] .form-textarea {
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

[data-theme="dark"] .form-input:hover,
[data-theme="dark"] .form-select:hover,
[data-theme="dark"] .form-textarea:hover {
    border-color: rgba(129, 140, 248, 0.4);
    box-shadow: 0 0 20px rgba(129, 140, 248, 0.1),
                inset 0 2px 4px rgba(0, 0, 0, 0.3);
}

.form-input::placeholder,
.form-textarea::placeholder {
    color: var(--text-tertiary);
}

.form-input.error {
    border-color: var(--danger-color);
    animation: shake 0.3s ease;
}

.form-textarea {
    resize: vertical;
    min-height: 100px;
    line-height: 1.6;
}

.form-help {
    display: flex;
    flex-direction: row;
    align-items: center;
    flex-wrap: nowrap;
    gap: 0.375rem;
    font-size: 0.8125rem;
    color: var(--text-tertiary);
    margin-top: 0.5rem;
}

.help-icon {
    font-size: 1rem;
}

@keyframes shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
    20%, 40%, 60%, 80% { transform: translateX(4px); }
}

/* ========================================
   表单卡片
   ======================================== */
.form-card {
    background: var(--bg-primary);
    backdrop-filter: var(--blur-md);
    border-radius: var(--radius-lg);
    padding: 1.5rem;
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-sm);
    margin-bottom: 1.5rem;
}

/* ========================================
   输入组
   ======================================== */
.input-group {
    display: flex;
    gap: 0.75rem;
}

.input-group .form-input {
    flex: 1;
}

/* ========================================
   开关组件
   ======================================== */
.switch-container {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.switch {
    position: relative;
    display: inline-block;
    width: 52px;
    height: 28px;
}

.switch input {
    opacity: 0;
    width: 0;
    height: 0;
}

.slider {
    position: absolute;
    cursor: pointer;
    inset: 0;
    background: var(--bg-tertiary);
    transition: all var(--transition-base);
    border-radius: 28px;
    border: 2px solid var(--border-color);
}

.slider:before {
    content: "";
    position: absolute;
    height: 20px;
    width: 20px;
    left: 3px;
    bottom: 2px;
    background: white;
    transition: all var(--transition-base);
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.switch input:checked + .slider {
    background: var(--gradient-primary);
    border-color: var(--primary-color);
}

.switch input:checked + .slider:before {
    transform: translateX(24px);
}

.switch input:focus + .slider {
    box-shadow: 0 0 0 3px rgba(var(--primary-rgb), 0.12);
}

.switch-label {
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--text-primary);
    user-select: none;
}

/* ========================================
   数字选择器
   ======================================== */
.number-picker {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: var(--bg-secondary);
    backdrop-filter: var(--blur-sm);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
}

.number-controls {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.number-btn {
    width: 32px;
    height: 32px;
    background: rgba(255, 255, 255, 0.92);
    border: 1px solid rgba(203, 213, 225, 0.78);
    border-radius: var(--radius-sm);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-primary);
    font-size: 0.875rem;
    transition: transform var(--transition-fast), background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast), box-shadow var(--transition-fast);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

.number-btn:hover {
    background: rgba(238, 242, 255, 0.96);
    color: #4338ca;
    border-color: rgba(79, 70, 229, 0.16);
    transform: translateY(-1px);
    box-shadow: 0 8px 14px rgba(15, 23, 42, 0.05);
}

.number-btn:active {
    transform: translateY(0);
    box-shadow: none;
}

.number-display {
    font-size: 2rem;
    font-weight: 700;
    color: var(--text-primary);
    min-width: 60px;
    text-align: center;
    font-family: 'Courier New', monospace;
}

.number-range {
    margin-top: 1rem;
}

.number-range input[type="range"] {
    width: 100%;
    height: 6px;
    background: var(--bg-tertiary);
    border-radius: 3px;
    outline: none;
    -webkit-appearance: none;
}

.number-range input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    background: linear-gradient(180deg, #5c65ee 0%, #4f46e5 100%);
    cursor: pointer;
    border-radius: 50%;
    border: 3px solid rgba(255, 255, 255, 0.92);
    box-shadow: 0 4px 12px rgba(var(--primary-rgb), 0.18);
    transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.number-range input[type="range"]::-webkit-slider-thumb:hover {
    transform: scale(1.08);
    box-shadow: 0 6px 16px rgba(var(--primary-rgb), 0.22);
}

.number-range input[type="range"]::-moz-range-thumb {
    width: 20px;
    height: 20px;
    background: linear-gradient(180deg, #5c65ee 0%, #4f46e5 100%);
    cursor: pointer;
    border-radius: 50%;
    border: 3px solid rgba(255, 255, 255, 0.92);
    box-shadow: 0 4px 12px rgba(var(--primary-rgb), 0.18);
    transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.number-range input[type="range"]::-moz-range-thumb:hover {
    transform: scale(1.08);
    box-shadow: 0 6px 16px rgba(var(--primary-rgb), 0.22);
}

/* ========================================
   标签选择器
   ======================================== */
.tag-selector {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    padding: 1rem;
    background: var(--bg-secondary);
    backdrop-filter: var(--blur-sm);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    min-height: 80px;
}

.tag-option {
    padding: 0.5rem 1rem;
    background: var(--bg-primary);
    backdrop-filter: var(--blur-sm);
    border: 2px solid var(--border-color);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
    user-select: none;
}

.tag-option:hover {
    background: var(--bg-tertiary);
    border-color: var(--primary-color);
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
}

.tag-option.selected {
    background: var(--gradient-primary);
    color: white;
    border-color: var(--primary-color);
    box-shadow: 0 6px 14px rgba(var(--primary-rgb), 0.18);
}

/* ========================================
   多选标签容器
   ======================================== */
.multi-select-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.selected-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    padding: 1rem;
    background: var(--bg-secondary);
    backdrop-filter: var(--blur-sm);
    border: 2px dashed var(--border-color);
    border-radius: var(--radius-md);
    min-height: 80px;
    transition: all var(--transition-fast);
}

.selected-tags.empty::before {
    content: '拖动标签到此处或点击下方标签添加';
    color: var(--text-tertiary);
    font-size: 0.875rem;
    width: 100%;
    text-align: center;
    line-height: 48px;
}

.selected-tags.drag-over {
    border-color: var(--primary-color);
    background: rgba(var(--primary-rgb), 0.05);
}

.selected-tag {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--gradient-primary);
    color: white;
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: move;
    transition: transform var(--transition-fast), box-shadow var(--transition-fast), opacity var(--transition-fast);
    box-shadow: 0 4px 10px rgba(var(--primary-rgb), 0.16);
}

.selected-tag:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 16px rgba(var(--primary-rgb), 0.18);
}

.selected-tag.dragging {
    opacity: 0.5;
    transform: scale(0.95);
}

.selected-tag.drag-over {
    transform: scale(1.05);
}

.tag-text {
    user-select: none;
}

.remove-btn {
    width: 20px;
    height: 20px;
    background: rgba(255, 255, 255, 0.2);
    border: none;
    border-radius: 50%;
    color: white;
    font-size: 1rem;
    line-height: 1;
    cursor: pointer;
    transition: all var(--transition-fast);
    display: flex;
    align-items: center;
    justify-content: center;
}

.remove-btn:hover {
    background: rgba(255, 255, 255, 0.28);
    transform: scale(1.08);
}

.available-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    padding: 1rem;
    background: var(--bg-secondary);
    backdrop-filter: var(--blur-sm);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
}

.available-tag {
    padding: 0.5rem 1rem;
    background: var(--bg-primary);
    backdrop-filter: var(--blur-sm);
    border: 2px solid var(--border-color);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
    user-select: none;
}

.available-tag:hover:not(.disabled) {
    background: var(--bg-tertiary);
    border-color: var(--primary-color);
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
}

.available-tag.disabled {
    opacity: 0.4;
    cursor: not-allowed;
    background: var(--bg-tertiary);
}

/* ========================================
   搜索输入组优化
   ======================================== */
.search-input-group {
    position: relative;
    display: flex;
    gap: 0;
}

.search-input-group .search-input {
    flex: 1;
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
    border-right: none;
    padding-right: 1rem;
}

.search-input-group .search-input:focus {
    border-right: 1px solid var(--primary-color);
    z-index: 1;
}

.search-input-group .search-btn {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
    flex-shrink: 0;
    min-width: auto;
    padding: 0.75rem 1.5rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    white-space: nowrap;
}

.search-input-group .search-btn .btn-icon {
    width: 18px;
    height: 18px;
}

.search-btn-text {
    font-weight: 600;
}

/* ========================================
   映射表样式
   ======================================== */
.map-container {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-top: 0.75rem;
}

.map-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    transition: all var(--transition-fast);
}

.map-item:hover {
    background: var(--bg-tertiary);
    border-color: var(--primary-color);
}

.map-input-left,
.map-input-right {
    flex: 1;
    min-width: 0;
}

.timeline-offset-panel {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.timeline-offset-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
}

.timeline-offset-title {
    font-weight: 600;
    font-size: 1rem;
    color: var(--text-primary);
}

.timeline-offset-help {
    font-size: 0.85rem;
    color: var(--text-secondary);
}

.timeline-offset-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.timeline-offset-form {
    padding: 0.75rem;
    border-radius: var(--radius-md);
    border: 1px dashed var(--border-color);
    background: var(--bg-secondary);
}

.timeline-offset-row {
    display: grid;
    grid-template-columns: 2fr 1fr auto;
    gap: 0.75rem;
    align-items: end;
}

.timeline-offset-field label {
    display: block;
    margin-bottom: 0.35rem;
    font-size: 0.75rem;
    color: var(--text-secondary);
}

.timeline-offset-field.offset-actions {
    align-self: center;
}

.timeline-offset-platforms {
    margin-top: 0.65rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.timeline-offset-platforms-label {
    font-size: 0.75rem;
    color: var(--text-secondary);
}

.timeline-offset-platforms-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
}

.platform-chip {
    border: 1px solid var(--border-color);
    background: var(--bg-primary);
    color: var(--text-secondary);
    border-radius: 999px;
    padding: 0.25rem 0.75rem;
    font-size: 0.8rem;
    transition: all var(--transition-fast);
}

.platform-chip:hover {
    border-color: var(--primary-color);
    color: var(--text-primary);
}

.platform-chip.selected {
    background: var(--primary-color);
    border-color: var(--primary-color);
    color: #fff;
    box-shadow: 0 6px 16px rgba(79, 70, 229, 0.25);
}

.timeline-offset-line {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.65rem 0.75rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-color);
    background: var(--bg-secondary);
}

.timeline-offset-line-input {
    flex: 1;
    font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace);
    background: var(--bg-primary);
}

.timeline-offset-line-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.timeline-offset-line-copy {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
}

.timeline-offset-line-name {
    font-size: 0.92rem;
    font-weight: 600;
    color: var(--text-primary);
    word-break: break-word;
}

.timeline-offset-line-meta {
    font-size: 0.78rem;
    color: var(--text-secondary);
    word-break: break-word;
}

.timeline-offset-empty {
    padding: 1rem 1.1rem;
    border: 1px dashed var(--border-color);
    border-radius: var(--radius-md);
    background: var(--bg-secondary);
    color: var(--text-secondary);
    font-size: 0.88rem;
}

.timeline-offset-quick-modal {
    width: min(720px, calc(100vw - 2rem));
}

.timeline-offset-modal-body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.timeline-offset-modal-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.9rem;
}

.timeline-offset-mode-switch {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.timeline-offset-mode-btn {
    border: 1px solid var(--border-color);
    background: var(--bg-primary);
    color: var(--text-secondary);
    border-radius: 999px;
    padding: 0.45rem 0.95rem;
    font-size: 0.85rem;
    font-weight: 600;
    transition: all var(--transition-fast);
}

.timeline-offset-mode-btn:hover {
    border-color: var(--primary-color);
    color: var(--text-primary);
}

.timeline-offset-mode-btn.active {
    background: var(--primary-color);
    border-color: var(--primary-color);
    color: #fff;
    box-shadow: 0 6px 16px rgba(79, 70, 229, 0.25);
}

.timeline-offset-field-hint {
    margin-top: 0.4rem;
    font-size: 0.75rem;
    color: var(--text-secondary);
}

.timeline-offset-preview {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    padding: 0.85rem 0.95rem;
    border-radius: var(--radius-md);
    background: var(--bg-secondary);
    border: 1px dashed var(--border-color);
}

.timeline-offset-preview-label {
    font-size: 0.78rem;
    color: var(--text-secondary);
}

.timeline-offset-preview-text {
    font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace);
    color: var(--text-primary);
    white-space: pre-wrap;
    word-break: break-all;
}

@media (max-width: 768px) {
    .timeline-offset-row {
        grid-template-columns: 1fr;
    }
    .timeline-offset-field.offset-actions {
        justify-self: end;
    }
    .timeline-offset-line {
        flex-direction: column;
        align-items: stretch;
    }
    .timeline-offset-modal-grid {
        grid-template-columns: 1fr;
    }
    .timeline-offset-mode-switch {
        width: 100%;
    }
    .timeline-offset-mode-btn {
        flex: 1;
        justify-content: center;
    }
}

.map-separator {
    font-weight: bold;
    color: var(--text-secondary);
    font-size: 1.125rem;
    flex-shrink: 0;
}

.map-remove-btn {
    flex-shrink: 0;
    white-space: nowrap;
}

.map-item-template {
    display: none !important;
}

[data-theme="dark"] .map-item {
    background: rgba(17, 24, 39, 0.6);
    border: 1px solid rgba(99, 102, 241, 0.2);
}

[data-theme="dark"] .map-item:hover {
    background: rgba(17, 24, 39, 0.85);
    border-color: rgba(129, 140, 248, 0.4);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3),
                0 0 20px rgba(129, 140, 248, 0.1);
}

/* ========================================
   紧凑型模态框底部
   ======================================== */
.modal-footer-compact {
    display: flex;
    flex-direction: row;
    gap: 0.75rem;
    padding: 1.5rem;
}

.modal-footer-compact .btn-modal {
    flex: 1;
    min-width: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
}

.modal-footer-compact .btn-modal .btn-icon {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
}


/* ========================================
   2026 表单卡片统一服务台风格
   ======================================== */
.form-card {
    position: relative;
    overflow: hidden;
    border-radius: 26px;
    padding: 1.25rem;
    margin-bottom: 1rem;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.88) 0%, rgba(248, 250, 252, 0.82) 100%);
    border: 1px solid rgba(148, 163, 184, 0.16);
    box-shadow: 0 14px 30px rgba(15, 23, 42, 0.06);
}

.form-card::before {
    content: '';
    position: absolute;
    inset: 0 0 auto 0;
    height: 1px;
    background: linear-gradient(90deg, transparent 0%, rgba(99, 102, 241, 0.3) 50%, transparent 100%);
}

[data-theme="dark"] .form-card {
    background: linear-gradient(180deg, rgba(8, 12, 24, 0.84) 0%, rgba(15, 23, 42, 0.8) 100%);
    border-color: rgba(129, 140, 248, 0.16);
}

`;
