// language=CSS
export const themeDarkCssContent = /* css */ `/* ========================================
   深色主题补充覆盖（仅深色专属视觉增强）
   ======================================== */

/* ========================================
   深色模式适配
   ======================================== */
[data-theme="dark"] .api-mode-tab {
    background: rgba(17, 24, 39, 0.8);
    border: 2px solid rgba(99, 102, 241, 0.2);
}

[data-theme="dark"] .api-mode-tab:hover {
    border-color: rgba(129, 140, 248, 0.4);
    box-shadow: 0 0 20px rgba(129, 140, 248, 0.15);
}

[data-theme="dark"] .api-mode-tab.active {
    background: linear-gradient(135deg, #818cf8 0%, #a78bfa 100%);
    box-shadow: 0 4px 12px rgba(129, 140, 248, 0.3),
                0 0 40px rgba(167, 139, 250, 0.2);
}

[data-theme="dark"] .danmu-info-card {
    background: linear-gradient(135deg, rgba(129, 140, 248, 0.08), rgba(167, 139, 250, 0.08));
    border: 1px solid rgba(129, 140, 248, 0.25);
}

[data-theme="dark"] #danmu-heatmap-canvas {
    background: rgba(17, 24, 39, 0.6);
}
`;
