// language=JavaScript
export const requestRecordsJsContent = /* javascript */ `
/* ========================================
   请求记录
   ======================================== */
let requestRecordsLoading = false;

function safeDecodeURIComponent(value) {
    try {
        return decodeURIComponent(value);
    } catch (e) {
        return value;
    }
}

function formatRequestParams(params) {
    if (!params || (typeof params === 'object' && Object.keys(params).length === 0)) {
        return '';
    }
    try {
        return JSON.stringify(params, null, 2);
    } catch (e) {
        return String(params);
    }
}

function renderRequestRecordsSummary(todayReqNum, total) {
    const todayEl = document.getElementById('request-records-today');
    const totalEl = document.getElementById('request-records-total');
    if (todayEl) todayEl.textContent = todayReqNum ?? 0;
    if (totalEl) totalEl.textContent = total ?? 0;
}

function renderRequestRecordsList(records) {
    const container = document.getElementById('request-records-list');
    if (!container) return;

    if (!records || records.length === 0) {
        container.innerHTML = `
            <div class="request-records-empty">
                <div class="request-records-empty-icon">📭</div>
                <div class="request-records-empty-text">暂无请求记录</div>
            </div>
        `;
        return;
    }

    container.innerHTML = records.map(record => {
        const method = (record.method || 'GET').toUpperCase();
        const path = safeDecodeURIComponent(record.interface || '');
        const clientIp = record.clientIp || '未知IP';
        const timeText = record.timestamp ? new Date(record.timestamp).toLocaleString('zh-CN') : '未知时间';
        const paramsText = formatRequestParams(record.params);

        return `
            <div class="form-card request-record-card">
                <div class="request-record-header">
                    <span class="request-record-method">${method}</span>
                    <span class="request-record-path">${path || '未知接口'}</span>
                </div>
                <div class="request-record-meta">
                    <span class="request-record-ip">${clientIp}</span>
                    <span class="request-record-time">${timeText}</span>
                </div>
                ${paramsText ? `
                    <div class="request-record-params">
                        <div class="request-record-params-title">请求参数</div>
                        <pre>${paramsText}</pre>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

async function refreshRequestRecords() {
    if (requestRecordsLoading) return;
    const container = document.getElementById('request-records-list');
    if (!container) return;

    requestRecordsLoading = true;
    container.innerHTML = `
        <div class="request-records-loading">正在获取请求记录...</div>
    `;

    try {
        const response = await fetch(buildApiUrl('/api/reqrecords'));
        if (!response.ok) {
            throw new Error('获取请求记录失败');
        }
        const data = await response.json();
        const records = Array.isArray(data.records) ? data.records : [];
        const todayReqNum = data.todayReqNum ?? 0;

        renderRequestRecordsSummary(todayReqNum, records.length);
        renderRequestRecordsList(records);
    } catch (error) {
        console.error('获取请求记录失败:', error);
        renderRequestRecordsSummary(0, 0);
        container.innerHTML = `
            <div class="request-records-empty">
                <div class="request-records-empty-icon">⚠️</div>
                <div class="request-records-empty-text">${error.message || '获取失败'}</div>
            </div>
        `;
    } finally {
        requestRecordsLoading = false;
    }
}

window.refreshRequestRecords = refreshRequestRecords;

document.addEventListener('DOMContentLoaded', function() {
    const refreshBtn = document.getElementById('btnRequestRecordsRefresh');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshRequestRecords);
    }
});
`;
