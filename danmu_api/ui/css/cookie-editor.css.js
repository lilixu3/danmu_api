// language=CSS
export const cookieEditorCssContent = /* css */ `
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
.loading-spinner {
    width: 48px;
    height: 48px;
    border: 4px solid var(--bg-tertiary);
    border-top-color: var(--primary-color);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
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
`;