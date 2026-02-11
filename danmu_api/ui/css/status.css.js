// language=CSS
export const statusCssContent = /* css */ `/* ========================================
   状态类样式（运行状态与模式图标状态）
   ======================================== */

/* ========================================
   系统状态样式
   ======================================== */
.status-running {
    animation: pulse 2s ease-in-out infinite;
}

.status-warning {
    animation: pulse 2s ease-in-out infinite;
}

.status-error {
    animation: shake 0.5s ease-in-out;
}

/* ========================================
   模式徽章样式
   ======================================== */
.mode-preview .stat-icon-wrapper {
    background: linear-gradient(135deg, #94a3b8 0%, #64748b 100%);
}

.mode-user .stat-icon-wrapper {
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
}

.mode-admin .stat-icon-wrapper {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
}
`;
