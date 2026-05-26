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
   自定义合并规则编辑器
   ======================================== */
.custom-merge-rules-panel {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.custom-merge-rules-header,
.custom-merge-rule-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
}

.custom-merge-rules-title {
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
}

.custom-merge-rules-help {
    color: var(--text-secondary);
    font-size: 0.875rem;
    line-height: 1.5;
}

.custom-merge-rules-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.custom-merge-rule-item,
.custom-merge-rules-empty {
    border: 1px solid rgba(var(--primary-rgb), 0.18);
    border-radius: var(--radius-lg);
    background: var(--bg-secondary);
    padding: 1rem;
}

.custom-merge-rule-item {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
}

.custom-merge-rule-title,
.custom-merge-side-title {
    color: var(--text-primary);
    font-weight: 600;
}

.custom-merge-action {
    max-width: 150px;
}

.custom-merge-rule-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    gap: 0.75rem;
    align-items: stretch;
}

.custom-merge-side-card {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    padding: 0.85rem;
    border-radius: var(--radius-md);
    background: rgba(var(--primary-rgb), 0.06);
    border: 1px solid rgba(var(--primary-rgb), 0.12);
}

.custom-merge-inline-fields {
    display: grid;
    grid-template-columns: minmax(88px, 0.35fr) minmax(140px, 1fr);
    gap: 0.55rem;
}

.custom-merge-arrow {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 2.6rem;
    border-radius: var(--radius-md);
    color: var(--primary-color);
    background: rgba(var(--primary-rgb), 0.12);
    font-size: 1.45rem;
    font-weight: 800;
}

.custom-merge-arrow[data-action="block"] {
    color: var(--danger-color);
    background: rgba(239, 68, 68, 0.12);
}

.custom-merge-route-row {
    padding-top: 0.25rem;
}

.custom-merge-rules-empty {
    color: var(--text-secondary);
    text-align: center;
    border-style: dashed;
}

.timeline-offset-actions,
.custom-merge-rules-actions,
.recent-data-controls {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 0.5rem;
}

.recent-data-panel {
    display: none;
    max-height: min(360px, 42vh);
    overflow-y: auto;
    padding: 0.65rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-color);
    background: var(--bg-secondary);
}

.recent-data-help {
    margin: 0 0 0.75rem 0;
}

.recent-data-loading,
.recent-data-empty,
.recent-data-error {
    padding: 0.75rem;
    border-radius: var(--radius-sm);
    background: var(--bg-tertiary);
    color: var(--text-secondary);
    font-size: 0.85rem;
}

.recent-data-error {
    color: var(--danger-color);
}

.anime-cache-list,
.merged-children-container,
.episodes-list-container,
.child-mapping-container {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
}

.anime-cache-card,
.anime-cache-child-item,
.anime-cache-episode-item {
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    background: var(--bg-primary);
    color: var(--text-primary);
}

.anime-cache-card {
    overflow: hidden;
    box-shadow: 0 10px 25px rgba(15, 23, 42, 0.06);
}

.anime-cache-card-body,
.anime-cache-child-main {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
}

.anime-cache-card-body {
    padding: 0.75rem;
}

.anime-cache-cover,
.anime-cache-child-cover {
    flex-shrink: 0;
    border-radius: var(--radius-sm);
    background: var(--bg-tertiary);
    background-size: cover;
    background-position: center;
    border: 1px solid var(--border-color);
}

.anime-cache-cover {
    width: 44px;
    height: 60px;
}

.anime-cache-child-cover {
    width: 32px;
    height: 44px;
}

.anime-cache-info,
.anime-cache-child-info {
    flex: 1;
    min-width: 0;
}

.anime-cache-title,
.anime-cache-child-title,
.anime-cache-episode-item {
    overflow-wrap: anywhere;
    word-break: break-word;
}

.anime-cache-title {
    font-weight: 650;
    line-height: 1.35;
}

.anime-cache-child-title {
    font-size: 0.86rem;
    font-weight: 600;
}

.anime-cache-meta {
    margin-top: 0.2rem;
    color: var(--text-secondary);
    font-size: 0.75rem;
}

.anime-cache-actions,
.anime-cache-child-actions {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    flex-shrink: 0;
}

.btn-xs {
    padding: 0.2rem 0.45rem;
    font-size: 0.72rem;
    line-height: 1.2;
}

.anime-cache-footer {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
    padding: 0.65rem 0.75rem;
    border-top: 1px solid var(--border-color);
    background: var(--bg-secondary);
}

.cache-badge {
    border: 1px solid rgba(var(--primary-rgb), 0.22);
    border-radius: 999px;
    background: rgba(var(--primary-rgb), 0.08);
    color: var(--primary-color);
    cursor: pointer;
    font-size: 0.75rem;
    padding: 0.25rem 0.65rem;
}

.cache-badge.active {
    background: rgba(var(--primary-rgb), 0.16);
}

.merged-children-container,
.episodes-list-container {
    display: none;
    padding: 0.65rem 0.75rem;
    border-top: 1px solid var(--border-color);
    background: var(--bg-secondary);
}

.episodes-list-container,
.child-mapping-container {
    max-height: 220px;
    overflow-y: auto;
}

.anime-cache-child-item,
.anime-cache-episode-item {
    padding: 0.55rem;
}

.anime-cache-child-item,
.anime-cache-episode-item,
.mapping-row {
    flex: 0 0 auto;
}

.child-mapping-toggle {
    margin-top: 0.5rem;
    padding: 0.35rem 0.5rem;
    border: 1px dashed var(--border-color);
    border-radius: var(--radius-sm);
    background: var(--bg-secondary);
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 0.75rem;
}

.child-mapping-toggle:hover,
.child-mapping-toggle.active {
    color: var(--primary-color);
    border-color: rgba(var(--primary-rgb), 0.35);
}

.child-mapping-container {
    display: none;
    margin-top: 0.5rem;
}

.mapping-row {
    display: flex;
    gap: 0.45rem;
    align-items: flex-start;
    padding: 0.35rem 0.45rem;
    border-radius: var(--radius-sm);
    background: var(--bg-tertiary);
    font-size: 0.75rem;
}

.mapping-status.success {
    color: var(--success-color, #22c55e);
    flex-shrink: 0;
}

.mapping-text {
    min-width: 0;
    overflow-wrap: anywhere;
}

[data-theme="dark"] .custom-merge-rule-item,
[data-theme="dark"] .custom-merge-rules-empty {
    background: rgba(17, 24, 39, 0.6);
    border-color: rgba(99, 102, 241, 0.2);
}

[data-theme="dark"] .custom-merge-side-card {
    background: rgba(99, 102, 241, 0.08);
    border-color: rgba(129, 140, 248, 0.16);
}

@media (max-width: 768px) {
    .custom-merge-rule-grid {
        grid-template-columns: 1fr;
    }

    .custom-merge-arrow {
        min-height: 2.4rem;
    }

    .custom-merge-inline-fields {
        grid-template-columns: 1fr;
    }
}

/* ========================================
   系统配置编辑弹窗：结构化布局与复杂控件防变形
   ======================================== */
.env-modal-container {
    max-width: min(980px, calc(100vw - 2.5rem));
    width: 100%;
    max-height: min(88vh, 760px);
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.env-modal-header,
.env-modal-footer {
    flex-shrink: 0;
}

.env-modal-title-group {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
}

.env-modal-kicker {
    color: var(--text-tertiary);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.env-modal-form {
    min-height: 0;
    display: flex;
    flex: 1;
    flex-direction: column;
}

.env-modal-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0.85rem;
    background: linear-gradient(180deg, rgba(var(--primary-rgb), 0.035), transparent 38%);
}

.env-modal-shell {
    display: grid;
    grid-template-columns: minmax(200px, 235px) minmax(0, 1fr);
    gap: 0.85rem;
    align-items: stretch;
    min-width: 0;
}

.env-modal-side,
.env-modal-value-card,
.env-modal-description-card,
.map-editor-panel,
.selected-tags-panel,
.available-tags-panel,
.staging-card {
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    background: var(--bg-primary);
    box-shadow: 0 12px 24px rgba(15, 23, 42, 0.055);
}

.env-modal-side {
    position: sticky;
    top: 0;
    align-self: start;
    max-height: calc(88vh - 8rem);
    overflow: visible;
    padding: 0.85rem;
}

.env-modal-side-title,
.env-modal-section-title,
.map-editor-title,
.multi-select-title {
    color: var(--text-primary);
    font-weight: 700;
    line-height: 1.3;
}

.env-modal-meta-list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr));
    align-items: end;
    gap: 0.6rem;
    margin-top: 0.7rem;
}

.env-modal-meta-field {
    margin-bottom: 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.34rem;
}

.env-modal-value-group {
    margin-bottom: 0;
}

.env-modal-meta-field .form-label {
    margin-bottom: 0;
    color: var(--text-secondary);
    font-size: 0.8rem;
    white-space: nowrap;
}

.env-modal-meta-field .form-input,
.env-modal-meta-field .form-select {
    width: 100%;
    min-width: 0;
    padding: 0.54rem 0.68rem;
}

.env-modal-workspace {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.env-modal-value-card {
    min-width: 0;
    padding: 0.85rem;
}

.env-modal-description-card {
    padding: 0.8rem;
}

.env-modal-section-head,
.map-editor-head,
.available-tags-head,
.multi-select-toolbar,
.custom-merge-rule-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
}

.multi-select-toolbar {
    flex-wrap: wrap;
}

.env-modal-section-desc,
.map-editor-hint,
.multi-select-hint,
.staging-copy span {
    margin: 0.25rem 0 0;
    color: var(--text-secondary);
    font-size: 0.84rem;
    line-height: 1.5;
}

.env-modal-value-group > label.form-label,
.env-modal-value-group > label:not(.switch) {
    color: var(--text-secondary);
    font-size: 0.84rem;
    font-weight: 650;
}

.env-description-textarea {
    min-height: 72px;
    resize: vertical;
    margin-top: 0.45rem;
    background: var(--bg-secondary);
}

.multi-select-container {
    gap: 0.8rem;
}

.selected-tags-panel,
.available-tags-panel,
.staging-card {
    padding: 0.85rem;
    background: var(--bg-secondary);
}

.selected-tags,
.available-tags {
    min-height: 56px;
    padding: 0.75rem;
    border-width: 1px;
}

.selected-tags.empty::before {
    line-height: 1.4;
    padding: 0.9rem 0;
}

.staging-card {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.75rem;
    align-items: center;
    border-style: dashed;
}

.staging-copy {
    display: flex;
    flex-direction: column;
    min-width: 0;
}

.staging-area {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
    min-height: 38px;
}

.confirm-merge-btn {
    white-space: nowrap;
}

.map-editor-panel {
    padding: 1rem;
}

.map-container {
    margin-top: 0.85rem;
}

.map-item-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto;
    align-items: center;
}

.map-separator {
    width: 2.2rem;
    text-align: center;
}

.custom-merge-rule-actions {
    justify-content: flex-end;
}

.custom-merge-action {
    width: auto;
    min-width: 132px;
}

.timeline-offset-actions,
.custom-merge-rules-actions,
.recent-data-controls,
.color-pool-controls,
.ai-apikey-actions {
    row-gap: 0.55rem;
}

.env-modal-value-card .btn,
.custom-merge-rules-panel .btn,
.timeline-offset-panel .btn,
.map-editor-panel .btn,
.multi-select-container .btn {
    border-radius: 999px;
}

[data-theme="dark"] .env-modal-side,
[data-theme="dark"] .env-modal-value-card,
[data-theme="dark"] .env-modal-description-card,
[data-theme="dark"] .map-editor-panel,
[data-theme="dark"] .selected-tags-panel,
[data-theme="dark"] .available-tags-panel,
[data-theme="dark"] .staging-card {
    background: rgba(11, 17, 29, 0.88);
    border-color: rgba(129, 140, 248, 0.16);
    box-shadow: 0 18px 34px rgba(2, 6, 23, 0.34);
}

@media (max-width: 900px) {
    .env-modal-container {
        max-height: calc(100vh - 1rem);
    }

    .env-modal-shell {
        display: flex;
        flex-direction: column;
    }

    .env-modal-body {
        overflow-y: auto;
        padding: 0.85rem;
    }

    .env-modal-side {
        position: static;
        align-self: stretch;
        width: 100%;
        min-width: 0;
        box-sizing: border-box;
        max-height: none;
        overflow: visible;
        padding: 0.85rem;
    }

    .env-modal-meta-list {
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
        gap: 0.65rem;
        margin-top: 0.65rem;
    }

    .env-modal-meta-field {
        min-width: 0;
    }

    .env-modal-meta-field .form-label {
        margin-bottom: 0;
        color: var(--text-secondary);
        font-size: 0.8rem;
        white-space: nowrap;
    }

    .env-modal-meta-field .form-input,
    .env-modal-meta-field .form-select {
        min-width: 0;
        padding: 0.62rem 0.78rem;
    }
}

@media (max-width: 720px) {
    .env-modal-container {
        max-width: calc(100vw - 1.5rem);
        max-height: calc(100dvh - 1.5rem);
        border-radius: 16px;
    }

    .env-modal-header,
    .env-modal-footer {
        padding: 0.75rem;
    }

    .env-modal-header .modal-title {
        font-size: 1rem;
    }

    .env-modal-kicker {
        display: none;
    }

    .env-modal-body {
        padding: 0.55rem;
    }

    .env-modal-shell,
    .env-modal-workspace {
        gap: 0.55rem;
    }

    .env-modal-side,
    .env-modal-value-card,
    .env-modal-description-card {
        padding: 0.62rem;
        border-radius: var(--radius-md);
    }

    .env-modal-meta-list {
        gap: 0.5rem;
        margin-top: 0.5rem;
    }

    .env-modal-meta-field .form-input,
    .env-modal-meta-field .form-select {
        padding: 0.48rem 0.58rem;
        font-size: 0.82rem;
    }

    .env-description-textarea {
        min-height: 48px;
        max-height: 72px;
        font-size: 0.8rem;
    }

    .env-modal-meta-list,
    .map-item-grid,
    .custom-merge-inline-fields,
    .timeline-offset-row,
    .timeline-offset-modal-grid,
    .staging-card {
        grid-template-columns: 1fr;
    }

    .map-item-grid {
        align-items: stretch;
    }

    .map-separator {
        width: 100%;
        transform: rotate(90deg);
    }

    .custom-merge-rule-grid {
        grid-template-columns: 1fr;
    }

    .custom-merge-arrow {
        min-height: 2.25rem;
    }

    .recent-data-controls,
    .map-editor-head,
    .multi-select-toolbar,
    .custom-merge-rule-actions,
    .timeline-offset-header,
    .custom-merge-rules-header {
        align-items: stretch;
        flex-direction: column;
    }

    .timeline-offset-actions,
    .custom-merge-rules-actions {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        width: 100%;
        align-items: stretch;
        gap: 0.5rem;
    }

    .recent-data-controls .btn,
    .map-editor-head .btn,
    .multi-select-toolbar .btn,
    .custom-merge-rule-actions .btn,
    .custom-merge-rule-actions .form-select {
        width: 100%;
        justify-content: center;
    }

    .timeline-offset-actions .btn,
    .custom-merge-rules-actions .btn {
        min-width: 0;
        width: 100%;
        justify-content: center;
        padding-left: 0.65rem;
        padding-right: 0.65rem;
        white-space: nowrap;
    }

    .timeline-offset-line {
        flex-direction: column;
        align-items: stretch;
    }

    .recent-data-panel {
        max-height: min(260px, 34vh);
        padding: 0.42rem;
    }

    .recent-data-help {
        margin-bottom: 0.45rem;
        font-size: 0.76rem;
        line-height: 1.35;
    }

    .anime-cache-list,
    .merged-children-container,
    .episodes-list-container,
    .child-mapping-container {
        gap: 0.38rem;
    }

    .anime-cache-card-body {
        display: grid;
        grid-template-columns: 34px minmax(0, 1fr) auto;
        gap: 0.48rem;
        align-items: center;
        padding: 0.45rem;
    }

    .anime-cache-child-main {
        display: grid;
        grid-template-columns: 26px minmax(0, 1fr) auto;
        gap: 0.42rem;
        align-items: center;
    }

    .anime-cache-cover {
        width: 34px;
        height: 46px;
    }

    .anime-cache-child-cover {
        width: 26px;
        height: 36px;
    }

    .anime-cache-title,
    .anime-cache-child-title,
    .anime-cache-meta,
    .anime-cache-episode-item {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        overflow-wrap: normal;
        word-break: normal;
    }

    .anime-cache-title {
        font-size: 0.84rem;
        line-height: 1.2;
    }

    .anime-cache-child-title {
        font-size: 0.78rem;
        line-height: 1.2;
    }

    .anime-cache-meta {
        margin-top: 0.1rem;
        font-size: 0.66rem;
    }

    .anime-cache-actions,
    .anime-cache-child-actions {
        flex-direction: row;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 0.25rem;
    }

    .anime-cache-actions .btn-xs,
    .anime-cache-child-actions .btn-xs {
        padding: 0.18rem 0.38rem;
        font-size: 0.66rem;
        min-height: 1.45rem;
        white-space: nowrap;
    }

    .anime-cache-footer {
        padding: 0.38rem 0.45rem;
        gap: 0.3rem;
    }

    .cache-badge {
        padding: 0.18rem 0.45rem;
        font-size: 0.66rem;
    }

    .merged-children-container,
    .episodes-list-container {
        padding: 0.42rem 0.45rem;
    }

    .anime-cache-child-item,
    .anime-cache-episode-item {
        padding: 0.38rem;
    }

    .child-mapping-toggle {
        margin-top: 0.35rem;
        padding: 0.25rem 0.4rem;
        font-size: 0.68rem;
    }
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
