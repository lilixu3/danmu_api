// language=CSS
export const themeDarkCssContent = /* css */ `/* ========================================
   深色主题补充覆盖（统一深色母版）
   设计方向：深墨黑基底 + 石板灰层级 + 克制冷蓝强调
   参考思路：GitHub Primer Dark / Flowbite Dark / Radix Colors Dark
   ======================================== */

[data-theme="dark"] html {
    background:
        radial-gradient(circle at 12% -4%, rgba(120, 140, 255, 0.18), transparent 24%),
        radial-gradient(circle at 88% 0%, rgba(34, 211, 238, 0.08), transparent 18%),
        linear-gradient(180deg, #08101b 0%, #0b1220 48%, #0a1220 100%);
}

[data-theme="dark"] body {
    background: linear-gradient(180deg, #08101b 0%, #0b1220 48%, #0a1220 100%);
}

[data-theme="dark"] body::before {
    background-image:
        radial-gradient(circle at 16% 8%, rgba(139, 163, 255, 0.12) 0%, transparent 30%),
        radial-gradient(circle at 82% 10%, rgba(34, 211, 238, 0.06) 0%, transparent 18%),
        radial-gradient(circle at 50% 100%, rgba(59, 130, 246, 0.08) 0%, transparent 26%);
    animation: none;
    opacity: 1;
}

[data-theme="dark"] body::after {
    display: none;
}

[data-theme="dark"] ::-webkit-scrollbar-track {
    background: rgba(10, 16, 28, 0.72);
    box-shadow: none;
}

[data-theme="dark"] ::-webkit-scrollbar-thumb {
    background: rgba(78, 92, 122, 0.92);
    border: 1px solid rgba(255, 255, 255, 0.04);
    box-shadow: none;
}

[data-theme="dark"] ::-webkit-scrollbar-thumb:hover,
[data-theme="dark"] ::-webkit-scrollbar-thumb:active {
    background: rgba(108, 128, 166, 0.96);
    box-shadow: none;
}

[data-theme="dark"] .content-section,
[data-theme="dark"] .footer,
[data-theme="dark"] .card,
[data-theme="dark"] .modal-container,
[data-theme="dark"] .custom-dialog-container,
[data-theme="dark"] .request-records-summary-card,
[data-theme="dark"] .request-record-card,
[data-theme="dark"] .sidebar,
[data-theme="dark"] .sidebar-brief,
[data-theme="dark"] .sidebar-footer-card,
[data-theme="dark"] .version-card-inline,
[data-theme="dark"] .api-endpoint-card-inline,
[data-theme="dark"] .desktop-status-pill,
[data-theme="dark"] .api-service-hero-refined,
[data-theme="dark"] .hero-brand-block,
[data-theme="dark"] .hero-service-panel,
[data-theme="dark"] .hero-status-panel,
[data-theme="dark"] .hero-mode-panel,
[data-theme="dark"] .hero-endpoint-panel,
[data-theme="dark"] .hero-metric-item,
[data-theme="dark"] .preview-category,
[data-theme="dark"] .preview-item,
[data-theme="dark"] .preview-value,
[data-theme="dark"] .api-info-card,
[data-theme="dark"] .danmu-info-card,
[data-theme="dark"] .danmu-list-card,
[data-theme="dark"] .push-presets-section,
[data-theme="dark"] .lan-scan-section,
[data-theme="dark"] .search-empty,
[data-theme="dark"] .search-error,
[data-theme="dark"] .loading-state,
[data-theme="dark"] .anime-card,
[data-theme="dark"] .episode-item,
[data-theme="dark"] .env-item,
[data-theme="dark"] .response-card,
[data-theme="dark"] .bili-cookie-status-card,
[data-theme="dark"] .bili-cookie-actions-card,
[data-theme="dark"] .bili-cookie-input-card,
[data-theme="dark"] .merge-mode-controls,
[data-theme="dark"] .staging-area,
[data-theme="dark"] .request-records-empty,
[data-theme="dark"] .request-records-loading {
    background: linear-gradient(180deg, rgba(17, 24, 39, 0.9) 0%, rgba(11, 17, 29, 0.96) 100%);
    border-color: rgba(108, 128, 166, 0.22);
    box-shadow: 0 18px 40px rgba(2, 6, 23, 0.28);
}

[data-theme="dark"] .content-section::before {
    background: linear-gradient(90deg, transparent 0%, rgba(139, 163, 255, 0.22) 32%, rgba(45, 212, 191, 0.14) 68%, transparent 100%);
}

[data-theme="dark"] .section-title {
    color: #eef4ff;
    background: none;
    -webkit-text-fill-color: initial;
}

[data-theme="dark"] .section-title::before {
    width: 4px;
    background: linear-gradient(180deg, rgba(139, 163, 255, 0.92) 0%, rgba(92, 181, 255, 0.88) 100%);
    box-shadow: 0 0 0 rgba(0, 0, 0, 0);
    animation: none;
}

[data-theme="dark"] .section-title::after {
    display: none;
}

[data-theme="dark"] .section-desc,
[data-theme="dark"] .hero-service-note,
[data-theme="dark"] .hero-metric-unit,
[data-theme="dark"] .hero-metric-meta,
[data-theme="dark"] .request-record-meta,
[data-theme="dark"] .env-desc,
[data-theme="dark"] .api-description,
[data-theme="dark"] .detail-label,
[data-theme="dark"] .response-status,
[data-theme="dark"] .footer-note {
    color: var(--text-secondary);
}

[data-theme="dark"] .brand-kicker,
[data-theme="dark"] .nav-group-label,
[data-theme="dark"] .command-kicker,
[data-theme="dark"] .preview-hero-eyebrow,
[data-theme="dark"] .side-card-kicker,
[data-theme="dark"] .sidebar-footer-kicker,
[data-theme="dark"] .mobile-subtitle {
    background: rgba(139, 163, 255, 0.12);
    color: #cdd9ff;
}

[data-theme="dark"] .nav-item:hover,
[data-theme="dark"] .brief-action,
[data-theme="dark"] .command-chip,
[data-theme="dark"] .api-endpoint-card,
[data-theme="dark"] .hero-overview-action {
    background: rgba(18, 26, 44, 0.86);
    border-color: rgba(108, 128, 166, 0.18);
}

[data-theme="dark"] .nav-item.active,
[data-theme="dark"] .command-chip:hover,
[data-theme="dark"] .hero-overview-action:hover,
[data-theme="dark"] .log-filter-btn.active,
[data-theme="dark"] .log-tool-btn.active,
[data-theme="dark"] .tab-btn.active,
[data-theme="dark"] .api-mode-tab.active,
[data-theme="dark"] .danmu-method-tab.active {
    background: linear-gradient(180deg, rgba(85, 104, 196, 0.32) 0%, rgba(53, 70, 146, 0.34) 100%);
    border-color: rgba(139, 163, 255, 0.26);
    color: #eef4ff;
    box-shadow: 0 10px 20px rgba(46, 62, 120, 0.2);
}

[data-theme="dark"] .btn-primary {
    background: linear-gradient(180deg, #8ea6ff 0%, #7086f6 100%);
    color: #08101b;
    box-shadow: 0 10px 20px rgba(65, 90, 214, 0.26);
    overflow: visible;
}

[data-theme="dark"] .btn-primary::before {
    display: none;
}

[data-theme="dark"] .btn-primary:hover:not(:disabled) {
    background: linear-gradient(180deg, #a2b5ff 0%, #8196ff 100%);
    box-shadow: 0 14px 26px rgba(65, 90, 214, 0.3);
    transform: translateY(-1px);
}

[data-theme="dark"] .btn-success {
    background: linear-gradient(180deg, #34d399 0%, #16a673 100%);
    box-shadow: 0 10px 18px rgba(22, 166, 115, 0.22);
}

[data-theme="dark"] .btn-success:hover:not(:disabled) {
    background: linear-gradient(180deg, #5eead4 0%, #34d399 100%);
    box-shadow: 0 12px 22px rgba(22, 166, 115, 0.26);
}

[data-theme="dark"] .btn-danger {
    background: linear-gradient(180deg, #fb7185 0%, #ef4444 100%);
    box-shadow: 0 10px 18px rgba(239, 68, 68, 0.22);
}

[data-theme="dark"] .btn-danger:hover:not(:disabled) {
    background: linear-gradient(180deg, #fda4af 0%, #fb7185 100%);
    box-shadow: 0 12px 22px rgba(239, 68, 68, 0.26);
}

[data-theme="dark"] .btn-warning {
    background: linear-gradient(180deg, #f6c35b 0%, #e6a73d 100%);
    box-shadow: 0 10px 18px rgba(230, 167, 61, 0.22);
}

[data-theme="dark"] .btn-warning:hover:not(:disabled) {
    background: linear-gradient(180deg, #ffd487 0%, #f6c35b 100%);
    box-shadow: 0 12px 22px rgba(230, 167, 61, 0.26);
}

[data-theme="dark"] .btn-secondary,
[data-theme="dark"] .tab-btn,
[data-theme="dark"] .api-mode-tab,
[data-theme="dark"] .danmu-method-tab,
[data-theme="dark"] .log-action-btn,
[data-theme="dark"] .log-filter-btn,
[data-theme="dark"] .log-tool-btn,
[data-theme="dark"] .request-record-method,
[data-theme="dark"] .staging-tag,
[data-theme="dark"] .mobile-action-btn,
[data-theme="dark"] .mobile-status-indicator {
    background: rgba(18, 26, 44, 0.92);
    border-color: rgba(108, 128, 166, 0.22);
    color: #dbe7ff;
    box-shadow: none;
}

[data-theme="dark"] .btn-secondary:hover:not(:disabled),
[data-theme="dark"] .tab-btn:hover,
[data-theme="dark"] .api-mode-tab:hover,
[data-theme="dark"] .danmu-method-tab:hover,
[data-theme="dark"] .log-action-btn:hover:not(:disabled),
[data-theme="dark"] .log-filter-btn:hover,
[data-theme="dark"] .log-tool-btn:hover {
    background: rgba(26, 37, 60, 0.98);
    border-color: rgba(139, 163, 255, 0.24);
    color: #eef4ff;
    transform: translateY(-1px);
}

[data-theme="dark"] .form-input,
[data-theme="dark"] .form-select,
[data-theme="dark"] .form-textarea,
[data-theme="dark"] .env-value,
[data-theme="dark"] .api-path,
[data-theme="dark"] .request-record-path,
[data-theme="dark"] .request-record-ip,
[data-theme="dark"] .request-record-params,
[data-theme="dark"] .log-search-group {
    background: rgba(9, 14, 24, 0.9);
    border-color: rgba(89, 104, 135, 0.28);
    color: #eef4ff;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

[data-theme="dark"] .form-input:hover,
[data-theme="dark"] .form-select:hover,
[data-theme="dark"] .form-textarea:hover,
[data-theme="dark"] .env-value:hover,
[data-theme="dark"] .api-path:hover {
    border-color: rgba(119, 138, 181, 0.34);
}

[data-theme="dark"] .form-input:focus,
[data-theme="dark"] .form-select:focus,
[data-theme="dark"] .form-textarea:focus {
    border-color: rgba(139, 163, 255, 0.54);
    box-shadow: 0 0 0 3px rgba(139, 163, 255, 0.14);
}

[data-theme="dark"] .category-tabs,
[data-theme="dark"] .api-mode-tabs,
[data-theme="dark"] .danmu-method-tabs,
[data-theme="dark"] .log-filters,
[data-theme="dark"] .log-toolbar {
    background: rgba(12, 18, 30, 0.78);
    border-color: rgba(89, 104, 135, 0.22);
}

[data-theme="dark"] .log-terminal {
    background: #08111d;
    border-color: rgba(70, 85, 116, 0.28);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02), 0 12px 24px rgba(2, 6, 23, 0.24);
}

[data-theme="dark"] .log-line-time {
    color: #7f8daa;
}

[data-theme="dark"] .log-line-text {
    color: #dfe8fb;
}

[data-theme="dark"] .log-highlight {
    background: rgba(246, 195, 91, 0.22);
    color: #ffe6a3;
}

[data-theme="dark"] .hero-overview-status[data-deploy-ok="1"] {
    background: rgba(7, 58, 49, 0.84);
    border-color: rgba(52, 211, 153, 0.24);
}

[data-theme="dark"] #system-status-card.status-running,
[data-theme="dark"] .hero-metric-item-manual {
    background: linear-gradient(180deg, rgba(17, 24, 39, 0.9) 0%, rgba(11, 17, 29, 0.96) 100%);
    border-color: rgba(52, 211, 153, 0.24);
    box-shadow: 0 18px 40px rgba(2, 6, 23, 0.28);
}

[data-theme="dark"] .hero-overview-status[data-deploy-ok="0"],
[data-theme="dark"] #system-status-card.status-error {
    background: linear-gradient(180deg, rgba(78, 26, 32, 0.84) 0%, rgba(11, 17, 29, 0.94) 100%);
    border-color: rgba(251, 113, 133, 0.24);
}

[data-theme="dark"] #system-status-card.status-warning {
    background: linear-gradient(180deg, rgba(82, 54, 16, 0.84) 0%, rgba(11, 17, 29, 0.94) 100%);
    border-color: rgba(246, 195, 91, 0.22);
}

[data-theme="dark"] #system-status.status-running,
[data-theme="dark"] .hero-metric-item-manual .stat-value {
    color: #7be8c9;
}

[data-theme="dark"] #system-status.status-warning {
    color: #ffd487;
}

[data-theme="dark"] #system-status.status-error {
    color: #ffb2bc;
}

[data-theme="dark"] .quick-action-icon,
[data-theme="dark"] .stat-icon-wrapper,
[data-theme="dark"] .mobile-service-mark {
    background: rgba(139, 163, 255, 0.12);
    border: 1px solid rgba(139, 163, 255, 0.14);
    color: #cdd9ff;
    box-shadow: none;
}

[data-theme="dark"] #mode-icon-wrapper.mode-preview {
    background: linear-gradient(180deg, #56657f 0%, #3f4d65 100%);
}

[data-theme="dark"] #mode-icon-wrapper.mode-user {
    background: linear-gradient(180deg, #4e7cff 0%, #365ed0 100%);
}

[data-theme="dark"] #mode-icon-wrapper.mode-admin {
    background: linear-gradient(180deg, #ff8793 0%, #dc4d5d 100%);
}

[data-theme="dark"] .value-type-badge,
[data-theme="dark"] .method-badge,
[data-theme="dark"] .request-record-method {
    box-shadow: none;
}

[data-theme="dark"] .value-type-badge.multi {
    background: linear-gradient(180deg, #f6c35b 0%, #d89227 100%);
}

[data-theme="dark"] .value-type-badge.color,
[data-theme="dark"] .value-type-badge.map,
[data-theme="dark"] .method-post {
    background: linear-gradient(180deg, #90a7ff 0%, #7288f6 100%);
}

[data-theme="dark"] .method-get {
    background: linear-gradient(180deg, #34d399 0%, #16a673 100%);
}

[data-theme="dark"] .mobile-status-indicator[data-deploy-ok="0"] {
    box-shadow: 0 0 0 3px rgba(251, 113, 133, 0.12);
}

[data-theme="dark"] .mobile-status-indicator[data-deploy-ok="1"] {
    box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.12);
}

[data-theme="dark"] .mobile-nav-item {
    background: transparent;
    border-color: transparent;
    box-shadow: none;
}

[data-theme="dark"] .mobile-nav-item.active {
    background: linear-gradient(180deg, rgba(70, 88, 164, 0.34) 0%, rgba(39, 54, 114, 0.34) 100%);
    border-color: rgba(139, 163, 255, 0.22);
    color: #eef4ff;
    box-shadow: none;
}
`;
