// language=JavaScript
export const systemSettingsJsContent = /* javascript */ `
/* ========================================
   系统配置状态管理
   ======================================== */
let deploymentInProgress = false;
let cacheClearing = false;
// [新增] 合并模式全局变量
let isMergeMode = false;
let stagingTags = [];
let timelineOffsetSourceOptions = ['all'];

/* ========================================
   显示/隐藏清理缓存模态框
   ======================================== */
function showClearCacheModal() {
    document.getElementById('clear-cache-modal').classList.add('active');
    
    // 添加模态框显示动画
    const modal = document.getElementById('clear-cache-modal');
    const modalContainer = modal.querySelector('.modal-container');
    if (modalContainer) {
        modalContainer.style.animation = 'modalSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
    }
}

function hideClearCacheModal() {
    const modal = document.getElementById('clear-cache-modal');
    const modalContainer = modal.querySelector('.modal-container');
    
    if (modalContainer) {
        modalContainer.style.animation = 'modalSlideOut 0.3s ease-out';
        setTimeout(() => {
            modal.classList.remove('active');
        }, 300);
    } else {
        modal.classList.remove('active');
    }
}

/* ========================================
   确认清理缓存
   ======================================== */
async function confirmClearCache() {
    const configCheck = await checkDeployPlatformConfig();
    if (!configCheck.success) {
        hideClearCacheModal();
        customAlert(configCheck.message, '⚙️ 配置提示');
        return;
    }

    if (cacheClearing) {
        customAlert('缓存清理正在进行中，请稍候...', '⏳ 请稍候');
        return;
    }

    hideClearCacheModal();
    cacheClearing = true;
    
    showLoading('🗑️ 正在清理缓存...', '正在清除所有缓存数据');
    addLog('🗑️ 开始清理缓存', 'info');

    try {
        // 添加进度条动画
        const progressBar = document.getElementById('progress-bar-top');
        if (progressBar) {
            progressBar.classList.add('active');
            let progress = 0;
            const progressInterval = setInterval(() => {
                progress += Math.random() * 15;
                if (progress >= 90) {
                    clearInterval(progressInterval);
                    progress = 90;
                }
                progressBar.style.width = progress + '%';
            }, 200);
            
            setTimeout(() => clearInterval(progressInterval), 3000);
        }

        const response = await fetch(buildApiUrl('/api/cache/clear', true), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();

        if (progressBar) {
            progressBar.style.width = '100%';
            setTimeout(() => {
                progressBar.classList.remove('active');
                progressBar.style.width = '0%';
            }, 500);
        }

        if (result.success) {
            updateLoadingText('✅ 清理完成', '缓存已成功清除');
            
            // 显示清理详情
            const clearedItems = result.clearedItems || {};
            const details = Object.entries(clearedItems)
                .map(([key, value]) => \`  • \${key}: \${value}\`)
                .join('\\n');
            
            addLog('✅ 缓存清理完成！', 'success');
            addLog('清理详情：\\n' + details, 'info');
            
            // 显示成功动画
            showSuccessAnimation('缓存清理成功');
        } else {
            updateLoadingText('❌ 清理失败', '请查看日志了解详情');
            addLog(\`❌ 缓存清理失败: \${result.message}\`, 'error');
            
            setTimeout(() => {
                hideLoading();
                customAlert('缓存清理失败: ' + result.message, '❌ 操作失败');
            }, 1500);
        }
    } catch (error) {
        updateLoadingText('❌ 清理失败', '网络错误或服务不可用');
        addLog(\`❌ 缓存清理请求失败: \${error.message}\`, 'error');
        
        setTimeout(() => {
            hideLoading();
            customAlert('缓存清理失败: ' + error.message, '❌ 网络错误');
        }, 1500);
    } finally {
        setTimeout(() => {
            hideLoading();
            cacheClearing = false;
        }, 2000);
    }
}

/* ========================================
   显示/隐藏重新部署模态框
   ======================================== */
function showDeploySystemModal() {
    document.getElementById('deploy-system-modal').classList.add('active');
    
    // 添加模态框显示动画
    const modal = document.getElementById('deploy-system-modal');
    const modalContainer = modal.querySelector('.modal-container');
    if (modalContainer) {
        modalContainer.style.animation = 'modalSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
    }
}

function hideDeploySystemModal() {
    const modal = document.getElementById('deploy-system-modal');
    const modalContainer = modal.querySelector('.modal-container');
    
    if (modalContainer) {
        modalContainer.style.animation = 'modalSlideOut 0.3s ease-out';
        setTimeout(() => {
            modal.classList.remove('active');
        }, 300);
    } else {
        modal.classList.remove('active');
    }
}

/* ========================================
   确认重新部署系统
   ======================================== */
function confirmDeploySystem() {
    if (deploymentInProgress) {
        customAlert('部署正在进行中，请稍候...', '⏳ 请稍候');
        return;
    }

    checkDeployPlatformConfig().then(configCheck => {
        if (!configCheck.success) {
            hideDeploySystemModal();
            customAlert(configCheck.message, '⚙️ 配置提示');
            return;
        }

        hideDeploySystemModal();
        deploymentInProgress = true;
        
        showLoading('🚀 准备部署...', '正在检查系统状态');
        addLog('========================================', 'info');
        addLog('🚀 开始系统部署流程', 'info');
        addLog('========================================', 'info');

        fetch(buildApiUrl('/api/config', true))
            .then(response => response.json())
            .then(config => {
                const deployPlatform = config.envs.deployPlatform || 'node';
                addLog(\`📋 检测到部署平台: \${deployPlatform}\`, 'info');

                const platform = deployPlatform.toLowerCase();
                if (platform === 'node' || platform === 'nodejs' || platform === 'docker') {
                    updateLoadingText('⚙️ 本地/Docker 部署模式', '环境变量自动生效中...');
                    
                    setTimeout(() => {
                        hideLoading();
                        deploymentInProgress = false;
                        
                        addLog('========================================', 'success');
                        addLog('✅ 本地/Docker 部署模式，环境变量已生效', 'success');
                        addLog('========================================', 'success');
                        
                        showSuccessAnimation('配置已生效');
                        
                        customAlert(
                            '✅ 本地/Docker 部署模式\\n\\n在本地或 Docker 部署模式下，环境变量修改后会自动生效，无需重新部署。系统已更新配置！',
                            '🎉 配置成功'
                        );
                    }, 1500);
                } else {
                    updateLoadingText('☁️ 云端部署', '正在触发云端部署...');
                    
                    fetch(buildApiUrl('/api/deploy', true), {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    })
                    .then(response => response.json())
                    .then(result => {
                        if (result.success) {
                            addLog('✅ 云端部署触发成功', 'success');
                            simulateDeployProcess(deployPlatform);
                        } else {
                            hideLoading();
                            deploymentInProgress = false;
                            
                            addLog(\`❌ 云端部署失败: \${result.message}\`, 'error');
                            customAlert('云端部署失败: ' + result.message, '❌ 部署失败');
                        }
                    })
                    .catch(error => {
                        hideLoading();
                        deploymentInProgress = false;
                        
                        addLog(\`❌ 云端部署请求失败: \${error.message}\`, 'error');
                        customAlert('云端部署请求失败: ' + error.message, '❌ 网络错误');
                    });
                }
            })
            .catch(error => {
                hideLoading();
                deploymentInProgress = false;
                
                addLog(\`❌ 获取部署平台信息失败: \${error.message}\`, 'error');
                console.error('获取部署平台信息失败:', error);
                customAlert('获取部署平台信息失败: ' + error.message, '❌ 配置错误');
            });
    });
}

/* ========================================
   模拟云端部署过程
   ======================================== */
function simulateDeployProcess(platform) {
    let progress = 0;
    const progressBar = document.getElementById('progress-bar-top');
    progressBar.classList.add('active');
    progressBar.style.width = '0%';
    
    // 平滑的进度条动画
    const progressInterval = setInterval(() => {
        progress += Math.random() * 3;
        if (progress >= 95) {
            progress = 95;
            clearInterval(progressInterval);
        }
        progressBar.style.width = progress + '%';
    }, 300);

    const steps = [
        { 
            delay: 1000, 
            text: '📋 检查环境变量...', 
            detail: '验证配置文件完整性', 
            log: '✅ 配置文件验证通过',
            progress: 10
        },
        { 
            delay: 3000, 
            text: '☁️ 触发云端部署...', 
            detail: \`部署到 \${platform} 平台\`, 
            log: \`✅ \${platform} 云端部署已触发\`,
            progress: 25
        },
        { 
            delay: 8000, 
            text: '🔨 构建项目...', 
            detail: '编译代码和依赖', 
            log: '✅ 项目构建完成',
            progress: 50
        },
        { 
            delay: 6000, 
            text: '📦 部署更新...', 
            detail: '发布到生产环境', 
            log: '✅ 更新已成功部署',
            progress: 70
        },
        { 
            delay: 5000, 
            text: '🔄 服务重启...', 
            detail: '应用新配置', 
            log: '✅ 服务已成功重启',
            progress: 85
        },
        { 
            delay: 4000, 
            text: '🔍 健康检查...', 
            detail: '验证服务状态', 
            log: '✅ 所有服务运行正常',
            progress: 95
        },
    ];

    let totalDelay = 0;
    steps.forEach((step, index) => {
        totalDelay += step.delay;
        setTimeout(() => {
            updateLoadingText(step.text, step.detail);
            addLog(step.log, 'success');
            progressBar.style.width = step.progress + '%';
            
            // 添加脉冲效果
            const loadingContent = document.querySelector('.loading-content');
            if (loadingContent) {
                loadingContent.style.animation = 'pulse 0.6s ease-out';
                setTimeout(() => {
                    loadingContent.style.animation = '';
                }, 600);
            }
        }, totalDelay);
    });

    setTimeout(() => {
        checkDeploymentStatus();
    }, totalDelay + 2000);
}

/* ========================================
   检查部署状态
   ======================================== */
function checkDeploymentStatus() {
    updateLoadingText('🔍 检查服务状态...', '正在验证部署结果');
    addLog('🔍 正在检查服务状态...', 'info');
    
    let checkCount = 0;
    const maxChecks = 6;
    
    const checkInterval = setInterval(() => {
        checkCount++;
        updateLoadingText('🔍 检查服务状态...', \`第 \${checkCount}/\${maxChecks} 次检查\`);
        addLog(\`📡 服务检查中 - 第 \${checkCount} 次尝试\`, 'info');

        fetch(buildApiUrl('/api/config', true))
            .then(response => {
                if (response.ok || checkCount >= maxChecks) {
                    clearInterval(checkInterval);
                    
                    const progressBar = document.getElementById('progress-bar-top');
                    progressBar.style.width = '100%';
                    
                    updateLoadingText('✅ 部署完成！', '服务已重启并正常运行');
                    addLog('========================================', 'success');
                    addLog('🎉 部署成功！服务已重启，配置已生效', 'success');
                    addLog('========================================', 'success');
                    
                    setTimeout(() => {
                        hideLoading();
                        progressBar.classList.remove('active');
                        progressBar.style.width = '0%';
                        deploymentInProgress = false;
                        
                        showSuccessAnimation('部署成功');
                        
                        customAlert(
                            '🎉 部署成功！\\n\\n云端部署已完成\\n服务已重启\\n配置已生效',
                            '✅ 部署完成'
                        );
                    }, 2000);
                } else {
                    addLog(\`⏳ 服务检查中 - 状态码: \${response.status}\`, 'info');
                }
            })
            .catch(error => {
                if (checkCount >= maxChecks) {
                    clearInterval(checkInterval);
                    
                    const progressBar = document.getElementById('progress-bar-top');
                    progressBar.style.width = '100%';
                    
                    updateLoadingText('✅ 部署确认完成', '服务正在启动中');
                    addLog('========================================', 'warn');
                    addLog('⚠️ 部署已完成，服务可能需要几分钟启动', 'warn');
                    addLog('========================================', 'warn');
                    
                    setTimeout(() => {
                        hideLoading();
                        progressBar.classList.remove('active');
                        progressBar.style.width = '0%';
                        deploymentInProgress = false;
                        
                        showSuccessAnimation('部署已提交');
                        
                        customAlert(
                            '✅ 部署已提交！\\n\\n云端部署已完成\\n服务正在启动中\\n请稍候几分钟后刷新页面',
                            '⏳ 部署完成'
                        );
                    }, 2000);
                } else {
                    addLog(\`⏳ 服务检查中 - 连接失败，继续尝试\`, 'info');
                }
            });
    }, 5000);
}

/* ========================================
   显示成功动画
   ======================================== */
function showSuccessAnimation(message) {
    const successOverlay = document.createElement('div');
    successOverlay.className = 'success-overlay';
    successOverlay.innerHTML = \`
        <div class="success-content">
            <div class="success-icon">✅</div>
            <h3 class="success-message">\${message}</h3>
        </div>
    \`;
    
    document.body.appendChild(successOverlay);
    
    setTimeout(() => {
        successOverlay.style.animation = 'successFadeOut 0.5s ease-out';
        setTimeout(() => {
            successOverlay.remove();
        }, 500);
    }, 2000);
}

/* ========================================
   检查管理员令牌
   ======================================== */
function checkAdminToken() {
    let _reverseProxy = customBaseUrl; // 使用全局变量 customBaseUrl

    // 获取URL路径并提取token
    let urlPath = window.location.pathname;
    
    // 如果配置了反代路径，必须先剥离它
    if(_reverseProxy) {
        try {
            // 解析配置中的路径部分，例如 http://192.168.8.1:2333/danmu_api => /danmu_api
            let proxyPath = _reverseProxy.startsWith('http') 
                ? new URL(_reverseProxy).pathname 
                : _reverseProxy;
            
            // 确保移除尾部斜杠
            if (proxyPath.endsWith('/')) {
                proxyPath = proxyPath.slice(0, -1);
            }
            
            // 如果当前URL包含此前缀，则移除它
            if(proxyPath && urlPath.startsWith(proxyPath)) {
                urlPath = urlPath.substring(proxyPath.length);
            }
        } catch(e) {
            console.error("解析反代路径失败", e);
        }
    }

    const pathParts = urlPath.split('/').filter(part => part !== '');
    const urlToken = pathParts.length > 0 ? pathParts[0] : currentToken; // 如果没有路径段，使用默认token
    
    // 检查是否配置了ADMIN_TOKEN且URL中的token等于currentAdminToken
    return currentAdminToken && currentAdminToken.trim() !== '' && urlToken === currentAdminToken;
}

/* ========================================
   检查部署平台配置
   ======================================== */
async function checkDeployPlatformConfig() {
    if (!checkAdminToken()) {
        // 获取当前页面的协议、主机和端口
        const protocol = window.location.protocol;
        const host = window.location.host;
        
        let displayBase;
        if (customBaseUrl) {
            displayBase = customBaseUrl.startsWith('http') 
                ? customBaseUrl 
                : (protocol + '//' + host + customBaseUrl);
        } else {
            displayBase = protocol + '//' + host;
        }

        if (displayBase.endsWith('/')) {
            displayBase = displayBase.slice(0, -1);
        }
        
        return { 
            success: false, 
            message: \`🔒 需要管理员权限！\\n\\n请先配置 ADMIN_TOKEN 环境变量并使用正确的 token 访问以启用系统管理功能。\\n\\n访问方式：\${displayBase}/{ADMIN_TOKEN}\`
        };
    }
    
    try {
        const config = await fetchUiConfig();
        const deployPlatform = config.envs.deployPlatform || 'node';
        
        const platform = deployPlatform.toLowerCase();
        if (platform === 'node' || platform === 'nodejs' || platform === 'docker') {
            return { success: true, message: '本地/Docker 部署平台，仅需配置ADMIN_TOKEN' };
        }
        
        const missingVars = [];
        const deployPlatformProject = config.originalEnvVars.DEPLOY_PLATFROM_PROJECT;
        const deployPlatformToken = config.originalEnvVars.DEPLOY_PLATFROM_TOKEN;
        const deployPlatformAccount = config.originalEnvVars.DEPLOY_PLATFROM_ACCOUNT;
        
        if (!deployPlatformProject || deployPlatformProject.trim() === '') {
            missingVars.push('DEPLOY_PLATFROM_PROJECT');
        }
        
        if (!deployPlatformToken || deployPlatformToken.trim() === '') {
            missingVars.push('DEPLOY_PLATFROM_TOKEN');
        }
        
        if (deployPlatform.toLowerCase() === 'netlify' || deployPlatform.toLowerCase() === 'cloudflare') {
            if (!deployPlatformAccount || deployPlatformAccount.trim() === '') {
                missingVars.push('DEPLOY_PLATFROM_ACCOUNT');
            }
        }
        
        if (missingVars.length > 0) {
            const missingVarsStr = missingVars.join('、');
            return { 
                success: false, 
                message: \`⚙️ 配置不完整！\\n\\n部署平台为 \${deployPlatform}，请配置以下缺失的环境变量：\\n\\n\${missingVars.map(v => '• ' + v).join('\\n')}\`
            };
        }
        
        return { success: true, message: deployPlatform + '部署平台配置完整' };
    } catch (error) {
        console.error('检查部署平台配置失败:', error);
        return { 
            success: false, 
            message: \`❌ 检查配置失败\\n\\n\${error.message}\`
        };
    }
}

/* ========================================
   获取并设置配置信息
   ======================================== */
async function fetchAndSetConfig() {
    const config = await fetchUiConfig({ force: true });
    currentAdminToken = config.originalEnvVars?.ADMIN_TOKEN || '';
    return config;
}

/* ========================================
   检查并处理管理员令牌
   ======================================== */
function checkAndHandleAdminToken() {
    if (!checkAdminToken()) {
        const envNavBtn = document.getElementById('env-nav-btn');
        if (envNavBtn) {
            envNavBtn.title = '🔒 请先配置ADMIN_TOKEN并使用正确的admin token访问以启用系统管理功能';
        }
    }
}

/* ========================================
   渲染环境变量列表
   ======================================== */
function renderEnvList() {
    const list = document.getElementById('env-list');
    const items = envVariables[currentCategory] || [];

    if (items.length === 0) {
        list.innerHTML = \`
            <div class="env-empty-state">
                <div class="empty-icon">📋</div>
                <h3>暂无配置项</h3>
                <p>该类别下还没有配置项</p>
            </div>
        \`;
        return;
    }

    list.innerHTML = items.map((item, index) => {
        const typeLabel = item.type === 'boolean' ? 'bool' :
                         item.type === 'number' ? 'num' :
                         item.type === 'select' ? 'select' :
                         item.type === 'multi-select' ? 'multi' :
                         item.type === 'map' ? 'map' :
                         item.type === 'timeline-offset' ? 'offset' :
                         item.type === 'color-list' ? 'color' : 'text';
        const badgeClass = item.type === 'multi-select' ? 'multi' : 
                          item.type === 'color-list' ? 'color' :
                          (item.type === 'map' || item.type === 'timeline-offset') ? 'map' : '';

        return \`
            <div class="env-item"\${getEntryAnimationStyle(index, 0.05)}>
                <div class="env-info">
                    <div class="env-key">
                        <strong>\${item.key}</strong>
                        <span class="value-type-badge \${badgeClass}">\${typeLabel}</span>
                    </div>
                    <code class="env-value">\${escapeHtml(item.value)}</code>
                    <span class="env-desc">\${item.description || ''}</span>
                </div>
                <div class="env-actions">
                    <button class="btn btn-primary btn-sm" onclick="editEnv(\${index})" title="编辑">
                        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        <span>编辑</span>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteEnv(\${index})" title="删除">
                        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                        <span>删除</span>
                    </button>
                </div>
            </div>
        \`;
    }).join('');
}

/* ========================================
   编辑环境变量
   ======================================== */
function editEnv(index) {
    const item = envVariables[currentCategory][index];
    const editButton = event.target.closest('.btn');
    
    const originalText = editButton.innerHTML;
    editButton.innerHTML = '<span class="loading-spinner-small"></span>';
    editButton.disabled = true;
    
    editingKey = index;
    document.getElementById('modal-title').textContent = '✏️ 编辑配置项';
    document.getElementById('env-category').value = currentCategory;
    document.getElementById('env-key').value = item.key;
    document.getElementById('env-description').value = item.description || '';
    
    // 确保 type 字段正确设置，如果没有 type 则根据内容判断
    let itemType = item.type || 'text';
    
    // 如果没有明确的 type，但有 colors 数组，说明是 color-list
    if (!item.type && item.colors && Array.isArray(item.colors)) {
        itemType = 'color-list';
    }
    
    document.getElementById('value-type').value = itemType;

    document.getElementById('env-category').disabled = true;
    document.getElementById('env-key').readOnly = true;
    document.getElementById('value-type').disabled = true;
    document.getElementById('env-description').readOnly = true;

    renderValueInput(item);

    document.getElementById('env-modal').classList.add('active');
    
    editButton.innerHTML = originalText;
    editButton.disabled = false;
}

/* ========================================
   删除环境变量
   ======================================== */
function deleteEnv(index) {
    const item = envVariables[currentCategory][index];
    const key = item.key;
    
    customConfirm(
        \`确定要删除配置项 "\${key}" 吗？\\n\\n此操作不可恢复！\`,
        '🗑️ 删除确认'
    ).then(confirmed => {
        if (confirmed) {
            const deleteButton = event.target.closest('.btn');
            const originalText = deleteButton.innerHTML;
            const envItem = deleteButton.closest('.env-item');
            
            deleteButton.innerHTML = '<span class="loading-spinner-small"></span>';
            deleteButton.disabled = true;

            addLog(\`🗑️ 开始删除配置项: \${key}\`, 'info');

            fetch(buildApiUrl('/api/env/del'), {
            method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ key })
            })
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    // 添加删除动画（在元素还存在时）
                    if (envItem && envItem.style) {
                        envItem.style.animation = 'fadeOutRight 0.4s ease-out';
                    }
                    
                    setTimeout(() => {
                        addLog(\`✅ 成功删除配置项: \${key}\`, 'success');
                        
                        // 显示删除成功提示并设置刷新回调
                        showDeleteSuccessAndRefresh(key);
                    }, 400);
                } else {
                    if (deleteButton && deleteButton.innerHTML) {
                        deleteButton.innerHTML = originalText;
                        deleteButton.disabled = false;
                    }
                    addLog(\`❌ 删除配置项失败: \${result.message}\`, 'error');
                    customAlert('删除配置项失败: ' + result.message, '❌ 删除失败');
                }
            })
            .catch(error => {
                if (deleteButton && deleteButton.innerHTML) {
                    deleteButton.innerHTML = originalText;
                    deleteButton.disabled = false;
                }
                addLog(\`❌ 删除配置项失败: \${error.message}\`, 'error');
                customAlert('删除配置项失败: ' + error.message, '❌ 网络错误');
            });
        }
    });
}

/* ========================================
   显示删除成功提示并刷新
   ======================================== */
function showDeleteSuccessAndRefresh(key) {
    // 创建自定义弹窗
    const overlay = document.createElement('div');
    overlay.className = 'custom-dialog-overlay';
    overlay.style.zIndex = '10001';
    overlay.innerHTML = \`
        <div class="custom-dialog-container" style="animation: modalSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);">
            <div class="custom-dialog-header">
                <h3>🎉 删除成功</h3>
            </div>
            <div class="custom-dialog-body">
                <p>✅ 删除成功！</p>
                <p>配置项 "\${escapeHtml(key)}" 已删除</p>
                <p>点击确认后将刷新页面以显示最新配置</p>
            </div>
            <div class="custom-dialog-actions">
                <button type="button" class="btn btn-primary" id="confirm-refresh-btn" style="width: 100%;">
                    <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <polyline points="20 6 9 17 4 12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span>确认</span>
                </button>
            </div>
        </div>
    \`;
    
    document.body.appendChild(overlay);
    
    // 绑定确认按钮事件
    const confirmBtn = overlay.querySelector('#confirm-refresh-btn');
    confirmBtn.addEventListener('click', function() {
        // 关闭弹窗
        const container = overlay.querySelector('.custom-dialog-container');
        container.style.animation = 'modalSlideOut 0.3s ease-out';
        
        setTimeout(() => {
            overlay.remove();
            
            // 显示加载状态
            showLoading('🔄 刷新页面中...', '即将显示最新配置');
            addLog('🔄 刷新页面以显示最新配置', 'info');
            
            // 延迟刷新页面
            setTimeout(() => {
                location.reload();
            }, 500);
        }, 300);
    });
    
    // 点击背景关闭
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            confirmBtn.click();
        }
    });
}

/* ========================================
   显示删除成功提示并刷新
   ======================================== */
function showDeleteSuccessAndRefresh(key) {
    // 创建自定义弹窗
    const overlay = document.createElement('div');
    overlay.className = 'custom-dialog-overlay';
    overlay.style.zIndex = '10001';
    overlay.innerHTML = \`
        <div class="custom-dialog-container" style="animation: modalSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);">
            <div class="custom-dialog-header">
                <h3>🎉 删除成功</h3>
            </div>
            <div class="custom-dialog-body">
                <p>✅ 删除成功！</p>
                <p>配置项 "\${escapeHtml(key)}" 已删除</p>
                <p>点击确认后将刷新页面以显示最新配置</p>
            </div>
            <div class="custom-dialog-actions">
                <button type="button" class="btn btn-primary" id="confirm-refresh-btn" style="width: 100%;">
                    <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <polyline points="20 6 9 17 4 12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span>确认</span>
                </button>
            </div>
        </div>
    \`;
    
    document.body.appendChild(overlay);
    
    // 绑定确认按钮事件
    const confirmBtn = overlay.querySelector('#confirm-refresh-btn');
    confirmBtn.addEventListener('click', function() {
        // 关闭弹窗
        const container = overlay.querySelector('.custom-dialog-container');
        container.style.animation = 'modalSlideOut 0.3s ease-out';
        
        setTimeout(() => {
            overlay.remove();
            
            // 显示加载状态
            showLoading('🔄 刷新页面中...', '即将显示最新配置');
            addLog('🔄 刷新页面以显示最新配置', 'info');
            
            // 延迟刷新页面
            setTimeout(() => {
                location.reload();
            }, 500);
        }, 300);
    });
    
    // 点击背景关闭
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            confirmBtn.click();
        }
    });
}

/* ========================================
   关闭模态框
   ======================================== */
function closeModal() {
    const modal = document.getElementById('env-modal');
    const modalContainer = modal.querySelector('.modal-container');
    hideTimelineOffsetModal();
    
    if (modalContainer) {
        modalContainer.style.animation = 'modalSlideOut 0.3s ease-out';
        setTimeout(() => {
            modal.classList.remove('active');
            
            // 重置表单状态
            document.getElementById('env-category').disabled = false;
            document.getElementById('env-key').readOnly = false;
            document.getElementById('value-type').disabled = false;
            document.getElementById('env-description').readOnly = false;
        }, 300);
    } else {
        modal.classList.remove('active');
    }
}

/* ========================================
   加载遮罩控制
   ======================================== */
function showLoading(text, detail) {
    document.getElementById('loading-text').textContent = text;
    document.getElementById('loading-detail').textContent = detail;
    document.getElementById('loading-overlay').classList.add('active');
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    const loadingContent = overlay.querySelector('.loading-content');
    
    if (loadingContent) {
        loadingContent.style.animation = 'modalSlideOut 0.3s ease-out';
        setTimeout(() => {
            overlay.classList.remove('active');
        }, 300);
    } else {
        overlay.classList.remove('active');
    }
}

function updateLoadingText(text, detail) {
    const textElement = document.getElementById('loading-text');
    const detailElement = document.getElementById('loading-detail');
    
    // 添加更新动画
    textElement.style.animation = 'fadeIn 0.3s ease-out';
    detailElement.style.animation = 'fadeIn 0.3s ease-out';
    
    textElement.textContent = text;
    detailElement.textContent = detail;
}

/* ========================================
   表单提交 (修复类型丢失问题版)
   ======================================== */
document.getElementById('env-form').addEventListener('submit', async function(e) {
    e.preventDefault();

    const category = document.getElementById('env-category').value;
    const key = document.getElementById('env-key').value.trim();
    const description = document.getElementById('env-description').value.trim();
    
    // 🛠️ 核心修复：不完全依赖 value-type 的值，而是根据界面元素反推真实类型
    // 这能防止 color-list 因为选项缺失被误保存为 text
    let type = document.getElementById('value-type').value;
    
    if (document.getElementById('color-pool-container')) {
        type = 'color-list'; // 强制修正为颜色列表
    } else if (document.getElementById('bool-value')) {
        type = 'boolean';
    } else if (document.getElementById('num-slider')) {
        type = 'number';
    } else if (document.querySelector('.tag-selector')) {
        type = 'select';
    } else if (document.querySelector('.multi-select-container')) {
        type = 'multi-select';
    }

    let value, itemData;

    try {
        if (type === 'boolean') {
            value = document.getElementById('bool-value').checked ? 'true' : 'false';
            itemData = { key, value, description, type };
        } else if (type === 'number') {
            value = document.getElementById('num-value').textContent;
            const min = parseInt(document.getElementById('num-slider').min);
            const max = parseInt(document.getElementById('num-slider').max);
            itemData = { key, value, description, type, min, max };
        } else if (type === 'select') {
            const selected = document.querySelector('.tag-option.selected');
            value = selected ? selected.dataset.value : '';
            const options = Array.from(document.querySelectorAll('.tag-option')).map(el => el.dataset.value);
            itemData = { key, value, description, type, options };
        } else if (type === 'multi-select') {
            // [新增] 如果开启了合并模式，且暂存区还有内容，自动将其视为确认添加
            if (isMergeMode && stagingTags && stagingTags.length > 0) {
                confirmMergeGroup();
            }

            const selectedTags = Array.from(document.querySelectorAll('.selected-tag'))
                .map(el => el.dataset.value);
            value = selectedTags.join(',');
            const options = Array.from(document.querySelectorAll('.available-tag')).map(el => el.dataset.value);
            itemData = { key, value, description, type, options };
        } else if (type === 'map') {
            // 获取映射表值
            const mapItems = document.querySelectorAll('#map-container .map-item:not(.map-item-template)');
            const pairs = [];
            mapItems.forEach(item => {
                const leftInput = item.querySelector('.map-input-left');
                const rightInput = item.querySelector('.map-input-right');
                const leftValue = leftInput.value.trim();
                const rightValue = rightInput.value.trim();
                if (leftValue && rightValue) {
                    pairs.push(leftValue + '->' + rightValue);
                }
            });
            value = pairs.join(';');
            itemData = { key, value, description, type };
        } else if (type === 'timeline-offset') {
            const lineInputs = document.querySelectorAll('#timeline-offset-container .timeline-offset-line-input');
            const pairs = [];
            lineInputs.forEach(input => {
                const lineValue = input.value ? input.value.trim() : '';
                if (!lineValue || !lineValue.includes(':')) return;
                pairs.push(lineValue);
            });
            value = pairs.join(',');
            itemData = { key, value, description, type };
        } else if (type === 'color-list') {
            // 安全获取 text-value
            const hiddenInput = document.getElementById('text-value');
            if (!hiddenInput) {
                // 如果找不到隐藏域，尝试从颜色块重建数据，防止报错
                const chips = document.querySelectorAll('#color-pool-container .color-chip');
                const values = Array.from(chips).map(chip => chip.dataset.value);
                value = values.join(',');
            } else {
                value = hiddenInput.value.trim();
            }
            // 保存当前的颜色数据，用于重新渲染
            const currentColors = value.split(',').map(v => parseInt(v.trim(), 10)).filter(v => !isNaN(v));
            itemData = { key, value, description, type, colors: currentColors };
        } else {
            const textInput = document.getElementById('text-value');
            value = textInput ? textInput.value.trim() : '';
            itemData = { key, value, description, type };
        }
    } catch (err) {
        customAlert('获取表单数据失败: ' + err.message, '❌ 错误');
        return;
    }

    // 显示保存中状态
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="loading-spinner-small"></span> <span>保存中...</span>';
    submitBtn.disabled = true;

    try {
        let response = await fetch(buildApiUrl('/api/env/set'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ key, value })
        });

        let result = await response.json();

        if (!result.success) {
            // 如果 set 失败，尝试 add
            response = await fetch(buildApiUrl('/api/env/add'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ key, value })
            });
            result = await response.json();
        }

        if (result.success) {
            if (!envVariables[category]) {
                envVariables[category] = [];
            }

            // 更新本地数据
            if (editingKey !== null) {
                // 确保保留原有的 type 和 colors 结构，防止退化为 text
                envVariables[currentCategory][editingKey] = {
                    ...envVariables[currentCategory][editingKey], // 保留旧属性
                    ...itemData // 覆盖新属性
                };
                addLog(\`✅ 更新配置项: \${key}\`, 'success');
            } else {
                envVariables[category].push(itemData);
                addLog(\`✅ 添加配置项: \${key}\`, 'success');
            }

            // 如果类别改变，切换标签
            if (category !== currentCategory) {
                currentCategory = category;
                document.querySelectorAll('.tab-btn').forEach((btn, i) => {
                    btn.classList.toggle('active', ['api', 'source', 'match', 'danmu', 'cache', 'system'][i] === category);
                });
            }

            renderEnvList();
            
            // 安全调用 renderPreview
            if (typeof renderPreview === 'function') {
                renderPreview();
            }
            
            // 成功动画
            submitBtn.innerHTML = '<span>✅</span> <span>保存成功!</span>';
            submitBtn.style.background = 'var(--success-color)';
            
            setTimeout(() => {
                closeModal();
                setTimeout(() => {
                    submitBtn.innerHTML = originalText;
                    submitBtn.style.background = '';
                    submitBtn.disabled = false;
                }, 300);
            }, 1000);
        } else {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            addLog(\`❌ 操作失败: \${result.message}\`, 'error');
            customAlert('操作失败: ' + result.message, '❌ 保存失败');
        }
    } catch (error) {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        console.error(error);
        addLog(\`❌ 更新环境变量失败: \${error.message}\`, 'error');
        customAlert('更新环境变量失败: ' + error.message, '❌ 网络错误');
    }
});

/* 值输入渲染函数保持不变 */
function renderValueInput(item) {
    const container = document.getElementById('value-input-container');
    const type = item ? item.type : document.getElementById('value-type').value;
    const value = item ? item.value : '';
    const currentKey = item ? item.key : (document.getElementById('env-key') ? document.getElementById('env-key').value : '');

    if (type === 'boolean') {
        let checked;
        if (currentKey === 'REMEMBER_LAST_SELECT') {
            checked = value === 'true' || value === true || (value === '' || value === undefined || value === null);
        } else {
            checked = value === 'true' || value === true;
        }
        container.innerHTML = \`
            <label class="form-label">值</label>
            <div class="switch-container">
                <label class="switch">
                    <input type="checkbox" id="bool-value" \${checked ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
                <span class="switch-label" id="bool-label">\${checked ? '✅ 启用' : '⏸️ 禁用'}</span>
            </div>
        \`;

        document.getElementById('bool-value').addEventListener('change', function(e) {
            document.getElementById('bool-label').textContent = e.target.checked ? '✅ 启用' : '⏸️ 禁用';
        });

    } else if (type === 'number') {
        const min = item && item.min !== undefined ? item.min : 1;
        const max = item && item.max !== undefined ? item.max : 100;
        const currentValue = value || min;

        container.innerHTML = \`
            <label class="form-label">值 (\${min}-\${max})</label>
            <div class="number-picker">
                <div class="number-controls">
                    <button type="button" class="number-btn" onclick="adjustNumber(1)">▲</button>
                    <button type="button" class="number-btn" onclick="adjustNumber(-1)">▼</button>
                </div>
                <div class="number-display" id="num-value">\${currentValue}</div>
            </div>
            <div class="number-range">
                <input type="range" id="num-slider" min="\${min}" max="\${max}" value="\${currentValue}"
                       oninput="updateNumberDisplay(this.value)">
            </div>
        \`;

    } else if (type === 'select') {
        const options = item && item.options ? item.options : ['option1', 'option2', 'option3'];
        const optionsInput = item ? '' : \`
            <div class="form-group">
                <label class="form-label">可选项 (逗号分隔)</label>
                <input type="text" class="form-input" id="select-options" placeholder="例如: debug,info,warn,error"
                       value="\${options.join(',')}" onchange="updateTagOptions()">
            </div>
        \`;

        container.innerHTML = \`
            \${optionsInput}
            <label class="form-label">选择值</label>
            <div class="tag-selector" id="tag-selector">
                \${options.map(opt => \`
                    <div class="tag-option \${opt === value ? 'selected' : ''}"
                         data-value="\${opt}" onclick="selectTag(this)">
                        \${opt}
                    </div>
                \`).join('')}
            </div>
        \`;

    } else if (type === 'multi-select') {
        // 多选标签（可拖动排序）
        const options = item && item.options ? item.options : ['option1', 'option2', 'option3', 'option4'];
        // 确保value是字符串类型后再进行split操作
        const stringValue = typeof value === 'string' ? value : String(value || '');
        const selectedValues = stringValue ? stringValue.split(',').map(v => v.trim()).filter(v => v) : [];
        
        // 获取当前 Key 以判断是否启用合并模式
        const currentKey = item ? item.key : (document.getElementById('env-key') ? document.getElementById('env-key').value : '');
        const shouldShowMergeMode = currentKey === 'MERGE_SOURCE_PAIRS' || currentKey === 'PLATFORM_ORDER';
        
        // 重置合并状态
        isMergeMode = false;
        stagingTags = [];

        const optionsInput = item ? '' : \`
            <div class="form-group margin-bottom-15">
                <label>可选项 (逗号分隔)</label>
                <input type="text" id="multi-options" placeholder="例如: auth,payment,analytics"
                       value="\${options.join(',')}" onchange="updateMultiOptions()">
            </div>
        \`;

        container.innerHTML = \`
            \${optionsInput}
            <label>已选择 (拖动调整顺序)</label>
            <div class="multi-select-container">
                <div class="selected-tags \${selectedValues.length === 0 ? 'empty' : ''}" id="selected-tags">
                    \${selectedValues.map(val => \`
                        <div class="selected-tag" draggable="true" data-value="\${val}">
                            <span class="tag-text">\${val}</span>
                            <button type="button" class="remove-btn" onclick="removeSelectedTag(this)">×</button>
                        </div>
                    \`).join('')}
                </div>

                \${shouldShowMergeMode ? \`
                <div class="merge-mode-controls">
                    <button type="button" class="btn btn-sm btn-secondary merge-mode-btn" id="merge-mode-toggle" onclick="toggleMergeMode()">
                        <span class="icon">🔗</span> <span>开启合并模式</span>
                    </button>
                    <div class="form-help" style="margin: 0; font-size: 0.8em; margin-left: 10px;">
                        开启后，点击下方选项添加到暂存区，组合后点击 √ 确认添加
                    </div>
                </div>

                <div class="staging-area" id="staging-area">
                    <button type="button" class="btn btn-sm btn-success confirm-merge-btn" onclick="confirmMergeGroup()" title="确认添加该组">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </button>
                </div>
                \` : ''}

                <label>可选项 (点击添加)</label>
                <div class="available-tags" id="available-tags">
                    \${options.map(opt => {
                        return \`
                            <div class="available-tag"
                                 data-value="\${opt}" onclick="addSelectedTag(this)">
                                \${opt}
                            </div>
                        \`;
                    }).join('')}
                </div>
            </div>
        \`;

        // 设置拖动事件
        setTimeout(updateTagStates, 0); // 立即更新一次状态
        setupDragAndDrop();

    } else if (type === 'map') {
        // 映射表类型
        const pairs = value ? value.split(';').map(pair => pair.trim()).filter(pair => pair) : [];
        const mapItems = pairs.map(pair => {
            if (pair.includes('->')) {
                const [left, right] = pair.split('->').map(s => s.trim());
                return { left, right };
            }
            return { left: pair, right: '' };
        });

        container.innerHTML = \`
            <label class="form-label">映射配置</label>
            <div class="map-container" id="map-container">
                \${mapItems.map((item, index) => \`
                    <div class="map-item" data-index="\${index}">
                        <input type="text" class="map-input-left form-input" placeholder="原始值" value="\${escapeHtml(item.left)}">
                        <span class="map-separator">-></span>
                        <input type="text" class="map-input-right form-input" placeholder="映射值" value="\${escapeHtml(item.right)}">
                        <button type="button" class="btn btn-danger btn-sm map-remove-btn" onclick="removeMapItem(this)">删除</button>
                    </div>
                \`).join('')}
                <div class="map-item-template" style="display: none;">
                    <input type="text" class="map-input-left form-input" placeholder="原始值">
                    <span class="map-separator">-></span>
                    <input type="text" class="map-input-right form-input" placeholder="映射值">
                    <button type="button" class="btn btn-danger btn-sm map-remove-btn" onclick="removeMapItem(this)">删除</button>
                </div>
            </div>
            <button type="button" class="btn btn-primary" onclick="addMapItem()" style="margin-top: 1rem;">
                <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <line x1="12" y1="5" x2="12" y2="19" stroke-width="2"/>
                    <line x1="5" y1="12" x2="19" y2="12" stroke-width="2"/>
                </svg>
                <span>添加映射项</span>
            </button>
        \`;

    } else if (type === 'timeline-offset') {
        const sourceOptions = getTimelineOffsetSourceOptions(item && item.options ? item.options : []);
        const entries = value ? value.split(/[;,]/).map(entry => entry.trim()).filter(entry => entry) : [];
        const offsetItems = entries.map(parseTimelineOffsetLine).filter(Boolean);
        timelineOffsetSourceOptions = sourceOptions;

        container.innerHTML = \`
            <div class="timeline-offset-panel">
                <div class="timeline-offset-header">
                    <div class="timeline-offset-title">时间轴偏移规则</div>
                    <button type="button" class="btn btn-primary btn-sm" onclick="addTimelineOffsetItem()">
                        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <line x1="12" y1="5" x2="12" y2="19" stroke-width="2"/>
                            <line x1="5" y1="12" x2="19" y2="12" stroke-width="2"/>
                        </svg>
                        <span>新增规则</span>
                    </button>
                </div>
                <div class="timeline-offset-help">点击“新增规则”快速弹窗配置：剧名、来源、偏移方式和偏移值。</div>
                <div class="timeline-offset-list" id="timeline-offset-container">
                    \${offsetItems.length > 0 ? offsetItems.map((entry, index) => buildTimelineOffsetLineMarkup(entry, index)).join('') : '<div class="timeline-offset-empty">暂无规则，点击右上角“新增规则”快速添加。</div>'}
                </div>
            </div>
        \`;

        renderTimelineOffsetModalContent();
        setTimeout(() => updateTimelineOffsetPreview(), 0);

    } else if (type === 'color-list') {
        // 默认颜色池（与后端 danmu-util.js 保持一致）
        const defaultPool = [16777215, 16777215, 16777215, 16777215, 16777215, 16777215, 16777215, 16777215, 
                   16744319, 16752762, 16774799, 9498256, 8388564, 8900346, 14204888, 16758465];
        
        let colors = [];
        
        // 优先使用 item.colors（编辑时保存的颜色数组）
        if (item && item.colors && Array.isArray(item.colors) && item.colors.length > 0) {
            colors = [...item.colors];
        } else if (!value || value === 'color' || value === 'default') {
            // 如果是 'color' 或 'default' 或空，使用默认池
            colors = [...defaultPool];
        } else if (value === 'white') {
            colors = [16777215];
        } else if (typeof value === 'string' && value.trim() !== '') {
            // 否则解析CSV字符串
            const parsed = value.split(',').map(v => {
                const num = parseInt(v.trim(), 10);
                return isNaN(num) ? null : num;
            }).filter(v => v !== null);
            
            // 如果成功解析到颜色，使用解析结果；否则使用默认池
            colors = parsed.length > 0 ? parsed : [...defaultPool];
        } else {
            // 其他情况使用默认池
            colors = [...defaultPool];
        }

        // 隐藏的实际存储 input
        const hiddenInput = \`<input type="hidden" id="text-value" value="\${colors.join(',')}">\`;

        container.innerHTML = \`
            \${hiddenInput}
            <label class="form-label">颜色池配置</label>
            <div class="color-pool-hint">
                拖动颜色块可调整顺序，点击 × 可删除
            </div>
            <div class="color-pool-controls">
                <div class="color-input-group">
                    <span class="color-input-label">添加颜色</span>
                    <div class="color-input-wrapper">
                        <div class="color-picker-panel-wrapper">
                            <button type="button" class="color-picker-trigger" id="color-picker-trigger" onclick="toggleColorPicker()">
                                <span class="color-preview" id="color-preview" style="background: #ffffff;"></span>
                                <span class="color-picker-label">选择颜色</span>
                                <svg class="picker-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                            </button>
                            <div class="color-picker-dropdown" id="color-picker-dropdown">
                                <div class="color-picker-canvas-wrapper">
                                    <canvas id="color-picker-canvas" width="280" height="180"></canvas>
                                    <div class="color-picker-cursor" id="color-picker-cursor"></div>
                                </div>
                                <div class="color-picker-hue-wrapper">
                                    <canvas id="color-picker-hue" width="280" height="20"></canvas>
                                    <div class="color-hue-cursor" id="color-hue-cursor"></div>
                                </div>
                                <div class="color-picker-info">
                                    <div class="color-preview-large" id="color-preview-large" style="background: #ffffff;"></div>
                                    <div class="color-values">
                                        <div class="color-value-group">
                                            <label class="color-value-label">HEX</label>
                                            <input type="text" id="color-hex-display" class="color-value-input" value="FFFFFF" readonly>
                                        </div>
                                        <div class="color-value-group">
                                            <label class="color-value-label">DEC</label>
                                            <input type="text" id="color-dec-display" class="color-value-input" value="16777215" readonly>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="color-hex-input-wrapper">
                            <span class="color-hex-prefix">#</span>
                            <input type="text" 
                                   id="color-hex-input" 
                                   class="color-hex-input" 
                                   placeholder="输入HEX颜色码" 
                                   maxlength="6"
                                   oninput="syncHexToColorPicker(this.value)"
                                   onkeypress="if(event.key==='Enter') addColorFromHexInput()">
                        </div>
                        <button type="button" class="color-add-btn" onclick="addColorFromPicker()" title="添加到颜色池">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                            <span>添加</span>
                        </button>
                    </div>
                </div>
                <button type="button" class="btn btn-sm btn-secondary" onclick="addRandomColor()" title="随机添加颜色">
                    <span class="btn-icon-text">🎲 随机</span>
                </button>
                <button type="button" class="btn btn-sm btn-primary" onclick="showBatchImportModal()" title="批量导入颜色">
                    <span class="btn-icon-text">📥 批量导入</span>
                </button>
                <button type="button" class="btn btn-sm btn-danger" onclick="resetColorPool()" title="重置为默认">
                    <span class="btn-icon-text">↺ 重置</span>
                </button>
            </div>
            
            <div class="color-pool-container \${colors.length === 0 ? 'empty' : ''}" id="color-pool-container">
                \${colors.map((colorInt, index) => {
                    const hex = '#' + colorInt.toString(16).padStart(6, '0').toUpperCase();
                    const hexShort = hex.substring(1);
                    return \`
                        <div class="color-chip" draggable="true" data-value="\${colorInt}" style="background-color: \${hex}; animation-delay: \${index * 0.05}s;" title="\${hex} (\${colorInt})">
                            <span class="color-hex-label">\${hexShort}</span>
                            <button type="button" class="remove-chip-btn" onclick="removeColorChip(this)">×</button>
                        </div>
                    \`;
                }).join('')}
            </div>
            <div class="form-help">
                <span class="pool-stats">
                    <span class="pool-count-badge">
                        <span class="pool-count-icon">🎨</span>
                        <span id="pool-count">\${colors.length}</span> 个颜色
                    </span>
                    <span class="pool-count-badge" style="background: linear-gradient(135deg, #9ca3af, #6b7280); margin-left: 8px;" title="白色 (16777215) 占比">
                        <span class="pool-count-icon">⚪</span>
                        <span id="white-percent">\${colors.length > 0 ? Math.round((colors.filter(c => parseInt(c) === 16777215).length / colors.length) * 100) : 0}%</span> 白色
                    </span>
                </span>
            </div>
        \`;

        setupColorDragAndDrop();
        // 添加批量导入模态框（只在 color-list 类型时添加一次）
        if (!document.getElementById('batch-import-modal')) {
            const modalHTML = \`
                <div id="batch-import-modal" class="batch-import-modal">
                    <div class="batch-import-container">
                        <div class="batch-import-header">
                            <h3 class="batch-import-title">
                                📥 批量导入颜色
                            </h3>
                            <button type="button" class="batch-import-close" onclick="closeBatchImportModal()">×</button>
                        </div>
                        
                        <div class="batch-import-hint">
                            <strong>支持的格式：</strong>
                            • HEX 格式：#FFFFFF 或 FFFFFF<br>
                            • 十进制格式：16777215<br>
                            • 多个颜色可用逗号、空格或换行分隔<br>
                            • 示例：#FF5733, 16777215, #00FF00
                        </div>
                        
                        <textarea id="batch-import-textarea" 
                                  class="batch-import-textarea" 
                                  placeholder="输入颜色值，支持多种格式...
例如：
#FFFFFF, #FF5733, #00FF00
16777215, 16744319, 65280
FFFFFF FF5733 00FF00"></textarea>
                        
                        <div id="batch-import-preview" class="batch-import-preview" style="display: none;">
                            <div class="batch-import-preview-title">预览 (<span id="preview-count">0</span> 个颜色)</div>
                            <div id="batch-import-preview-colors" class="batch-import-preview-colors"></div>
                        </div>
                        
                        <div class="batch-import-actions">
                            <button type="button" class="btn btn-secondary" onclick="closeBatchImportModal()">取消</button>
                            <button type="button" class="btn btn-primary" onclick="previewBatchImport()">预览</button>
                            <button type="button" class="btn btn-success" onclick="confirmBatchImport()">导入</button>
                        </div>
                    </div>
                </div>
            \`;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
        }

        setupColorDragAndDrop();
        
        // 初始化高级调色板
        setTimeout(() => {
            initAdvancedColorPicker();
        }, 100);

    } else {
        // 获取当前编辑的 key（用于判断是否是 BILIBILI_COOKIE）
        const currentKey = document.getElementById('env-key') ? document.getElementById('env-key').value : '';
        const isBilibiliCookie = currentKey === 'BILIBILI_COOKIE';
        const isAiApiKey = currentKey === 'AI_API_KEY';
        
        if (isAiApiKey) {
            // AI API Key 专用编辑界面
            container.innerHTML = \`
                <div class="ai-apikey-editor">
                    <div class="form-group ai-apikey-input-group">
                        <label class="form-label" for="text-value">API Key 值</label>
                        <textarea class="form-textarea ai-apikey-textarea" id="text-value" placeholder="请输入 AI API Key" rows="3">\${escapeHtml(value)}</textarea>
                        <div class="form-help ai-apikey-help">支持 OpenAI 兼容 API，需配合 AI_BASE_URL 和 AI_MODEL 使用（AI_BASE_URL 支持根地址、/v1 或完整接口URL）</div>
                    </div>

                    <div class="ai-apikey-status" id="ai-apikey-status">
                        <span class="ai-status-icon">🔍</span>
                        <span class="ai-status-text">点击下方按钮测试连通性</span>
                    </div>
                    <div class="ai-apikey-actions">
                        <button type="button" class="btn btn-primary btn-sm" id="ai-verify-btn" onclick="verifyAiConnection()">
                            🧪 测试连通性
                        </button>
                    </div>
                </div>
            \`;
        } else if (isBilibiliCookie) {
            // Bilibili Cookie 专用编辑界面
            const rows = value && value.length > 50 ? Math.min(Math.max(Math.ceil(value.length / 50), 3), 8) : 3;
            container.innerHTML = \`
                <div class="bili-cookie-editor">
                    <!-- 状态卡片 -->
                    <div class="bili-cookie-status-card" id="bili-cookie-status-card">
                        <div class="bili-cookie-status-header">
                            <div class="bili-cookie-status-icon" id="bili-cookie-status-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"/>
                                    <path d="M12 6v6l4 2"/>
                                </svg>
                            </div>
                            <div class="bili-cookie-status-info">
                                <div class="bili-cookie-status-title" id="bili-cookie-status-title">检测中...</div>
                                <div class="bili-cookie-status-subtitle" id="bili-cookie-status-subtitle">正在获取Cookie状态</div>
                            </div>
                            <div class="bili-cookie-status-badge" id="bili-cookie-status-badge">
                                <span class="status-dot"></span>
                                <span class="status-text">检测中</span>
                            </div>
                        </div>
                        <div class="bili-cookie-status-details" id="bili-cookie-status-details" style="display: none;">
                            <div class="bili-cookie-detail-item">
                                <span class="detail-icon">👤</span>
                                <span class="detail-label">用户名</span>
                                <span class="detail-value" id="bili-cookie-uname">--</span>
                            </div>
                            <div class="bili-cookie-detail-item">
                                <span class="detail-icon">⏰</span>
                                <span class="detail-label">到期时间</span>
                                <span class="detail-value" id="bili-cookie-expire">--</span>
                            </div>
                            <div class="bili-cookie-detail-item">
                                <span class="detail-icon">📅</span>
                                <span class="detail-label">剩余天数</span>
                                <span class="detail-value" id="bili-cookie-days-left">--</span>
                            </div>
                            <div class="bili-cookie-detail-item">
                                <span class="detail-icon">👑</span>
                                <span class="detail-label">会员状态</span>
                                <span class="detail-value" id="bili-cookie-vip">--</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 操作按钮组 -->
                    <div class="bili-cookie-actions-card">
                        <div class="bili-cookie-actions-title">
                            <span class="actions-icon">🔧</span>
                            <span>快捷操作</span>
                        </div>
                        <div class="bili-cookie-actions-grid">
                            <button type="button" class="bili-action-btn bili-action-primary" onclick="startBilibiliQRLogin()">
                                <div class="action-btn-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/>
                                    </svg>
                                </div>
                                <div class="action-btn-text">
                                    <span class="action-btn-title">扫码登录</span>
                                    <span class="action-btn-desc">使用B站APP扫码</span>
                                </div>
                            </button>
                            <button type="button" class="bili-action-btn bili-action-secondary" onclick="verifyBilibiliCookie()">
                                <div class="action-btn-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                    </svg>
                                </div>
                                <div class="action-btn-text">
                                    <span class="action-btn-title">验证状态</span>
                                    <span class="action-btn-desc">检查Cookie有效性</span>
                                </div>
                            </button>
                            <button type="button" class="bili-action-btn bili-action-warning" onclick="refreshBilibiliCookie()">
                                <div class="action-btn-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                                    </svg>
                                </div>
                                <div class="action-btn-text">
                                    <span class="action-btn-title">刷新Cookie</span>
                                    <span class="action-btn-desc">延长有效期</span>
                                </div>
                            </button>
                        </div>
                    </div>
                    
                    <!-- Cookie 输入区域 -->
                    <div class="bili-cookie-input-card">
                        <div class="bili-cookie-input-header">
                            <label class="form-label" style="margin-bottom: 0;">
                                <span class="input-icon">🍪</span>
                                Cookie 值
                            </label>
                            <button type="button" class="bili-toggle-visibility-btn" onclick="toggleBiliCookieVisibility()" title="显示/隐藏Cookie">
                                <svg id="bili-eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                    <circle cx="12" cy="12" r="3"/>
                                </svg>
                            </button>
                        </div>
                        <div class="bili-cookie-input-wrapper">
                            <textarea class="form-textarea bili-cookie-textarea" id="text-value" placeholder="SESSDATA=xxx; bili_jct=xxx; DedeUserID=xxx; ..." rows="\${rows}">\${escapeHtml(value)}</textarea>
                            <div class="bili-cookie-input-overlay" id="bili-cookie-overlay" style="display: none;">
                                <span class="overlay-text">Cookie 已隐藏</span>
                                <button type="button" class="overlay-show-btn" onclick="toggleBiliCookieVisibility()">点击显示</button>
                            </div>
                        </div>
                        <div class="bili-cookie-input-hint">
                            <span class="hint-icon">💡</span>
                            <span>推荐使用「扫码登录」自动获取，或手动粘贴包含 SESSDATA 和 bili_jct 的完整 Cookie</span>
                        </div>
                    </div>
                </div>
            \`;
            
            // 自动检测 Cookie 状态
            setTimeout(() => {
                autoCheckBilibiliCookieStatus();
            }, 100);
        } else if (value && value.length > 50) {
            const rows = Math.min(Math.max(Math.ceil(value.length / 50), 3), 10);
            container.innerHTML = \`
                <label class="form-label">变量值 *</label>
                <textarea class="form-textarea" id="text-value" placeholder="例如: localhost" rows="\${rows}">\${escapeHtml(value)}</textarea>
            \`;
        } else {
            container.innerHTML = \`
                <label class="form-label">变量值 *</label>
                <input type="text" class="form-input" id="text-value" placeholder="例如: localhost" value="\${escapeHtml(value)}" required>
            \`;
        }
    }
}

/* ========================================
   数字调整
   ======================================== */
function adjustNumber(delta) {
    const display = document.getElementById('num-value');
    const slider = document.getElementById('num-slider');
    let value = parseInt(display.textContent) + delta;

    value = Math.max(parseInt(slider.min), Math.min(parseInt(slider.max), value));

    display.textContent = value;
    slider.value = value;
}

function updateNumberDisplay(value) {
    document.getElementById('num-value').textContent = value;
}

/* ========================================
   标签选择
   ======================================== */
function selectTag(element) {
    document.querySelectorAll('.tag-option').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
}

function updateTagOptions() {
    const input = document.getElementById('select-options');
    const options = input.value.split(',').map(s => s.trim()).filter(s => s);
    const container = document.getElementById('tag-selector');

    container.innerHTML = options.map(opt => \`
        <div class="tag-option" data-value="\${opt}" onclick="selectTag(this)">
            \${opt}
        </div>
    \`).join('');
}

/* ========================================
   多选标签操作
   ======================================== */
// 统一的状态检查函数
function updateTagStates() {
    const keyInput = document.getElementById('env-key');
    const currentKey = keyInput ? keyInput.value : '';
    const isMergeSourcePairs = currentKey === 'MERGE_SOURCE_PAIRS';

    const stagingTokens = new Set(stagingTags);
    const selectedTagElements = Array.from(document.querySelectorAll('.selected-tag'));

    const availableTags = document.querySelectorAll('.available-tag');
    availableTags.forEach(tag => {
        const value = tag.dataset.value;
        let shouldDisable = false;

        if (isMergeMode) {
            // 合并模式下：如果在暂存区，则禁用
            if (stagingTokens.has(value)) {
                shouldDisable = true;
            }
        } else {
            // 普通模式下：如果已选择，则禁用
            const isAlreadySelected = selectedTagElements.some(el => el.dataset.value === value);
            if (isAlreadySelected) {
                shouldDisable = true;
            }
            // 特殊情况：如果是合并源，但没开合并模式且没被选，也禁用
            if (isMergeSourcePairs && !isAlreadySelected) {
                shouldDisable = true;
            }
        }

        if (shouldDisable) {
            tag.classList.add('disabled');
        } else {
            tag.classList.remove('disabled');
        }
    });
}

// 添加已选标签 (修改版)
function addSelectedTag(element) {
    const value = element.dataset.value;

    if (isMergeMode) {
        if (!stagingTags.includes(value)) {
            stagingTags.push(value);
            renderStagingArea();
            updateTagStates(); // 立即更新状态
        }
        return;
    }

    if (element.classList.contains('disabled')) return;

    const container = document.getElementById('selected-tags');
    container.classList.remove('empty');

    const tag = document.createElement('div');
    tag.className = 'selected-tag';
    tag.draggable = true;
    tag.dataset.value = value;
    tag.innerHTML = \`
        <span class="tag-text">\${value}</span>
        <button type="button" class="remove-btn" onclick="removeSelectedTag(this)">×</button>
    \`;

    container.appendChild(tag);
    updateTagStates(); // 更新状态
    setupDragAndDrop();
}

// 移除已选标签 (修改版)
function removeSelectedTag(button) {
    const tag = button.parentElement;
    tag.remove();

    const container = document.getElementById('selected-tags');
    if (container.children.length === 0) {
        container.classList.add('empty');
    }

    updateTagStates(); // 释放状态
    setupDragAndDrop();
}

// 更新多选选项 (修改版)
function updateMultiOptions() {
    const input = document.getElementById('multi-options');
    const options = input.value.split(',').map(s => s.trim()).filter(s => s);
    const container = document.getElementById('available-tags');
    
    container.innerHTML = options.map(opt => {
        return \`
            <div class="available-tag"
                 data-value="\${opt}" onclick="addSelectedTag(this)">
                \${opt}
            </div>
        \`;
    }).join('');
    
    updateTagStates();
}

// 切换合并模式
function toggleMergeMode() {
    isMergeMode = !isMergeMode;
    const btn = document.getElementById('merge-mode-toggle');
    const stagingArea = document.getElementById('staging-area');

    if (isMergeMode) {
        btn.classList.add('btn-primary');
        btn.classList.remove('btn-secondary');
        btn.innerHTML = '<span class="icon">⛓‍💥</span> <span>合并模式已开启 (点击关闭)</span>';
        stagingArea.classList.add('active');
        renderStagingArea();
    } else {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-secondary');
        btn.innerHTML = '<span class="icon">🔗</span> <span>开启合并模式</span>';
        stagingArea.classList.remove('active');
        stagingTags = [];
    }
    
    updateTagStates();
}

// 渲染暂存区
function renderStagingArea() {
    const container = document.getElementById('staging-area');
    const confirmBtn = container.querySelector('.confirm-merge-btn');
    
    // 清除除确认按钮外的所有子元素
    while (container.firstChild && container.firstChild !== confirmBtn) {
        container.removeChild(container.firstChild);
    }

    if (stagingTags.length === 0) {
        const hint = document.createElement('span');
        hint.textContent = '请点击下方选项进行组合...';
        hint.style.color = '#666'; // 使用固定颜色或CSS变量
        hint.style.fontSize = '0.8rem';
        hint.style.marginRight = 'auto';
        container.insertBefore(hint, confirmBtn);
        confirmBtn.disabled = true;
        confirmBtn.style.opacity = '0.5';
        confirmBtn.style.cursor = 'not-allowed';
    } else {
        confirmBtn.disabled = false;
        confirmBtn.style.opacity = '1';
        confirmBtn.style.cursor = 'pointer';
        
        stagingTags.forEach((tag, index) => {
            if (index > 0) {
                const sep = document.createElement('span');
                sep.className = 'staging-separator';
                sep.textContent = '&';
                container.insertBefore(sep, confirmBtn);
            }
            const tagEl = document.createElement('div');
            tagEl.className = 'staging-tag';
            tagEl.draggable = true;
            tagEl.dataset.value = tag;
            tagEl.dataset.index = index;
            tagEl.innerHTML = \`\${tag}<span class="remove-btn" onclick="removeFromStaging(\${index})">×</span>\`;
            container.insertBefore(tagEl, confirmBtn);
        });
        
        setupStagingDragAndDrop();
    }
}

// 从暂存区移除
function removeFromStaging(index) {
    stagingTags.splice(index, 1);
    renderStagingArea();
    updateTagStates();
}

// 确认添加合并组
function confirmMergeGroup() {
    if (stagingTags.length === 0) return;
    const groupValue = stagingTags.join('&');
    const container = document.getElementById('selected-tags');
    container.classList.remove('empty');

    const tag = document.createElement('div');
    tag.className = 'selected-tag';
    tag.draggable = true;
    tag.dataset.value = groupValue;
    tag.innerHTML = \`<span class="tag-text">\${groupValue}</span><button type="button" class="remove-btn" onclick="removeSelectedTag(this)">×</button>\`;
    
    container.appendChild(tag);
    setupDragAndDrop();
    
    stagingTags = []; // 清空暂存区
    renderStagingArea();
    updateTagStates();
}

// 暂存区拖放功能
let stagingDraggedElement = null;

function setupStagingDragAndDrop() {
    const container = document.getElementById('staging-area');
    const tags = container.querySelectorAll('.staging-tag');
    
    tags.forEach(tag => {
        tag.addEventListener('dragstart', handleStagingDragStart);
        tag.addEventListener('dragend', handleStagingDragEnd);
        tag.addEventListener('dragover', handleStagingDragOver);
        tag.addEventListener('drop', handleStagingDrop);
        tag.addEventListener('dragenter', handleStagingDragEnter);
        tag.addEventListener('dragleave', handleStagingDragLeave);
    });
}

function handleStagingDragStart(e) {
    stagingDraggedElement = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleStagingDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.staging-tag').forEach(tag => {
        tag.classList.remove('drag-over');
    });
    stagingDraggedElement = null;
}

function handleStagingDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleStagingDragEnter(e) {
    if (this !== stagingDraggedElement) {
        this.classList.add('drag-over');
    }
}

function handleStagingDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleStagingDrop(e) {
    e.stopPropagation();
    if (stagingDraggedElement && stagingDraggedElement !== this) {
        const draggedIndex = parseInt(stagingDraggedElement.dataset.index);
        const targetIndex = parseInt(this.dataset.index);
        
        const [movedItem] = stagingTags.splice(draggedIndex, 1);
        stagingTags.splice(targetIndex, 0, movedItem);
        
        renderStagingArea();
    }
    this.classList.remove('drag-over');
    return false;
}

/* ========================================
   拖放功能
   ======================================== */
let draggedElement = null;

function setupDragAndDrop() {
    const container = document.getElementById('selected-tags');
    if (!container) return;
    
    const tags = container.querySelectorAll('.selected-tag');

    tags.forEach(tag => {
        tag.addEventListener('dragstart', handleDragStart);
        tag.addEventListener('dragend', handleDragEnd);
        tag.addEventListener('dragover', handleDragOver);
        tag.addEventListener('drop', handleDrop);
        tag.addEventListener('dragenter', handleDragEnter);
        tag.addEventListener('dragleave', handleDragLeave);
    });
}

function handleDragStart(e) {
    draggedElement = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.selected-tag').forEach(tag => {
        tag.classList.remove('drag-over');
    });
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDragEnter(e) {
    if (this !== draggedElement) {
        this.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }

    if (draggedElement !== this) {
        const container = document.getElementById('selected-tags');
        const allTags = Array.from(container.querySelectorAll('.selected-tag'));
        const draggedIndex = allTags.indexOf(draggedElement);
        const targetIndex = allTags.indexOf(this);

        if (draggedIndex < targetIndex) {
            this.parentNode.insertBefore(draggedElement, this.nextSibling);
        } else {
            this.parentNode.insertBefore(draggedElement, this);
        }
    }

    this.classList.remove('drag-over');
    return false;
}

/* ========================================
   移动端环境变量列表渲染增强
   ======================================== */
const originalRenderEnvList = renderEnvList;
renderEnvList = function() {
    originalRenderEnvList();
    
    // 移动端优化:为长文本添加展开/收起功能
    if (window.innerWidth <= 768) {
        document.querySelectorAll('.env-value').forEach(valueEl => {
            if (valueEl.textContent.length > 100) {
                valueEl.style.maxHeight = '3em';
                valueEl.style.overflow = 'hidden';
                valueEl.style.cursor = 'pointer';
                valueEl.title = '点击查看完整内容';
                
                valueEl.addEventListener('click', function() {
                    if (this.style.maxHeight === '3em') {
                        this.style.maxHeight = 'none';
                        this.style.overflow = 'auto';
                    } else {
                        this.style.maxHeight = '3em';
                        this.style.overflow = 'hidden';
                    }
                });
            }
        });
    }
};

/* ========================================
   颜色池操作相关函数
   ======================================== */
function updateColorPoolInput() {
    const chips = document.querySelectorAll('#color-pool-container .color-chip');
    const values = Array.from(chips).map(chip => chip.dataset.value);
    document.getElementById('text-value').value = values.join(',');
    
    // 更新计数
    const countEl = document.getElementById('pool-count');
    if (countEl) countEl.textContent = values.length;

    // 更新白色占比
    const whiteCount = values.filter(v => parseInt(v) === 16777215).length;
    const whitePercent = values.length > 0 ? Math.round((whiteCount / values.length) * 100) : 0;
    const percentEl = document.getElementById('white-percent');
    if (percentEl) percentEl.textContent = whitePercent + '%';
    
    // 更新容器空状态
    const container = document.getElementById('color-pool-container');
    if (values.length === 0) {
        container.classList.add('empty');
    } else {
        container.classList.remove('empty');
    }
}

function createColorChip(colorInt) {
    const hex = '#' + parseInt(colorInt).toString(16).padStart(6, '0').toUpperCase();
    const hexShort = hex.substring(1); // 去掉 # 号
    const chip = document.createElement('div');
    chip.className = 'color-chip';
    chip.draggable = true;
    chip.dataset.value = colorInt;
    chip.style.backgroundColor = hex;
    chip.title = \`\${hex} (\${colorInt})\`;
    
    chip.innerHTML = \`
        <span class="color-hex-label">\${hexShort}</span>
        <button type="button" class="remove-chip-btn" onclick="removeColorChip(this)">×</button>
    \`;
    
    // 绑定拖拽事件
    chip.addEventListener('dragstart', handleColorDragStart);
    chip.addEventListener('dragend', handleColorDragEnd);
    chip.addEventListener('dragover', handleColorDragOver);
    chip.addEventListener('drop', handleColorDrop);
    chip.addEventListener('dragenter', handleColorDragEnter);
    chip.addEventListener('dragleave', handleColorDragLeave);
    
    return chip;
}

function addColorFromPicker() {
    const picker = document.getElementById('color-picker-input');
    const hex = picker.value;
    const decimal = parseInt(hex.replace('#', ''), 16);
    
    const container = document.getElementById('color-pool-container');
    container.appendChild(createColorChip(decimal));
    updateColorPoolInput();
}
function syncHexToColorPicker(hexValue) {
    const picker = document.getElementById('color-picker-input');
    if (!picker) return;
    
    // 移除非hex字符
    hexValue = hexValue.replace(/[^0-9A-Fa-f]/g, '');
    
    if (hexValue.length === 6) {
        picker.value = '#' + hexValue;
    } else if (hexValue.length === 3) {
        // 支持简写格式 #RGB -> #RRGGBB
        const expanded = hexValue.split('').map(char => char + char).join('');
        picker.value = '#' + expanded;
    }
}

function isCoarsePointerDevice() {
    return (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
           /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function blurActiveElement() {
    const el = document.activeElement;
    if (el && typeof el.blur === 'function') {
        el.blur();
    }
}

function addColorFromInput() {
    const hexInput = document.getElementById('color-hex-input');
    const picker = document.getElementById('color-picker-input');
    
    if (!hexInput || !picker) return;
    
    let hexValue = hexInput.value.trim().replace(/[^0-9A-Fa-f]/g, '');
    
    if (hexValue.length === 0) {
        // 如果输入框为空，使用拾色器的值
        hexValue = picker.value.substring(1);
    } else if (hexValue.length === 3) {
        // 支持简写格式
        hexValue = hexValue.split('').map(char => char + char).join('');
    }
    
    if (hexValue.length !== 6) {
        customAlert('请输入有效的6位HEX颜色代码\\n例如: FFFFFF 或 FF5733', '⚠️ 格式错误');
        if (!isCoarsePointerDevice()) {
            hexInput.focus();
        } else {
            blurActiveElement();
        }
        return;
    }
    
    const decimal = parseInt(hexValue, 16);
    
    if (isNaN(decimal)) {
        customAlert('无效的颜色值', '⚠️ 格式错误');
        if (!isCoarsePointerDevice()) {
            hexInput.focus();
        } else {
            blurActiveElement();
        }
        return;
    }
    
    const container = document.getElementById('color-pool-container');
    const chip = createColorChip(decimal);
    container.appendChild(chip);
    updateColorPoolInput();
    
    // 清空输入框
    hexInput.value = '';
    
    // 移动端：不要强制 focus，否则会弹出软键盘
    if (!isCoarsePointerDevice()) {
        hexInput.focus();
    } else {
        blurActiveElement();
    }
    
    // 添加成功反馈
    chip.style.animation = 'colorChipFadeIn 0.4s ease-out, pulse 0.6s ease-out';
}

function addColorFromHexInput() {
    addColorFromInput();
}

function addRandomColor() {
    // 生成真随机颜色 (0 - 16777215)
    const randomDecimal = Math.floor(Math.random() * 16777216);
    const container = document.getElementById('color-pool-container');
    container.appendChild(createColorChip(randomDecimal));
    updateColorPoolInput();
}

function removeColorChip(btn) {
    btn.parentElement.remove();
    updateColorPoolInput();
}

function resetColorPool() {
    if(!confirm('确定要重置为默认高亮颜色池吗？')) return;
    
    const defaultPool = [16777215, 16777215, 16777215, 16777215, 16777215, 16777215, 16777215, 16777215, 
                   16744319, 16752762, 16774799, 9498256, 8388564, 8900346, 14204888, 16758465];
                   
    const container = document.getElementById('color-pool-container');
    container.innerHTML = '';
    defaultPool.forEach(color => {
        container.appendChild(createColorChip(color));
    });
    updateColorPoolInput();
}

/* 颜色拖放逻辑 */
let draggedColor = null;

function setupColorDragAndDrop() {
    const chips = document.querySelectorAll('.color-chip');
    chips.forEach(chip => {
        chip.addEventListener('dragstart', handleColorDragStart);
        chip.addEventListener('dragend', handleColorDragEnd);
        chip.addEventListener('dragover', handleColorDragOver);
        chip.addEventListener('drop', handleColorDrop);
        chip.addEventListener('dragenter', handleColorDragEnter);
        chip.addEventListener('dragleave', handleColorDragLeave);
    });
}

function handleColorDragStart(e) {
    draggedColor = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleColorDragEnd(e) {
    this.classList.remove('dragging');
    draggedColor = null;
}

function handleColorDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleColorDragEnter(e) {
    if (this !== draggedColor) {
        this.style.transform = 'scale(1.1)';
    }
}

function handleColorDragLeave(e) {
    this.style.transform = '';
}

function handleColorDrop(e) {
    e.stopPropagation();
    this.style.transform = '';

    if (draggedColor && draggedColor !== this) {
        const container = document.getElementById('color-pool-container');
        const chips = Array.from(container.querySelectorAll('.color-chip'));
        const draggedIndex = chips.indexOf(draggedColor);
        const targetIndex = chips.indexOf(this);

        if (draggedIndex < targetIndex) {
            this.parentNode.insertBefore(draggedColor, this.nextSibling);
        } else {
            this.parentNode.insertBefore(draggedColor, this);
        }
        updateColorPoolInput();
    }
    return false;
}
/* ========================================
   批量导入颜色功能
   ======================================== */
function showBatchImportModal() {
    const modal = document.getElementById('batch-import-modal');
    if (modal) {
        modal.classList.add('active');
        document.getElementById('batch-import-textarea').value = '';
        document.getElementById('batch-import-preview').style.display = 'none';
    }
}

function closeBatchImportModal() {
    const modal = document.getElementById('batch-import-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function parseBatchColorInput(input) {
    const colors = [];
    const errors = [];
    
    // 分割输入：支持逗号、空格、换行
    const rawValues = input
        .split(/[\\s,\\n]+/)
        .map(v => v.trim())
        .filter(v => v.length > 0);
    
    rawValues.forEach((value, index) => {
        let decimal = null;
        
        // 移除可能的 # 号
        const cleanValue = value.replace(/^#/, '');
        
        // 尝试解析为 HEX
        if (/^[0-9A-Fa-f]{6}$/.test(cleanValue)) {
            decimal = parseInt(cleanValue, 16);
        } 
        // 尝试解析为 3 位 HEX 简写
        else if (/^[0-9A-Fa-f]{3}$/.test(cleanValue)) {
            const expanded = cleanValue.split('').map(c => c + c).join('');
            decimal = parseInt(expanded, 16);
        }
        // 尝试解析为十进制
        else if (/^\\d+$/.test(cleanValue)) {
            decimal = parseInt(cleanValue, 10);
            // 验证范围
            if (decimal < 0 || decimal > 16777215) {
                errors.push(\`第 \${index + 1} 个值 "\${value}" 超出有效范围 (0-16777215)\`);
                return;
            }
        }
        // 无法识别的格式
        else {
            errors.push(\`第 \${index + 1} 个值 "\${value}" 格式无效\`);
            return;
        }
        
        if (decimal !== null && !isNaN(decimal)) {
            colors.push(decimal);
        }
    });
    
    return { colors, errors };
}

function previewBatchImport() {
    const textarea = document.getElementById('batch-import-textarea');
    const input = textarea.value.trim();
    
    if (!input) {
        customAlert('请输入要导入的颜色值', '⚠️ 提示');
        return;
    }
    
    const { colors, errors } = parseBatchColorInput(input);
    
    if (errors.length > 0) {
        const errorMsg = '解析错误：\\n\\n' + errors.join('\\n');
        customAlert(errorMsg, '⚠️ 格式错误');
        return;
    }
    
    if (colors.length === 0) {
        customAlert('没有找到有效的颜色值', '⚠️ 提示');
        return;
    }
    
    // 显示预览
    const previewContainer = document.getElementById('batch-import-preview');
    const previewColors = document.getElementById('batch-import-preview-colors');
    const previewCount = document.getElementById('preview-count');
    
    previewCount.textContent = colors.length;
    previewColors.innerHTML = colors.map(colorInt => {
        const hex = '#' + colorInt.toString(16).padStart(6, '0').toUpperCase();
        return \`<div class="batch-import-preview-chip" style="background-color: \${hex};" title="\${hex} (\${colorInt})"></div>\`;
    }).join('');
    
    previewContainer.style.display = 'block';
    
    // 添加预览动画
    previewContainer.style.animation = 'fadeInUp 0.4s ease-out';
}

function confirmBatchImport() {
    const textarea = document.getElementById('batch-import-textarea');
    const input = textarea.value.trim();
    
    if (!input) {
        customAlert('请输入要导入的颜色值', '⚠️ 提示');
        return;
    }
    
    const { colors, errors } = parseBatchColorInput(input);
    
    if (errors.length > 0) {
        const errorMsg = '解析错误：\\n\\n' + errors.join('\\n');
        customAlert(errorMsg, '⚠️ 格式错误');
        return;
    }
    
    if (colors.length === 0) {
        customAlert('没有找到有效的颜色值', '⚠️ 提示');
        return;
    }
    
    // 先关闭批量导入模态框
    closeBatchImportModal();
    
    // 延迟一下再显示导入方式选择，等待模态框关闭动画完成
    setTimeout(() => {
        showImportModeDialog(colors);
    }, 350);
}
/* ========================================
   映射表操作函数
   ======================================== */
function addMapItem() {
    const container = document.getElementById('map-container');
    const template = document.querySelector('.map-item-template');
    const newItem = template.cloneNode(true);
    newItem.style.display = 'flex';
    newItem.classList.remove('map-item-template');
    newItem.classList.add('map-item');
    const index = container.querySelectorAll('.map-item:not(.map-item-template)').length;
    newItem.setAttribute('data-index', index);
    container.appendChild(newItem);
}

function removeMapItem(button) {
    const item = button.closest('.map-item');
    if (item && !item.classList.contains('map-item-template')) {
        item.remove();
    }
}

function getTimelineOffsetSourceOptions(options = []) {
    const backendOptions = Array.isArray(options) && options.length > 0
        ? options
        : (Array.isArray(configCache?.envVarConfig?.SOURCE_ORDER?.options) ? configCache.envVarConfig.SOURCE_ORDER.options : []);

    const normalized = backendOptions
        .map(opt => String(opt || '').trim())
        .filter(opt => opt);

    return Array.from(new Set(['all', ...normalized]));
}

function normalizeTimelineOffsetSegment(value, prefix) {
    const trimmed = String(value || '').trim();
    if (!trimmed) return '';

    const upper = trimmed.toUpperCase();
    const pureNumberMatch = upper.match(/^(\d+)$/);
    if (pureNumberMatch) {
        return prefix + String(parseInt(pureNumberMatch[1], 10)).padStart(2, '0');
    }

    const prefixedNumberMatch = upper.match(new RegExp('^' + prefix + '(\\d+)$'));
    if (prefixedNumberMatch) {
        return prefix + String(parseInt(prefixedNumberMatch[1], 10)).padStart(2, '0');
    }

    return upper;
}

function parseTimelineOffsetLine(lineValue) {
    const raw = String(lineValue || '').trim();
    if (!raw) return null;

    const colonIdx = raw.lastIndexOf(':');
    if (colonIdx === -1) {
        return {
            raw,
            title: raw,
            season: '',
            episode: '',
            sources: ['all'],
            offset: '',
            usePercent: false
        };
    }

    let rawPath = raw.substring(0, colonIdx).trim();
    const offset = raw.substring(colonIdx + 1).trim();
    let usePercent = false;

    if (rawPath.endsWith('%')) {
        usePercent = true;
        rawPath = rawPath.slice(0, -1).trim();
    }

    const atIdx = rawPath.lastIndexOf('@');
    let pathPart = rawPath;
    let sources = ['all'];

    if (atIdx !== -1) {
        pathPart = rawPath.substring(0, atIdx).trim();
        const sourcePart = rawPath.substring(atIdx + 1).trim().toLowerCase();
        if (sourcePart && sourcePart !== 'all' && sourcePart !== '*') {
            sources = sourcePart.split('&').map(part => part.trim()).filter(part => part);
        }
    }

    const segments = pathPart.split('/').map(part => part.trim()).filter(part => part);

    return {
        raw,
        title: segments[0] || '',
        season: segments[1] || '',
        episode: segments[2] || '',
        sources: sources.length > 0 ? sources : ['all'],
        offset,
        usePercent
    };
}

function buildTimelineOffsetLineValue({ title, season = '', episode = '', sources = ['all'], offset, usePercent = false }) {
    const titleValue = String(title || '').trim();
    const offsetValue = String(offset || '').trim();
    if (!titleValue || !offsetValue) return '';

    const segments = [titleValue];
    const seasonValue = normalizeTimelineOffsetSegment(season, 'S');
    const episodeValue = normalizeTimelineOffsetSegment(episode, 'E');
    if (seasonValue) segments.push(seasonValue);
    if (episodeValue) segments.push(episodeValue);

    const normalizedSources = Array.isArray(sources) && sources.length > 0 ? sources : ['all'];
    const sourceValue = normalizedSources.includes('all') ? 'all' : normalizedSources.join('&');
    const scopedPath = segments.join('/') + '@' + sourceValue;
    return scopedPath + (usePercent ? '%' : '') + ':' + offsetValue;
}

function buildTimelineOffsetMeta(entry) {
    const sources = Array.isArray(entry?.sources) && entry.sources.length > 0 ? entry.sources : ['all'];
    const sourceLabel = sources.includes('all') ? '全部来源' : sources.join('、');
    const modeLabel = entry?.usePercent ? '百分比' : '秒偏移';
    const valueLabel = entry?.offset ? String(entry.offset) + (entry.usePercent ? '%' : 's') : '未设置';
    return '来源：' + sourceLabel + ' · 方式：' + modeLabel + ' · 值：' + valueLabel;
}

function buildTimelineOffsetLineMarkup(entry, index = 0) {
    const parsed = entry && entry.raw ? entry : parseTimelineOffsetLine(entry);
    if (!parsed) return '';

    const scopeParts = [parsed.title, parsed.season, parsed.episode].filter(Boolean);
    const titleLabel = scopeParts.length > 0 ? scopeParts.join(' / ') : parsed.raw;

    return \`
        <div class="timeline-offset-line" data-index="\${index}">
            <div class="timeline-offset-line-main">
                <div class="timeline-offset-line-copy">
                    <div class="timeline-offset-line-name">\${escapeHtml(titleLabel)}</div>
                    <div class="timeline-offset-line-meta">\${escapeHtml(buildTimelineOffsetMeta(parsed))}</div>
                </div>
                <input type="text" class="timeline-offset-line-input form-input" value="\${escapeHtml(parsed.raw)}" readonly>
            </div>
            <button type="button" class="btn btn-danger btn-sm" onclick="removeTimelineOffsetItem(this)">删除</button>
        </div>
    \`;
}

function renderTimelineOffsetSourceChips(sourceOptions, selectedSources = ['all']) {
    const normalizedSelected = Array.isArray(selectedSources) && selectedSources.includes('all')
        ? ['all']
        : (selectedSources || []);

    return sourceOptions.map(opt => {
        const label = opt === 'all' ? '全部' : opt;
        const selected = normalizedSelected.includes(opt) ? 'selected' : '';
        return '<button type="button" class="platform-chip ' + selected + '" data-value="' + escapeHtml(opt) + '" onclick="toggleTimelineOffsetSource(this)">' + escapeHtml(label) + '</button>';
    }).join('');
}

function renderTimelineOffsetModalContent() {
    const modalBody = document.getElementById('timeline-offset-modal-body');
    if (!modalBody) return;

    const sourceOptions = getTimelineOffsetSourceOptions(timelineOffsetSourceOptions);
    modalBody.innerHTML = \`
        <div class="timeline-offset-modal-grid">
            <div class="form-group">
                <label class="form-label">剧名</label>
                <input type="text" class="form-input" id="timeline-offset-title-input" placeholder="例如：庆余年" oninput="updateTimelineOffsetPreview()">
            </div>
            <div class="form-group">
                <label class="form-label">季（可选）</label>
                <input type="text" class="form-input" id="timeline-offset-season-input" placeholder="S01 或 1" oninput="updateTimelineOffsetPreview()">
            </div>
            <div class="form-group">
                <label class="form-label">集（可选）</label>
                <input type="text" class="form-input" id="timeline-offset-episode-input" placeholder="E01 或 1" oninput="updateTimelineOffsetPreview()">
            </div>
            <div class="form-group">
                <label class="form-label">偏移方式</label>
                <input type="hidden" id="timeline-offset-mode-input" value="seconds">
                <div class="timeline-offset-mode-switch">
                    <button type="button" class="timeline-offset-mode-btn active" data-mode="seconds" onclick="setTimelineOffsetMode('seconds')">秒偏移</button>
                    <button type="button" class="timeline-offset-mode-btn" data-mode="percent" onclick="setTimelineOffsetMode('percent')">百分比</button>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label" id="timeline-offset-value-label">偏移秒数</label>
                <input type="number" step="0.1" class="form-input" id="timeline-offset-value-input" placeholder="-5" oninput="updateTimelineOffsetPreview()">
                <div class="timeline-offset-field-hint" id="timeline-offset-value-hint">正数向后偏移，负数向前偏移。</div>
            </div>
        </div>
        <div class="timeline-offset-platforms">
            <div class="timeline-offset-platforms-label">来源（从后端加载，可多选，all 表示全部来源）</div>
            <div class="timeline-offset-platforms-chips" id="timeline-offset-form-sources">
                \${renderTimelineOffsetSourceChips(sourceOptions, ['all'])}
            </div>
        </div>
        <div class="timeline-offset-preview">
            <span class="timeline-offset-preview-label">规则预览</span>
            <code class="timeline-offset-preview-text" id="timeline-offset-preview-text">请先填写剧名与偏移值</code>
        </div>
    \`;
}

function addTimelineOffsetItem() {
    openTimelineOffsetModal();
}

function openTimelineOffsetModal() {
    const modal = document.getElementById('timeline-offset-modal');
    if (!modal) return;

    renderTimelineOffsetModalContent();
    resetTimelineOffsetModal();

    const modalContainer = modal.querySelector('.modal-container');
    if (modalContainer) {
        modalContainer.style.animation = 'modalSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
    }
    modal.classList.add('active');

    const titleInput = document.getElementById('timeline-offset-title-input');
    if (titleInput) {
        setTimeout(() => titleInput.focus(), 0);
    }
}

function hideTimelineOffsetModal() {
    const modal = document.getElementById('timeline-offset-modal');
    if (!modal) return;

    const modalContainer = modal.querySelector('.modal-container');
    if (modalContainer) {
        modalContainer.style.animation = 'modalSlideOut 0.3s ease-out';
        setTimeout(() => {
            modal.classList.remove('active');
            modalContainer.style.animation = '';
            resetTimelineOffsetModal();
        }, 300);
    } else {
        modal.classList.remove('active');
        resetTimelineOffsetModal();
    }
}

function removeTimelineOffsetItem(button) {
    const item = button.closest('.timeline-offset-line');
    if (item) {
        item.remove();
    }

    const container = document.getElementById('timeline-offset-container');
    if (container && container.children.length === 0) {
        container.innerHTML = '<div class="timeline-offset-empty">暂无规则，点击右上角“新增规则”快速添加。</div>';
    }
}

function resetTimelineOffsetModal() {
    const titleInput = document.getElementById('timeline-offset-title-input');
    const seasonInput = document.getElementById('timeline-offset-season-input');
    const episodeInput = document.getElementById('timeline-offset-episode-input');
    const offsetInput = document.getElementById('timeline-offset-value-input');

    if (titleInput) titleInput.value = '';
    if (seasonInput) seasonInput.value = '';
    if (episodeInput) episodeInput.value = '';
    if (offsetInput) offsetInput.value = '';

    setTimelineOffsetMode('seconds');

    const sourceContainer = document.getElementById('timeline-offset-form-sources');
    if (sourceContainer) {
        const chips = Array.from(sourceContainer.querySelectorAll('.platform-chip'));
        chips.forEach(chip => chip.classList.toggle('selected', chip.dataset.value === 'all'));
    }

    updateTimelineOffsetPreview();
}

function getTimelineOffsetSelectedSources() {
    const sourceContainer = document.getElementById('timeline-offset-form-sources');
    if (!sourceContainer) return ['all'];

    const selected = Array.from(sourceContainer.querySelectorAll('.platform-chip.selected'))
        .map(chip => chip.dataset.value)
        .filter(value => value);

    return selected.includes('all') || selected.length === 0 ? ['all'] : selected;
}

function setTimelineOffsetMode(mode) {
    const normalizedMode = mode === 'percent' ? 'percent' : 'seconds';
    const modeInput = document.getElementById('timeline-offset-mode-input');
    const valueLabel = document.getElementById('timeline-offset-value-label');
    const valueHint = document.getElementById('timeline-offset-value-hint');
    const valueInput = document.getElementById('timeline-offset-value-input');
    const buttons = document.querySelectorAll('.timeline-offset-mode-btn');

    if (modeInput) modeInput.value = normalizedMode;
    if (valueLabel) {
        valueLabel.textContent = normalizedMode === 'percent' ? '百分比值' : '偏移秒数';
    }
    if (valueHint) {
        valueHint.textContent = normalizedMode === 'percent'
            ? '使用 % 规则生成配置值，沿用后端现有百分比偏移逻辑。'
            : '正数向后偏移，负数向前偏移。';
    }
    if (valueInput) {
        valueInput.placeholder = normalizedMode === 'percent' ? '10' : '-5';
    }

    buttons.forEach(button => {
        button.classList.toggle('active', button.dataset.mode === normalizedMode);
    });

    updateTimelineOffsetPreview();
}

function updateTimelineOffsetPreview() {
    const preview = document.getElementById('timeline-offset-preview-text');
    if (!preview) return;

    const titleInput = document.getElementById('timeline-offset-title-input');
    const seasonInput = document.getElementById('timeline-offset-season-input');
    const episodeInput = document.getElementById('timeline-offset-episode-input');
    const offsetInput = document.getElementById('timeline-offset-value-input');
    const modeInput = document.getElementById('timeline-offset-mode-input');

    const lineValue = buildTimelineOffsetLineValue({
        title: titleInput ? titleInput.value : '',
        season: seasonInput ? seasonInput.value : '',
        episode: episodeInput ? episodeInput.value : '',
        sources: getTimelineOffsetSelectedSources(),
        offset: offsetInput ? offsetInput.value : '',
        usePercent: modeInput ? modeInput.value === 'percent' : false
    });

    preview.textContent = lineValue || '请先填写剧名与偏移值';
}

function confirmTimelineOffsetAdd() {
    const container = document.getElementById('timeline-offset-container');
    if (!container) return;

    const titleInput = document.getElementById('timeline-offset-title-input');
    const seasonInput = document.getElementById('timeline-offset-season-input');
    const episodeInput = document.getElementById('timeline-offset-episode-input');
    const offsetInput = document.getElementById('timeline-offset-value-input');
    const modeInput = document.getElementById('timeline-offset-mode-input');

    const lineValue = buildTimelineOffsetLineValue({
        title: titleInput ? titleInput.value : '',
        season: seasonInput ? seasonInput.value : '',
        episode: episodeInput ? episodeInput.value : '',
        sources: getTimelineOffsetSelectedSources(),
        offset: offsetInput ? offsetInput.value : '',
        usePercent: modeInput ? modeInput.value === 'percent' : false
    });

    if (!lineValue) {
        customAlert('请填写剧名、偏移值，并至少选择一个来源', '⚠️ 提示');
        return;
    }

    const emptyState = container.querySelector('.timeline-offset-empty');
    if (emptyState) {
        emptyState.remove();
    }

    const parsed = parseTimelineOffsetLine(lineValue);
    const wrapper = document.createElement('div');
    wrapper.innerHTML = buildTimelineOffsetLineMarkup(parsed, container.querySelectorAll('.timeline-offset-line').length);
    const newLine = wrapper.firstElementChild;
    if (newLine) {
        container.appendChild(newLine);
    }

    hideTimelineOffsetModal();
}

function toggleTimelineOffsetSource(button) {
    if (!button) return;

    const sourceContainer = document.getElementById('timeline-offset-form-sources');
    if (!sourceContainer || !sourceContainer.contains(button)) return;

    const value = button.dataset.value || '';
    const chips = Array.from(sourceContainer.querySelectorAll('.platform-chip'));
    const isAll = value === 'all';

    if (isAll) {
        chips.forEach(chip => {
            chip.classList.toggle('selected', chip.dataset.value === 'all');
        });
        updateTimelineOffsetPreview();
        return;
    }

    button.classList.toggle('selected');
    chips.forEach(chip => {
        if (chip.dataset.value === 'all') {
            chip.classList.remove('selected');
        }
    });

    if (!chips.some(chip => chip.dataset.value !== 'all' && chip.classList.contains('selected'))) {
        chips.forEach(chip => {
            chip.classList.toggle('selected', chip.dataset.value === 'all');
        });
    }

    updateTimelineOffsetPreview();
}
// 点击模态框背景关闭
document.addEventListener('click', function(e) {
    const modal = document.getElementById('batch-import-modal');
    if (modal && e.target === modal) {
        closeBatchImportModal();
    }
});
/* ========================================
   导入方式选择对话框（追加/替换/取消）
   ======================================== */
// 全局变量存储待导入的颜色
let pendingImportColors = null;

function showImportModeDialog(colors) {
    // 保存颜色数据到全局变量
    pendingImportColors = colors;
    
    const dialog = document.createElement('div');
    dialog.className = 'custom-dialog-overlay';
    dialog.id = 'import-mode-dialog';
    dialog.innerHTML = \`
        <div class="custom-dialog-container">
            <div class="custom-dialog-header">
                <h3>📥 选择导入方式</h3>
            </div>
            <div class="custom-dialog-body">
                <p>检测到 <strong>\${colors.length}</strong> 个有效颜色</p>
                <p>请选择导入方式：</p>
            </div>
            <div class="custom-dialog-actions">
                <button type="button" class="btn btn-secondary" onclick="closeImportModeDialog('cancel')">
                    ❌ 取消
                </button>
                <button type="button" class="btn btn-warning" onclick="closeImportModeDialog('replace')">
                    🔄 替换
                </button>
                <button type="button" class="btn btn-primary" onclick="closeImportModeDialog('append')">
                    ➕ 追加
                </button>
            </div>
        </div>
    \`;
    
    document.body.appendChild(dialog);
    
    // 点击背景关闭
    dialog.addEventListener('click', function(e) {
        if (e.target === dialog) {
            closeImportModeDialog('cancel');
        }
    });
}

function closeImportModeDialog(mode) {
    const dialog = document.getElementById('import-mode-dialog');
    if (!dialog) return;
    
    const dialogContainer = dialog.querySelector('.custom-dialog-container');
    if (dialogContainer) {
        dialogContainer.style.animation = 'modalSlideOut 0.3s ease-out';
    }
    
    setTimeout(() => {
        dialog.remove();
    }, 300);
    
    if (mode === 'cancel' || !pendingImportColors) {
        addLog('ℹ️ 用户取消了批量导入操作', 'info');
        pendingImportColors = null;
        return;
    }
    
    const colors = pendingImportColors;
    const container = document.getElementById('color-pool-container');
    
    if (!container) {
        addLog('❌ 找不到颜色池容器', 'error');
        pendingImportColors = null;
        return;
    }
    
    if (mode === 'replace') {
        // 替换模式：清空现有颜色
        container.innerHTML = '';
        addLog(\`🔄 清空现有颜色池\`, 'info');
    }
    
    // 添加新颜色
    addLog(\`➕ 开始添加 \${colors.length} 个颜色\`, 'info');
    colors.forEach((colorInt, index) => {
        const chip = createColorChip(colorInt);
        chip.style.animationDelay = (index * 0.05) + 's';
        container.appendChild(chip);
    });
    
    updateColorPoolInput();
    
    const modeText = mode === 'append' ? '追加' : '替换';
    showSuccessAnimation(\`成功\${modeText} \${colors.length} 个颜色\`);
    addLog(\`✅ 批量导入颜色成功：\${modeText}了 \${colors.length} 个颜色\`, 'success');
    
    // 清理全局变量
    pendingImportColors = null;
}
/* ========================================
   高级调色板功能
   ======================================== */
let colorPickerState = {
    currentColor: { h: 0, s: 100, v: 100 },
    isOpen: false
};

function initAdvancedColorPicker() {
    const canvas = document.getElementById('color-picker-canvas');
    const hueCanvas = document.getElementById('color-picker-hue');
    
    if (!canvas || !hueCanvas) return;
    
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const hueCtx = hueCanvas.getContext('2d');
    
    // 绘制色相条
    drawHueBar(hueCtx, hueCanvas.width, hueCanvas.height);
    
    // 绘制主调色板
    updateColorCanvas(ctx, canvas.width, canvas.height, colorPickerState.currentColor.h);
    
    // 更新显示
    updateColorDisplay('#FFFFFF', 16777215);
    
    // 绑定事件
    setupColorPickerEvents(canvas, hueCanvas);
    
    // 点击外部关闭
    document.addEventListener('click', handleOutsideClick);
}

function drawHueBar(ctx, width, height) {
    for (let i = 0; i < width; i++) {
        const hue = (i / width) * 360;
        ctx.fillStyle = \`hsl(\${hue}, 100%, 50%)\`;
        ctx.fillRect(i, 0, 1, height);
    }
}

function updateColorCanvas(ctx, width, height, hue) {
    // 绘制饱和度和亮度渐变
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const s = (x / width) * 100;
            const v = 100 - (y / height) * 100;
            ctx.fillStyle = hsvToRgbString(hue, s, v);
            ctx.fillRect(x, y, 1, 1);
        }
    }
}

function setupColorPickerEvents(canvas, hueCanvas) {
    const cursor = document.getElementById('color-picker-cursor');
    const hueCursor = document.getElementById('color-hue-cursor');
    
    let isDraggingCanvas = false;
    let isDraggingHue = false;
    
    // 主画布事件
    canvas.addEventListener('mousedown', (e) => {
        isDraggingCanvas = true;
        updateColorFromCanvas(e, canvas, cursor);
    });
    
    canvas.addEventListener('touchstart', (e) => {
        isDraggingCanvas = true;
        updateColorFromCanvas(e.touches[0], canvas, cursor);
        e.preventDefault();
    });
    
    // 色相条事件
    hueCanvas.addEventListener('mousedown', (e) => {
        isDraggingHue = true;
        updateHueFromBar(e, hueCanvas, hueCursor, canvas);
    });
    
    hueCanvas.addEventListener('touchstart', (e) => {
        isDraggingHue = true;
        updateHueFromBar(e.touches[0], hueCanvas, hueCursor, canvas);
        e.preventDefault();
    });
    
    // 全局移动事件
    document.addEventListener('mousemove', (e) => {
        if (isDraggingCanvas) {
            updateColorFromCanvas(e, canvas, cursor);
        }
        if (isDraggingHue) {
            updateHueFromBar(e, hueCanvas, hueCursor, canvas);
        }
    });
    
    document.addEventListener('touchmove', (e) => {
        if (isDraggingCanvas) {
            updateColorFromCanvas(e.touches[0], canvas, cursor);
            e.preventDefault();
        }
        if (isDraggingHue) {
            updateHueFromBar(e.touches[0], hueCanvas, hueCursor, canvas);
            e.preventDefault();
        }
    });
    
    // 全局释放事件
    document.addEventListener('mouseup', () => {
        isDraggingCanvas = false;
        isDraggingHue = false;
    });
    
    document.addEventListener('touchend', () => {
        isDraggingCanvas = false;
        isDraggingHue = false;
    });
}

function updateColorFromCanvas(e, canvas, cursor) {
    const rect = canvas.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;
    
    x = Math.max(0, Math.min(x, rect.width));
    y = Math.max(0, Math.min(y, rect.height));
    
    const s = (x / rect.width) * 100;
    const v = 100 - (y / rect.height) * 100;
    
    colorPickerState.currentColor.s = s;
    colorPickerState.currentColor.v = v;
    
    cursor.style.left = x + 'px';
    cursor.style.top = y + 'px';
    
    updateColorFromState();
}

function updateHueFromBar(e, hueCanvas, hueCursor, canvas) {
    const rect = hueCanvas.getBoundingClientRect();
    let x = e.clientX - rect.left;
    
    x = Math.max(0, Math.min(x, rect.width));
    
    const hue = (x / rect.width) * 360;
    colorPickerState.currentColor.h = hue;
    
    hueCursor.style.left = x + 'px';
    
    // 重绘主画布
    const ctx = canvas.getContext('2d');
    updateColorCanvas(ctx, canvas.width, canvas.height, hue);
    
    updateColorFromState();
}

function updateColorFromState() {
    const { h, s, v } = colorPickerState.currentColor;
    const rgb = hsvToRgb(h, s, v);
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
    const decimal = parseInt(hex, 16);
    
    updateColorDisplay('#' + hex, decimal);
}

function updateColorDisplay(hexColor, decimal) {
    const preview = document.getElementById('color-preview');
    const previewLarge = document.getElementById('color-preview-large');
    const hexDisplay = document.getElementById('color-hex-display');
    const decDisplay = document.getElementById('color-dec-display');
    const hexInput = document.getElementById('color-hex-input');
    
    if (preview) preview.style.background = hexColor;
    if (previewLarge) previewLarge.style.background = hexColor;
    if (hexDisplay) hexDisplay.value = hexColor.substring(1);
    if (decDisplay) decDisplay.value = decimal;
    
    // 修复：如果当前焦点在输入框内，不要强制更新值，防止干扰用户输入
    if (hexInput && document.activeElement !== hexInput) {
        hexInput.value = hexColor.substring(1);
    }
}

function toggleColorPicker() {
    const dropdown = document.getElementById('color-picker-dropdown');
    const trigger = document.getElementById('color-picker-trigger');
    const wrapper = document.querySelector('.color-picker-panel-wrapper');
    const inputGroup = document.querySelector('.color-input-group');
    
    if (!dropdown) return;
    
    colorPickerState.isOpen = !colorPickerState.isOpen;
    
    if (colorPickerState.isOpen) {
        dropdown.classList.add('active');
        trigger.classList.add('active');
        if (wrapper) wrapper.classList.add('picker-active');
        if (inputGroup) inputGroup.classList.add('picker-active');
    } else {
        dropdown.classList.remove('active');
        trigger.classList.remove('active');
        if (wrapper) {
            setTimeout(() => {
                wrapper.classList.remove('picker-active');
            }, 300);
        }
        if (inputGroup) {
            setTimeout(() => {
                inputGroup.classList.remove('picker-active');
            }, 300);
        }
    }
}


function handleOutsideClick(e) {
    const wrapper = document.querySelector('.color-picker-panel-wrapper');
    const dropdown = document.getElementById('color-picker-dropdown');
    
    if (!wrapper || !dropdown) return;
    
    if (colorPickerState.isOpen && !wrapper.contains(e.target)) {
        dropdown.classList.remove('active');
        document.getElementById('color-picker-trigger').classList.remove('active');
        colorPickerState.isOpen = false;
    }
}

function hsvToRgb(h, s, v) {
    s = s / 100;
    v = v / 100;
    
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    
    let r, g, b;
    
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    
    return {
        r: Math.round((r + m) * 255),
        g: Math.round((g + m) * 255),
        b: Math.round((b + m) * 255)
    };
}

function hsvToRgbString(h, s, v) {
    const rgb = hsvToRgb(h, s, v);
    return \`rgb(\${rgb.r}, \${rgb.g}, \${rgb.b})\`;
}

function rgbToHex(r, g, b) {
    return ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0').toUpperCase();
}

function addColorFromPicker() {
    const hexDisplay = document.getElementById('color-hex-display');
    if (!hexDisplay) return;
    
    const hexValue = hexDisplay.value;
    const decimal = parseInt(hexValue, 16);
    
    if (isNaN(decimal)) {
        customAlert('无效的颜色值', '⚠️ 格式错误');
        return;
    }
    
    const container = document.getElementById('color-pool-container');
    const chip = createColorChip(decimal);
    container.appendChild(chip);
    updateColorPoolInput();
    
    // 添加成功反馈
    chip.style.animation = 'colorChipFadeIn 0.4s ease-out, pulse 0.6s ease-out';
    
    // 关闭调色板
    const dropdown = document.getElementById('color-picker-dropdown');
    const trigger = document.getElementById('color-picker-trigger');
    if (dropdown) dropdown.classList.remove('active');
    if (trigger) trigger.classList.remove('active');
    colorPickerState.isOpen = false;
}

// 修改原有的 syncHexToColorPicker 函数
const originalSyncHexToColorPicker = typeof syncHexToColorPicker !== 'undefined' ? syncHexToColorPicker : function() {};
syncHexToColorPicker = function(hexValue) {
    // 移除非hex字符
    hexValue = hexValue.replace(/[^0-9A-Fa-f]/g, '');
    
    if (hexValue.length === 6 || hexValue.length === 3) {
        if (hexValue.length === 3) {
            hexValue = hexValue.split('').map(char => char + char).join('');
        }
        
        // 更新调色板显示
        const decimal = parseInt(hexValue, 16);
        updateColorDisplay('#' + hexValue, decimal);
        
        // 更新调色板游标位置（可选）
        // 这里可以添加逻辑将hex转换回HSV并更新游标位置
    }
};

/* ========================================
   Bilibili Cookie 扫码登录功能（嵌入环境变量编辑器）
   ======================================== */
let biliQRCheckInterval = null;
let biliBiliQRKey = null;

/**
 * 开始 Bilibili 扫码登录
 */
async function startBilibiliQRLogin() {
    // 创建扫码登录模态框（如果不存在）
    if (!document.getElementById('bili-qr-modal')) {
        const modalHTML = \`
            <div class="modal-overlay" id="bili-qr-modal">
                <div class="modal-container" style="max-width: 400px;">
                    <div class="modal-header">
                        <h3 class="modal-title">📱 扫码登录 Bilibili</h3>
                        <button class="modal-close" onclick="closeBiliQRModal()">×</button>
                    </div>
                    <div class="modal-body" style="text-align: center; padding: 2rem;">
                        <div id="bili-qr-container" style="display: flex; flex-direction: column; align-items: center; gap: 1rem;">
                            <div class="loading-spinner" id="bili-qr-loading"></div>
                            <p id="bili-qr-status" style="color: var(--text-secondary); margin: 0;">正在生成二维码...</p>
                            <div id="bili-qr-code" style="display: none; padding: 1rem; background: white; border-radius: var(--radius-md);"></div>
                            <p id="bili-qr-hint" style="display: none; color: var(--text-secondary); font-size: 0.875rem; margin: 0;">
                                请使用 Bilibili APP 扫描二维码登录
                            </p>
                        </div>
                    </div>
                    <div class="modal-footer modal-footer-compact">
                        <button type="button" class="btn btn-secondary btn-modal" onclick="closeBiliQRModal()">
                            <span>取消</span>
                        </button>
                    </div>
                </div>
            </div>
        \`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    
    // 显示模态框
    const modal = document.getElementById('bili-qr-modal');
    const qrCode = document.getElementById('bili-qr-code');
    const qrLoading = document.getElementById('bili-qr-loading');
    const qrStatus = document.getElementById('bili-qr-status');
    const qrHint = document.getElementById('bili-qr-hint');
    
    modal.classList.add('active');
    
    // 重置状态
    qrCode.style.display = 'none';
    qrCode.innerHTML = '';
    qrLoading.style.display = 'block';
    qrStatus.textContent = '正在生成二维码...';
    qrStatus.style.color = 'var(--text-secondary)';
    qrHint.style.display = 'none';
    
    // 清除之前的轮询
    if (biliQRCheckInterval) {
        clearInterval(biliQRCheckInterval);
        biliQRCheckInterval = null;
    }
    
    addLog('🔐 正在获取 Bilibili 登录二维码...', 'info');
    
    try {
        // 调用后端API获取二维码
        const response = await fetch(buildApiUrl('/api/cookie/qr/generate', true), {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success && result.data) {
            biliBiliQRKey = result.data.qrcode_key;
            const qrUrl = result.data.url;
            
            // 使用第三方服务生成二维码图片
            qrCode.innerHTML = '<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(qrUrl) + '" alt="二维码" style="max-width: 200px;">';
            qrCode.style.display = 'block';
            qrLoading.style.display = 'none';
            qrStatus.textContent = '请使用 Bilibili APP 扫描';
            qrHint.style.display = 'block';
            
            addLog('✅ 二维码生成成功，等待扫码...', 'success');
            
            // 开始轮询检查扫码状态
            startBiliQRCheck();
        } else {
            throw new Error(result.message || '生成二维码失败');
        }
    } catch (error) {
        qrLoading.style.display = 'none';
        qrStatus.textContent = '❌ ' + error.message;
        qrStatus.style.color = 'var(--danger-color)';
        addLog('❌ 生成二维码失败: ' + error.message, 'error');
    }
}

/**
 * 轮询检查扫码状态
 */
function startBiliQRCheck() {
    if (!biliBiliQRKey) return;
    
    const qrStatus = document.getElementById('bili-qr-status');
    
    biliQRCheckInterval = setInterval(async () => {
        try {
            const response = await fetch(buildApiUrl('/api/cookie/qr/check', true), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    qrcode_key: biliBiliQRKey
                })
            });
            
            const result = await response.json();
            
            if (result.success && result.data) {
                const code = result.data.code;
                
                switch (code) {
                    case 86101:
                        qrStatus.textContent = '⏳ 等待扫码...';
                        qrStatus.style.color = 'var(--text-secondary)';
                        break;
                    case 86090:
                        qrStatus.textContent = '📱 已扫码，请在手机上确认';
                        qrStatus.style.color = 'var(--warning-color)';
                        addLog('📱 用户已扫码，等待确认...', 'info');
                        break;
                    case 86038:
                        qrStatus.textContent = '❌ 二维码已过期';
                        qrStatus.style.color = 'var(--danger-color)';
                        clearInterval(biliQRCheckInterval);
                        biliQRCheckInterval = null;
                        addLog('⏱️ 二维码已过期', 'warn');
                        break;
                    case 0:
                        // 登录成功！
                        qrStatus.textContent = '✅ 登录成功！';
                        qrStatus.style.color = 'var(--success-color)';
                        clearInterval(biliQRCheckInterval);
                        biliQRCheckInterval = null;
                        
                        addLog('🎉 Bilibili 登录成功！', 'success');
                        
                        // 获取 Cookie 并填入输入框
                        if (result.data.cookie) {
                            fillBilibiliCookie(result.data.cookie, result.data.refresh_token);
                        }
                        
                        setTimeout(() => {
                            closeBiliQRModal();
                            showSuccessAnimation('登录成功');
                        }, 1000);
                        break;
                    default:
                        qrStatus.textContent = '状态: ' + (result.data.message || code);
                }
            }
        } catch (error) {
            console.error('检查扫码状态失败:', error);
        }
    }, 2000);
}

/* ========================================
   将获取到的 Cookie 填入输入框
   ======================================== */
function fillBilibiliCookie(cookie, refreshToken) {
    const textInput = document.getElementById('text-value');
    if (textInput) {
        // 构建完整 Cookie 字符串，自动追加 refresh_token
        let fullCookie = cookie;
        if (refreshToken) {
            // 确保不重复添加
            if (!fullCookie.includes('refresh_token=')) {
                if (fullCookie && !fullCookie.endsWith(';') && !fullCookie.endsWith('; ')) {
                    fullCookie += '; ';
                }
                fullCookie += \`refresh_token=\${refreshToken}\`;
            }
        }

        // 根据输入框类型设置值
        if (textInput.tagName === 'TEXTAREA') {
            textInput.value = fullCookie;
        } else {
            textInput.value = fullCookie;
        }
        
        // 触发 input 事件以便其他监听器能够响应
        textInput.dispatchEvent(new Event('input', { bubbles: true }));
        
        // 高亮显示填入成功
        textInput.style.borderColor = 'var(--success-color)';
        textInput.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.2)';
        
        setTimeout(() => {
            textInput.style.borderColor = '';
            textInput.style.boxShadow = '';
        }, 2000);
        
        addLog('✅ Cookie 已自动填入，请点击保存按钮提交', 'success');
        
        // 触发一次自动检测以更新 UI 状态 (解决 UI 不刷新的问题)
        setTimeout(() => {
            if (typeof autoCheckBilibiliCookieStatus === 'function') {
                autoCheckBilibiliCookieStatus();
            }
        }, 500);
    }
}

/**
 * 关闭扫码登录模态框
 */
function closeBiliQRModal() {
    const modal = document.getElementById('bili-qr-modal');
    if (modal) {
        modal.classList.remove('active');
    }
    
    if (biliQRCheckInterval) {
        clearInterval(biliQRCheckInterval);
        biliQRCheckInterval = null;
    }
    
    biliBiliQRKey = null;
}

/* ========================================
   验证当前输入的 Bilibili Cookie
   ======================================== */
async function verifyBilibiliCookie() {
    // 修复：直接复用自动检测逻辑，解决 UI 不更新的问题
    if (typeof autoCheckBilibiliCookieStatus === 'function') {
        const textInput = document.getElementById('text-value');
        if (!textInput || !textInput.value.trim()) {
             customAlert('请先输入 Cookie', '⚠️ 未配置');
             return;
        }

        // 手动更新 UI 为检测中状态
        const statusTitle = document.getElementById('bili-cookie-status-title');
        const statusBadge = document.getElementById('bili-cookie-status-badge');
        
        if (statusTitle) statusTitle.textContent = '验证中...';
        if (statusBadge) {
            statusBadge.className = 'bili-cookie-status-badge loading';
            statusBadge.innerHTML = '<span class="status-dot loading"></span><span class="status-text">验证中</span>';
        }
        
        // 调用核心检测函数
        await autoCheckBilibiliCookieStatus();
        
    } else {
        customAlert('验证函数未初始化，请刷新页面重试', '❌ 错误');
    }
}

/* ========================================
   刷新 Bilibili Cookie（使用 refresh_token）
   ======================================== */
async function refreshBilibiliCookie() {
    const textInput = document.getElementById('text-value');
    
    if (!textInput) return;
    
    const cookie = textInput.value.trim();
    
    if (!cookie) {
        customAlert('请先输入或扫码获取 Cookie', '⚠️ 未配置');
        return;
    }
    
    // UI 元素引用
    const statusTitle = document.getElementById('bili-cookie-status-title');
    const statusSubtitle = document.getElementById('bili-cookie-status-subtitle');
    const statusBadge = document.getElementById('bili-cookie-status-badge');
    const statusIcon = document.getElementById('bili-cookie-status-icon');
    
    // 设置为刷新中状态
    if (statusTitle) statusTitle.textContent = '刷新中...';
    if (statusSubtitle) statusSubtitle.textContent = '正在尝试刷新 Token';
    if (statusBadge) {
        statusBadge.className = 'bili-cookie-status-badge loading';
        statusBadge.innerHTML = '<span class="status-dot loading"></span><span class="status-text">刷新中</span>';
    }
    if (statusIcon) {
        statusIcon.className = 'bili-cookie-status-icon loading';
        statusIcon.innerHTML = '<div class="bili-status-spinner"></div>';
    }
    
    addLog('🔄 正在刷新 Bilibili Cookie...', 'info');
    
    try {
        // 调用后端刷新接口
        const response = await fetch(buildApiUrl('/api/cookie/refresh-token', true), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ cookie: cookie })
        });
        
        const result = await response.json();
        
        if (result.success && result.data && result.data.newCookie) {
            let newCookie = result.data.newCookie;
            const newRefreshToken = result.data.newRefreshToken;
            const uname = result.data.uname || '未知用户';
            
            // 如果后端返回了新的 refresh_token，拼接到 cookie 后面
            if (newRefreshToken) {
                if (newCookie && !newCookie.endsWith(';') && !newCookie.endsWith('; ')) {
                    newCookie += '; ';
                }
                newCookie += \`refresh_token=\${newRefreshToken}\`;
            }

            // 更新输入框中的 Cookie
            textInput.value = newCookie;
            textInput.dispatchEvent(new Event('input', { bubbles: true }));
            
            // 高亮显示更新成功
            textInput.style.borderColor = 'var(--success-color)';
            textInput.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.2)';
            
            setTimeout(() => {
                textInput.style.borderColor = '';
                textInput.style.boxShadow = '';
            }, 2000);
            
            addLog('✅ Cookie 刷新成功，用户: ' + uname + '，请点击保存按钮提交', 'success');
            showSuccessAnimation('Cookie 已刷新');
            
            // 调用自动检测以更新 UI 卡片为成功状态
            if (typeof autoCheckBilibiliCookieStatus === 'function') {
                autoCheckBilibiliCookieStatus();
            }
            
        } else if (result.success && result.data && result.data.isValid) {
            // Cookie 仍然有效，无需刷新
            addLog('ℹ️ Cookie 仍然有效，无需刷新', 'info');
            customAlert('当前 Cookie 仍然有效，无需刷新', '✅ 无需刷新');
            
            // 恢复 UI 状态
            if (typeof autoCheckBilibiliCookieStatus === 'function') {
                autoCheckBilibiliCookieStatus();
            }
        } else {
            const errorMsg = result.data?.message || result.message || '刷新失败';
            
            // UI 显示错误
            if (statusTitle) statusTitle.textContent = '刷新失败';
            if (statusSubtitle) statusSubtitle.textContent = errorMsg;
            if (statusBadge) {
                statusBadge.className = 'bili-cookie-status-badge error';
                statusBadge.innerHTML = '<span class="status-dot error"></span><span class="status-text">失败</span>';
            }
            if (statusIcon) {
                statusIcon.className = 'bili-cookie-status-icon error';
                statusIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6m0-6l6 6"/></svg>';
            }
            
            addLog('❌ Cookie 刷新失败: ' + errorMsg + '，建议重新扫码登录', 'error');
        }
    } catch (error) {
        if (statusTitle) statusTitle.textContent = '请求失败';
        if (statusSubtitle) statusSubtitle.textContent = error.message;
        
        addLog('❌ Cookie 刷新请求失败: ' + error.message, 'error');
    }
}

/**
 * 自动检测 Bilibili Cookie 状态
 */
async function autoCheckBilibiliCookieStatus() {
    const textInput = document.getElementById('text-value');
    const statusCard = document.getElementById('bili-cookie-status-card');
    const statusIcon = document.getElementById('bili-cookie-status-icon');
    const statusTitle = document.getElementById('bili-cookie-status-title');
    const statusSubtitle = document.getElementById('bili-cookie-status-subtitle');
    const statusBadge = document.getElementById('bili-cookie-status-badge');
    const statusDetails = document.getElementById('bili-cookie-status-details');
    
    if (!textInput || !statusCard) return;
    
    const cookie = textInput.value.trim();
    
    // 更新为加载状态
    statusIcon.innerHTML = \`
        <div class="bili-status-spinner"></div>
    \`;
    statusIcon.className = 'bili-cookie-status-icon loading';
    statusTitle.textContent = '检测中...';
    statusSubtitle.textContent = '正在验证Cookie有效性';
    statusBadge.innerHTML = '<span class="status-dot loading"></span><span class="status-text">检测中</span>';
    statusBadge.className = 'bili-cookie-status-badge loading';
    statusDetails.style.display = 'none';
    
    if (!cookie) {
        // 无 Cookie
        statusIcon.innerHTML = \`
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 8v4m0 4h.01"/>
            </svg>
        \`;
        statusIcon.className = 'bili-cookie-status-icon empty';
        statusTitle.textContent = '未配置';
        statusSubtitle.textContent = '请扫码登录或手动输入Cookie';
        statusBadge.innerHTML = '<span class="status-dot empty"></span><span class="status-text">未配置</span>';
        statusBadge.className = 'bili-cookie-status-badge empty';
        return;
    }
    
    // 基本格式检查
    if (!cookie.includes('SESSDATA') || !cookie.includes('bili_jct')) {
        statusIcon.innerHTML = \`
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M15 9l-6 6m0-6l6 6"/>
            </svg>
        \`;
        statusIcon.className = 'bili-cookie-status-icon error';
        statusTitle.textContent = '格式错误';
        statusSubtitle.textContent = '缺少 SESSDATA 或 bili_jct';
        statusBadge.innerHTML = '<span class="status-dot error"></span><span class="status-text">无效</span>';
        statusBadge.className = 'bili-cookie-status-badge error';
        return;
    }
    
    try {
        const response = await fetch(buildApiUrl('/api/cookie/verify', true), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ cookie: cookie })
        });
        
        const result = await response.json();
        
        if (result.success && result.data && result.data.isValid) {
            const data = result.data;
            
            // 成功状态
            statusIcon.innerHTML = \`
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
            \`;
            statusIcon.className = 'bili-cookie-status-icon success';
            statusTitle.textContent = data.uname || '已登录';
            statusSubtitle.textContent = 'Cookie 有效';
            statusBadge.innerHTML = '<span class="status-dot success"></span><span class="status-text">有效</span>';
            statusBadge.className = 'bili-cookie-status-badge success';
            
            // 显示详细信息
            statusDetails.style.display = 'grid';
            document.getElementById('bili-cookie-uname').textContent = data.uname || '--';
            
            // 计算到期时间
            if (data.expiresAt) {
                const expiresDate = new Date(data.expiresAt * 1000);
                const now = new Date();
                const daysLeft = Math.ceil((expiresDate - now) / (1000 * 60 * 60 * 24));
                
                document.getElementById('bili-cookie-expire').textContent = expiresDate.toLocaleDateString('zh-CN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                });
                
                const daysLeftEl = document.getElementById('bili-cookie-days-left');
                daysLeftEl.textContent = daysLeft + ' 天';
                
                if (daysLeft <= 3) {
                    daysLeftEl.className = 'detail-value danger';
                    statusSubtitle.textContent = '⚠️ 即将过期，请及时刷新';
                } else if (daysLeft <= 7) {
                    daysLeftEl.className = 'detail-value warning';
                    statusSubtitle.textContent = '⚠️ 即将过期';
                } else {
                    daysLeftEl.className = 'detail-value';
                }
            } else {
                document.getElementById('bili-cookie-expire').textContent = '--';
                document.getElementById('bili-cookie-days-left').textContent = '--';
            }
            
            // VIP 状态
            const vipEl = document.getElementById('bili-cookie-vip');
            if (data.vipStatus === 1) {
                vipEl.textContent = '大会员';
                vipEl.className = 'detail-value vip';
            } else {
                vipEl.textContent = '普通用户';
                vipEl.className = 'detail-value';
            }
            
            addLog('✅ Cookie 自动验证通过，用户: ' + (data.uname || '未知'), 'success');
        } else {
            // 无效状态
            const errorMsg = result.data?.message || result.message || '无效或已过期';
            statusIcon.innerHTML = \`
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M15 9l-6 6m0-6l6 6"/>
                </svg>
            \`;
            statusIcon.className = 'bili-cookie-status-icon error';
            statusTitle.textContent = '无效';
            statusSubtitle.textContent = errorMsg;
            statusBadge.innerHTML = '<span class="status-dot error"></span><span class="status-text">无效</span>';
            statusBadge.className = 'bili-cookie-status-badge error';
            
            addLog('❌ Cookie 验证失败: ' + errorMsg, 'error');
        }
    } catch (error) {
        statusIcon.innerHTML = \`
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 8v4m0 4h.01"/>
            </svg>
        \`;
        statusIcon.className = 'bili-cookie-status-icon warning';
        statusTitle.textContent = '检测失败';
        statusSubtitle.textContent = '网络错误: ' + error.message;
        statusBadge.innerHTML = '<span class="status-dot warning"></span><span class="status-text">未知</span>';
        statusBadge.className = 'bili-cookie-status-badge warning';
        
        addLog('⚠️ Cookie 验证请求失败: ' + error.message, 'warn');
    }
}

/**
 * 切换 Cookie 显示/隐藏
 */
function toggleBiliCookieVisibility() {
    const textarea = document.getElementById('text-value');
    const overlay = document.getElementById('bili-cookie-overlay');
    const eyeIcon = document.getElementById('bili-eye-icon');
    
    if (!textarea || !overlay) return;
    
    if (overlay.style.display === 'none') {
        overlay.style.display = 'flex';
        eyeIcon.innerHTML = \`
            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
        \`;
    } else {
        overlay.style.display = 'none';
        eyeIcon.innerHTML = \`
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
        \`;
    }
}

/* ========================================
   AI API Key 连通性测试功能
   ======================================== */
async function verifyAiConnection() {
    const statusEl = document.getElementById('ai-apikey-status');
    const btn = document.getElementById('ai-verify-btn');
    const textInput = document.getElementById('text-value');
    
    if (!statusEl || !textInput) return;
    
    const apiKey = textInput.value.trim();
    
    // 如果输入框为空，提示未配置
    if (!apiKey) {
        statusEl.innerHTML = '<span class="ai-status-icon">⚠️</span><span class="ai-status-text">请先输入 API Key</span>';
        return;
    }
    
    // 设置按钮为加载状态
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="loading-spinner-small"></span>';
    btn.disabled = true;
    
    statusEl.innerHTML = '<span class="ai-status-icon">🔍</span><span class="ai-status-text">正在测试连通性...</span>';
    
    // 检查是否为脱敏后的 *...* 
    const isMasked = /^[*]+$/.test(apiKey);
    
    try {
        const response = await fetch(buildApiUrl('/api/ai/verify', true), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(isMasked ? {} : { 'aiApiKey': apiKey })
        });
        
        const result = await response.json();
        
        if (result.ok) {
            statusEl.innerHTML = '<span class="ai-status-icon">✅</span><span class="ai-status-text">' + (result.message || 'AI 服务连通性测试成功') + '</span>';
            statusEl.style.color = 'var(--success-color, #28a745)';
        } else {
            statusEl.innerHTML = '<span class="ai-status-icon">❌</span><span class="ai-status-text">' + (result.message || '连通性测试失败') + '</span>';
            statusEl.style.color = 'var(--danger-color, #dc3545)';
        }
    } catch (error) {
        statusEl.innerHTML = '<span class="ai-status-icon">⚠️</span><span class="ai-status-text">测试请求失败: ' + error.message + '</span>';
        statusEl.style.color = 'var(--warning-color, #ffc107)';
    } finally {
        // 恢复按钮状态
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}
`;
