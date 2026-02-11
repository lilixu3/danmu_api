// language=JavaScript
export const logviewJsContent = /* javascript */ `
/* ========================================
   日志状态
   ======================================== */
let currentLogFilter = 'all';
let autoRefreshInterval = null;
let isAutoRefreshing = false;
let logSearchKeyword = '';
let isLogAutoScrollEnabled = true;
let isLogWrapEnabled = true;

/* ========================================
   统一时间格式化（支持完整时间戳/简短时间）
   ======================================== */
function formatLogTime(value) {
    if (!value) {
        return new Date().toLocaleTimeString('zh-CN', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    const text = String(value).trim();

    // 已是 HH:MM[:SS] 格式
    if (/^\\d{2}:\\d{2}(:\\d{2})?$/.test(text)) {
        return text.length === 5 ? text + ':00' : text;
    }

    // ISO 或可解析时间，统一为本地 HH:MM:SS
    const date = new Date(text);
    if (!Number.isNaN(date.getTime())) {
        return date.toLocaleTimeString('zh-CN', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    return text;
}

/* ========================================
   统一日志级别
   ======================================== */
function normalizeLogType(type) {
    const value = String(type || 'info').toLowerCase();
    if (value === 'warning') return 'warn';
    if (value === 'debug') return 'info';
    if (value === 'log') return 'info';
    if (value === 'fatal') return 'error';
    return ['error', 'warn', 'info', 'success'].includes(value) ? value : 'info';
}

/* ========================================
   转义日志内容（纯文本输出）
   ======================================== */
function escapeLogText(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/* ========================================
   日志搜索命中高亮
   ======================================== */
function highlightLogMatch(text, keyword) {
    const safeText = escapeLogText(text);
    if (!keyword) return safeText;

    const escapedKeyword = keyword.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&');
    const reg = new RegExp(escapedKeyword, 'gi');

    return safeText.replace(reg, match => '<mark class="log-highlight">' + match + '</mark>');
}

/* ========================================
   解析日志文本行
   ======================================== */
function parseLogLine(line) {
    const rawLine = String(line || '').trimEnd();
    const match = rawLine.match(/^\\[([^\\]]+)\\]\\s+([a-zA-Z]+):\\s*([\\s\\S]*)$/);

    if (match) {
        const parsedType = normalizeLogType(match[2]);
        return {
            timestamp: formatLogTime(match[1]),
            rawTimestamp: match[1],
            type: parsedType,
            message: match[3] ?? '',
            raw: rawLine
        };
    }

    return {
        timestamp: formatLogTime(''),
        rawTimestamp: '',
        type: 'info',
        message: rawLine,
        raw: rawLine
    };
}

/* ========================================
   获取过滤后的日志
   ======================================== */
function getFilteredLogs() {
    const keyword = logSearchKeyword.trim().toLowerCase();

    return logs.filter(log => {
        const typeMatched = currentLogFilter === 'all' || log.type === currentLogFilter;
        if (!typeMatched) return false;

        if (!keyword) return true;

        const haystack = [log.timestamp, getLogTypeText(log.type), log.message].join(' ').toLowerCase();
        return haystack.includes(keyword);
    });
}

/* ========================================
   添加日志
   ======================================== */
function addLog(message, type = 'info') {
    logs.push({
        timestamp: formatLogTime(''),
        type: normalizeLogType(type),
        message: String(message ?? '')
    });

    if (logs.length > 500) {
        logs.shift();
    }

    renderLogs();
    updateLogFilterBadges();
}

/* ========================================
   渲染日志（终端文本流）
   ======================================== */
function renderLogs() {
    const container = document.getElementById('log-container');
    if (!container) return;

    const filteredLogs = getFilteredLogs();

    if (filteredLogs.length === 0) {
        container.innerHTML = \`
            <div class="log-empty-state">
                <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke-width="2"/>
                </svg>
                <p class="empty-text">\${currentLogFilter === 'all' ? '暂无日志' : '暂无' + getLogTypeText(currentLogFilter) + '日志'}</p>
            </div>
        \`;
        updateLogToolbarStatus(filteredLogs.length, logs.length);
        return;
    }

    const keyword = logSearchKeyword.trim();
    container.innerHTML = filteredLogs.map(log => {
        const level = normalizeLogType(log.type);
        const levelLabel = getLogTypeText(level).toUpperCase();
        const singleLineMessage = String(log.message || '').replace(/\s*\n\s*/g, ' ⏎ ');

        return \`
            <div class="log-line log-line-\${level}">
                <span class="log-line-time">[\${escapeLogText(log.timestamp)}]</span>
                <span class="log-line-level">\${escapeLogText(levelLabel)}</span>
                <span class="log-line-text">\${highlightLogMatch(singleLineMessage, keyword)}</span>
            </div>
        \`;
    }).join('');

    updateLogToolbarStatus(filteredLogs.length, logs.length);

    if (isLogAutoScrollEnabled) {
        container.scrollTop = container.scrollHeight;
    }
}

/* ========================================
   获取日志类型文本
   ======================================== */
function getLogTypeText(type) {
    const texts = {
        error: '错误',
        warn: '警告',
        info: '信息',
        success: '成功'
    };
    return texts[type] || '信息';
}

/* ========================================
   设置日志过滤器
   ======================================== */
function setLogFilter(filter) {
    currentLogFilter = filter;

    document.querySelectorAll('.log-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });

    renderLogs();
}

/* ========================================
   更新过滤器徽章数量
   ======================================== */
function updateLogFilterBadges() {
    const counts = {
        all: logs.length,
        error: logs.filter(l => l.type === 'error').length,
        warn: logs.filter(l => l.type === 'warn').length,
        info: logs.filter(l => l.type === 'info').length,
        success: logs.filter(l => l.type === 'success').length
    };

    Object.keys(counts).forEach(type => {
        const btn = document.querySelector(\`.log-filter-btn[data-filter="\${type}"]\`);
        if (!btn) return;
        const badge = btn.querySelector('.filter-badge');
        if (!badge) return;

        badge.textContent = counts[type];
        badge.style.display = counts[type] > 0 ? 'inline-flex' : 'none';
    });

    updateLogToolbarStatus(getFilteredLogs().length, logs.length);
}

/* ========================================
   更新日志工具栏统计
   ======================================== */
function updateLogToolbarStatus(visible, total) {
    const status = document.getElementById('log-toolbar-status');
    if (!status) return;
    status.textContent = \`显示 \${visible} / \${total} 条\`;
}

/* ========================================
   设置日志搜索关键字
   ======================================== */
function setLogSearch(value) {
    logSearchKeyword = String(value || '').trim();

    const clearBtn = document.getElementById('log-search-clear');
    if (clearBtn) {
        clearBtn.style.display = logSearchKeyword ? 'inline-flex' : 'none';
    }

    renderLogs();
}

/* ========================================
   清空日志搜索
   ======================================== */
function clearLogSearch() {
    const input = document.getElementById('log-search-input');
    if (input) {
        input.value = '';
    }
    setLogSearch('');
}

/* ========================================
   切换自动滚动
   ======================================== */
function toggleLogAutoScroll() {
    isLogAutoScrollEnabled = !isLogAutoScrollEnabled;

    const btn = document.getElementById('log-autoscroll-toggle');
    if (btn) {
        btn.classList.toggle('active', isLogAutoScrollEnabled);
        btn.textContent = isLogAutoScrollEnabled ? '自动滚动' : '手动滚动';
    }

    if (isLogAutoScrollEnabled) {
        const container = document.getElementById('log-container');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }
}

/* ========================================
   切换自动换行
   ======================================== */
function toggleLogWrap() {
    isLogWrapEnabled = !isLogWrapEnabled;

    const btn = document.getElementById('log-wrap-toggle');
    const container = document.getElementById('log-container');

    if (btn) {
        btn.classList.toggle('active', isLogWrapEnabled);
        btn.textContent = isLogWrapEnabled ? '自动换行' : '不换行';
    }

    if (container) {
        container.classList.toggle('log-wrap-enabled', isLogWrapEnabled);
        container.classList.toggle('log-wrap-disabled', !isLogWrapEnabled);
    }
}

/* ========================================
   复制当前可见日志
   ======================================== */
async function copyVisibleLogs() {
    const filteredLogs = getFilteredLogs();
    if (filteredLogs.length === 0) {
        customAlert('没有可复制的日志');
        return;
    }

    const text = filteredLogs.map(log => \`[\${log.timestamp}] \${log.type.toUpperCase()}: \${log.message}\`).join('\\n');

    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
        } else {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }
        customAlert('已复制当前可见日志');
    } catch (error) {
        customAlert('复制失败：' + error.message);
    }
}

/* ========================================
   从API获取真实日志
   ======================================== */
async function fetchRealLogs() {
    try {
        const response = await fetch(buildApiUrl('/api/logs'));
        if (!response.ok) {
            throw new Error(\`HTTP error! status: \${response.status}\`);
        }

        const logText = await response.text();
        const rawLines = logText.split('\\n');
        const mergedLines = [];

        rawLines.forEach(line => {
            if (!line) return;

            const isNewRecord = /^\\[[^\\]]+\\]\\s+[a-zA-Z]+:\\s*/.test(line);
            if (isNewRecord) {
                mergedLines.push(line);
                return;
            }

            if (mergedLines.length === 0) {
                if (line.trim()) {
                    mergedLines.push(line);
                }
                return;
            }

            mergedLines[mergedLines.length - 1] += '\\n' + line;
        });

        logs = mergedLines.map(line => {
            const parsed = parseLogLine(line);
            return {
                timestamp: parsed.timestamp,
                type: normalizeLogType(parsed.type),
                message: parsed.message
            };
        });

        renderLogs();
        updateLogFilterBadges();
    } catch (error) {
        console.error('Failed to fetch logs:', error);
        addLog(\`获取日志失败: \${error.message}\`, 'error');
    }
}

/* ========================================
   刷新日志
   ======================================== */
function refreshLogs() {
    const btn = document.getElementById('refreshLogsBtn') || event?.target?.closest('.btn');
    if (!btn) {
        fetchRealLogs();
        return;
    }

    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<span class="loading-spinner-small"></span> 刷新中...';
    btn.disabled = true;

    fetchRealLogs().finally(() => {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
    });
}

/* ========================================
   切换自动刷新
   ======================================== */
function toggleAutoRefresh() {
    const btn = document.getElementById('autoRefreshBtn');

    if (!btn) return;

    if (isAutoRefreshing) {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
            autoRefreshInterval = null;
        }

        isAutoRefreshing = false;
        btn.innerHTML = \`
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" stroke-width="2"/>
                <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke-width="2"/>
            </svg>
            自动刷新
        \`;
        btn.classList.remove('btn-success');
        btn.classList.add('btn-secondary');
        return;
    }

    isAutoRefreshing = true;
    btn.innerHTML = \`
        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke-width="2"/>
        </svg>
        停止刷新
    \`;
    btn.classList.remove('btn-secondary');
    btn.classList.add('btn-success');

    fetchRealLogs();
    autoRefreshInterval = setInterval(() => {
        fetchRealLogs();
    }, 3000);
}

/* ========================================
   导出日志
   ======================================== */
function exportLogs() {
    const filteredLogs = getFilteredLogs();

    if (filteredLogs.length === 0) {
        customAlert('没有可导出的日志');
        return;
    }

    const logText = filteredLogs.map(log => \`[\${log.timestamp}] \${getLogTypeText(log.type).toUpperCase()}: \${log.message}\`).join('\\n');

    const blob = new Blob([logText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = \`logs_\${currentLogFilter}_\${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt\`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    customAlert('日志已导出');
}

/* ========================================
   清空日志
   ======================================== */
async function clearLogs() {
    const configCheck = await checkDeployPlatformConfig();
    if (!configCheck.success) {
        customAlert(configCheck.message);
        return;
    }

    customConfirm('确定要清空所有日志吗?', '清空确认').then(async confirmed => {
        if (!confirmed) return;

        try {
            const response = await fetch(buildApiUrl('/api/logs/clear', true), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(\`HTTP error! status: \${response.status}\`);
            }

            const result = await response.json();
            if (result.success) {
                logs = [];
                renderLogs();
                updateLogFilterBadges();
                addLog('日志已清空', 'warn');
            } else {
                addLog(\`清空日志失败: \${result.message}\`, 'error');
            }
        } catch (error) {
            console.error('Failed to clear logs:', error);
            addLog(\`清空日志失败: \${error.message}\`, 'error');
        }
    });
}

/* ========================================
   兼容历史调用：该版本不再需要展开/收起
   ======================================== */
function toggleLogMessage() {}
`;
