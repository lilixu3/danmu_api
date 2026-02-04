/**
 * Cookie 管理处理模块
 * 提供 B站 Cookie 的状态查询、二维码登录、保存和清除功能
 */
import { jsonResponse } from './http-util.js';
import { log } from './log-util.js';
import { Globals } from '../configs/globals.js';
import { Envs } from '../configs/envs.js';

// 存储二维码登录会话（内存存储）
const qrLoginSessions = new Map();

/**
 * 保存Cookie到内存和环境变量
 * @param {string} cookie Cookie字符串
 */
function saveCookieToGlobals(cookie) {
    try {
        // 只更新运行时内存中的配置
        if (Globals.envs) {
            Globals.envs.bilibliCookie = cookie;
        }
        
        if (Envs.env) {
            Envs.env.BILIBILI_COOKIE = cookie;
        }
        
        // 更新 UI 显示用的变量
        if (Envs.originalEnvVars && typeof Envs.originalEnvVars.set === 'function') {
            Envs.originalEnvVars.set('BILIBILI_COOKIE', cookie);
        }
        
        log("info", `Cookie已保存，长度: ${cookie ? cookie.length : 0}`);
    } catch (err) {
        log("error", `保存Cookie失败: ${err.message}`);
    }
}

/**
 * 从多个位置获取Cookie
 * @returns {string} Cookie字符串
 */
function getCookieFromGlobals() {
    // 1. 从 Globals.envs 获取
    if (Globals.envs && Globals.envs.bilibliCookie) {
        return Globals.envs.bilibliCookie;
    }
    // 2. 从 Envs.env 获取
    if (Envs.env && Envs.env.BILIBILI_COOKIE) {
        return Envs.env.BILIBILI_COOKIE;
    }
    // 3. 从 process.env 获取 (Node.js)
    if (typeof process !== 'undefined' && process.env && process.env.BILIBILI_COOKIE) {
        return process.env.BILIBILI_COOKIE;
    }
    // 4. 尝试通过 Globals.getConfig() 获取
    try {
        const config = Globals.getConfig();
        if (config && config.bilibliCookie) {
            return config.bilibliCookie;
        }
    } catch (e) {
        // ignore
    }
    return '';
}

/**
 * 标准化 Cookie 字符串
 * 处理可能的编码问题和格式问题
 * @param {string} cookie 原始Cookie字符串
 * @returns {string} 标准化后的Cookie字符串
 */
function normalizeCookie(cookie) {
    if (!cookie) return '';
    
    try {
        // 去除首尾空白
        let normalized = cookie.trim();
        
        // 如果整个 cookie 被 URL 编码过（包含 %3D 即 = 号被编码），先解码
        if (normalized.includes('%3D') || normalized.includes('%3B')) {
            try {
                normalized = decodeURIComponent(normalized);
            } catch (e) {
                // 解码失败，保持原样
            }
        }
        
        // 标准化分号和空格
        // 将多个空格替换为单个空格
        normalized = normalized.replace(/\s+/g, ' ');
        
        // 确保分号后有空格（标准 Cookie 格式）
        normalized = normalized.replace(/;\s*/g, '; ').trim();
        
        // 移除末尾的分号
        if (normalized.endsWith(';')) {
            normalized = normalized.slice(0, -1).trim();
        }
        
        return normalized;
    } catch (e) {
        return cookie;
    }
}

/**
 * 验证 Cookie 有效性（核心验证函数）
 * @param {string} cookie Cookie字符串
 * @returns {Promise<{isValid: boolean, data?: object, error?: string}>}
 */
async function verifyCookieValidity(cookie) {
    if (!cookie) {
        return { isValid: false, error: '缺少Cookie' };
    }
    
    // 标准化 Cookie
    const normalizedCookie = normalizeCookie(cookie);
    
    // 基本格式检查
    if (!normalizedCookie.includes('SESSDATA') || !normalizedCookie.includes('bili_jct')) {
        return { isValid: false, error: 'Cookie格式不完整，需包含SESSDATA和bili_jct' };
    }
    
    try {
        const response = await fetch('https://api.bilibili.com/x/web-interface/nav', {
            method: 'GET',
            headers: {
                'Cookie': normalizedCookie,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.bilibili.com/',
                'Origin': 'https://www.bilibili.com',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
            }
        });
        
        const data = await response.json();
        
        if (data.code === 0 && data.data && data.data.isLogin) {
            log("info", `Cookie验证成功: ${data.data.uname}`);
            return {
                isValid: true,
                data: {
                    uname: data.data.uname,
                    mid: data.data.mid,
                    face: data.data.face,
                    level_info: data.data.level_info,
                    vipStatus: data.data.vipStatus,
                    isLogin: true
                }
            };
        } else {
            return {
                isValid: false,
                error: data.message || 'Cookie无效或已过期',
                code: data.code
            };
        }
    } catch (error) {
        log("error", `验证Cookie请求失败: ${error.message}`);
        return { isValid: false, error: '验证请求失败: ' + error.message };
    }
}

/**
 * 获取Cookie状态
 */
export async function handleCookieStatus() {
    try {
        const cookie = getCookieFromGlobals();
        
        if (!cookie) {
            log("info", `Cookie状态检查: 未配置`);
            return jsonResponse({
                success: true,
                data: {
                    isValid: false,
                    uname: null,
                    expiresAt: null
                }
            });
        }

        // 验证Cookie有效性
        const verifyResult = await verifyCookieValidity(cookie);
        
        if (verifyResult.isValid && verifyResult.data) {
            const normalizedCookie = normalizeCookie(cookie);
            // 解析Cookie获取各个字段
            const sessdataMatch = normalizedCookie.match(/SESSDATA=([^;]+)/);
            const biliJctMatch = normalizedCookie.match(/bili_jct=([^;]+)/);
            
            // 解析过期时间
            let expiresAt = null;
            try {
                if (sessdataMatch) {
                    let sessdata = sessdataMatch[1];
                    try {
                        sessdata = decodeURIComponent(sessdata);
                    } catch (decodeErr) {
                        // 解码失败，使用原值
                    }
                    
                    const parts = sessdata.split(',');
                    if (parts.length >= 2) {
                        const timestamp = parseInt(parts[1], 10);
                        const now = Math.floor(Date.now() / 1000);
                        if (!isNaN(timestamp) && timestamp > 1600000000 && timestamp < 2147483647 && timestamp > now) {
                            expiresAt = timestamp;
                        }
                    }
                }
            } catch (e) {
            }
            
            // 如果无法解析，使用默认值
            if (!expiresAt) {
                expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
            }
            
            return jsonResponse({
                success: true,
                data: {
                    isValid: true,
                    uname: verifyResult.data.uname,
                    face: verifyResult.data.face,
                    mid: verifyResult.data.mid,
                    level_info: verifyResult.data.level_info,
                    vipStatus: verifyResult.data.vipStatus,
                    sessdata: sessdataMatch ? sessdataMatch[1].substring(0, 8) + '****' : null,
                    bili_jct: biliJctMatch ? biliJctMatch[1].substring(0, 8) + '****' : null,
                    fullCookie: normalizedCookie.substring(0, 20) + '****',
                    expiresAt: expiresAt
                }
            });
        } else {
            return jsonResponse({
                success: true,
                data: {
                    isValid: false,
                    uname: null,
                    expiresAt: null,
                    error: verifyResult.error
                }
            });
        }
    } catch (error) {
        log("error", `获取Cookie状态失败: ${error.message}`);
        return jsonResponse({ success: false, message: error.message }, 500);
    }
}

/**
 * 生成登录二维码
 */
export async function handleQRGenerate() {
    // ... 保持原有逻辑不变 ...
    try {
        const response = await fetch('https://passport.bilibili.com/x/passport-login/web/qrcode/generate', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.bilibili.com'
            }
        });

        const data = await response.json();
        
        if (data.code !== 0) {
            log("error", `生成二维码失败: ${JSON.stringify(data)}`);
            return jsonResponse({
                success: false,
                message: '生成二维码失败: ' + (data.message || '未知错误')
            }, 400);
        }

        const qrcodeKey = data.data.qrcode_key;
        const qrcodeUrl = data.data.url;

        // 存储session（5分钟有效期）
        qrLoginSessions.set(qrcodeKey, {
            createTime: Date.now(),
            status: 'pending'
        });

        // 清理过期session（超过5分钟）
        const now = Date.now();
        for (const [key, session] of qrLoginSessions.entries()) {
            if (now - session.createTime > 5 * 60 * 1000) {
                qrLoginSessions.delete(key);
            }
        }

        log("info", `生成二维码成功, qrcode_key: ${qrcodeKey}`);

        return jsonResponse({
            success: true,
            data: {
                qrcode_key: qrcodeKey,
                url: qrcodeUrl
            }
        });
    } catch (error) {
        log("error", `生成二维码异常: ${error.message}`);
        return jsonResponse({ success: false, message: error.message }, 500);
    }
}

/**
 * 检查二维码扫描状态
 */
export async function handleQRCheck(request) {
    // ... 保持原有逻辑不变 ...
    try {
        const body = await request.json();
        const qrcodeKey = body.qrcodeKey || body.qrcode_key;

        if (!qrcodeKey) {
            return jsonResponse({ success: false, message: '缺少qrcodeKey参数' }, 400);
        }

        const response = await fetch(
            `https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=${qrcodeKey}`,
            {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://www.bilibili.com'
                }
            }
        );

        const data = await response.json();
        
        let cookie = null;
        let refresh_token = null;

        if (data.data.code === 0) {
            try {
                // 方法1: 从 URL 参数提取
                if (data.data.url) {
                    const url = new URL(data.data.url);
                    const params = new URLSearchParams(url.search);
                    const SESSDATA = params.get('SESSDATA') || '';
                    const bili_jct = params.get('bili_jct') || '';
                    const DedeUserID = params.get('DedeUserID') || '';
                    const DedeUserID__ckMd5 = params.get('DedeUserID__ckMd5') || '';
                    
                    if (SESSDATA) {
                        // 注意：这里 SESSDATA 可能是 URL 编码的，需要解码
                        const decodedSESSDATA = decodeURIComponent(SESSDATA);
                        const decodedBiliJct = decodeURIComponent(bili_jct);
                        const decodedDedeUserID = decodeURIComponent(DedeUserID);
                        const decodedDedeUserID__ckMd5 = decodeURIComponent(DedeUserID__ckMd5);
                        
                        cookie = `SESSDATA=${decodedSESSDATA}; bili_jct=${decodedBiliJct}; DedeUserID=${decodedDedeUserID}; DedeUserID__ckMd5=${decodedDedeUserID__ckMd5}`;
                    }
                }
                
                // 方法2: 从 Set-Cookie 响应头提取（更可靠）
                const setCookieHeaders = response.headers.getSetCookie ? 
                    response.headers.getSetCookie() : 
                    [response.headers.get('set-cookie')].filter(Boolean);
                
                if (setCookieHeaders && setCookieHeaders.length > 0) {
                    let cookieParts = {};
                    
                    for (const setCookie of setCookieHeaders) {
                        if (setCookie) {
                            const parts = setCookie.split(';')[0].split('=');
                            if (parts.length >= 2) {
                                const key = parts[0].trim();
                                const value = parts.slice(1).join('=').trim();
                                if (['SESSDATA', 'bili_jct', 'DedeUserID', 'DedeUserID__ckMd5', 'sid'].includes(key)) {
                                    cookieParts[key] = value;
                                }
                            }
                        }
                    }
                    
                    // 如果从响应头获取到了 Cookie，优先使用
                    if (Object.keys(cookieParts).length > 0) {
                        const cookieFromHeaders = Object.entries(cookieParts)
                            .map(([key, value]) => `${key}=${value}`)
                            .join('; ');
                        
                        if (cookieFromHeaders) {
                            cookie = cookieFromHeaders;
                            log("info", `从Set-Cookie响应头提取Cookie成功，长度: ${cookie.length}`);
                        }
                    }
                }
                
                // 提取 refresh_token（用于后续刷新Cookie）
                if (data.data.refresh_token) {
                    refresh_token = data.data.refresh_token;
                    log("info", `获取到refresh_token`);
                }
            } catch (parseError) {
                log("error", `解析登录响应失败: ${parseError.message}`);
            }
        }

        if (qrLoginSessions.has(qrcodeKey)) {
            qrLoginSessions.get(qrcodeKey).status = data.data.code === 0 ? 'success' : 'pending';
        }

        const result = {
            success: true,
            data: {
                code: data.data.code,
                message: data.data.message || '',
                url: data.data.url || null,
                refresh_token: refresh_token
            }
        };
        
        if (cookie) {
            result.data.cookie = cookie;
        }

        return jsonResponse(result);
    } catch (error) {
        log("error", `检查二维码状态异常: ${error.message}`);
        return jsonResponse({ success: false, message: error.message }, 500);
    }
}

/**
 * 验证Cookie有效性（新增的独立验证接口）
 * 用于环境变量配置界面中验证输入的Cookie
 */
export async function handleCookieVerify(request) {
    try {
        const body = await request.json();
        const cookie = body.cookie;
        
        if (!cookie) {
            return jsonResponse({ 
                success: false, 
                message: '缺少cookie参数' 
            }, 400);
        }
        
        // 1. 标准化 Cookie (关键步骤)
        const normalizedCookie = normalizeCookie(cookie);

        // 2. 使用统一的验证函数 (传入标准化后的 Cookie)
        const verifyResult = await verifyCookieValidity(normalizedCookie);
        
        if (verifyResult.isValid) {
            // 尝试从 Cookie 中解析 SESSDATA 的过期时间
            let expiresAt = null;
            try {
                // 使用标准化后的 Cookie 进行匹配，避免编码问题
                const sessdataMatch = normalizedCookie.match(/SESSDATA=([^;]+)/);
                
                if (sessdataMatch) {
                    // 先尝试 URL 解码
                    let sessdata = sessdataMatch[1];
                    try {
                        sessdata = decodeURIComponent(sessdata);
                    } catch (decodeErr) {
                        // 解码失败，使用原值
                    }
                    
                    const parts = sessdata.split(',');
                    
                    if (parts.length >= 2) {
                        // 第二部分是时间戳（秒级）
                        const timestampStr = parts[1].trim();
                        const timestamp = parseInt(timestampStr, 10);
                        
                        const now = Math.floor(Date.now() / 1000);
                        if (!isNaN(timestamp) && timestamp > 1600000000 && timestamp < 2147483647 && timestamp > now) {
                            expiresAt = timestamp;
                        }
                    }
                }
            } catch (e) {
            }
            
            // 如果无法从 SESSDATA 解析，使用预估值（30天，保守估计）
            if (!expiresAt) {
                expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
            }
            
            return jsonResponse({
                success: true,
                data: {
                    isValid: true,
                    uname: verifyResult.data.uname,
                    mid: verifyResult.data.mid,
                    face: verifyResult.data.face,
                    vipStatus: verifyResult.data.vipStatus,
                    expiresAt: expiresAt
                }
            });
        } else {
            return jsonResponse({
                success: true,
                data: {
                    isValid: false,
                    message: verifyResult.error
                }
            });
        }
    } catch (error) {
        log("error", `验证Cookie异常: ${error.message}`);
        return jsonResponse({ success: false, message: error.message }, 500);
    }
}

/**
 * 保存Cookie
 */
export async function handleCookieSave(request) {
    try {
        const body = await request.json();
        const cookie = body.cookie || body.data?.cookie || '';

        if (!cookie) {
            return jsonResponse({ success: false, message: '缺少cookie参数' }, 400);
        }

        // 标准化 Cookie
        const normalizedCookie = normalizeCookie(cookie);

        if (!normalizedCookie.includes('SESSDATA') || !normalizedCookie.includes('bili_jct')) {
            return jsonResponse({ 
                success: false, 
                message: 'Cookie格式不正确，需要包含SESSDATA和bili_jct' 
            }, 400);
        }

        // 验证 Cookie
        const verifyResult = await verifyCookieValidity(normalizedCookie);
        
        if (!verifyResult.isValid) {
            return jsonResponse({ 
                success: false, 
                message: 'Cookie验证失败: ' + (verifyResult.error || '无效或已过期')
            }, 400);
        }

        // 保存Cookie
        saveCookieToGlobals(normalizedCookie);

        log("info", `Cookie保存成功，用户: ${verifyResult.data.uname}`);

        return jsonResponse({
            success: true,
            data: {
                uname: verifyResult.data.uname,
                mid: verifyResult.data.mid,
                face: verifyResult.data.face
            },
            message: 'Cookie保存成功'
        });
    } catch (error) {
        log("error", `保存Cookie异常: ${error.message}`);
        return jsonResponse({ success: false, message: error.message }, 500);
    }
}

/**
 * 清除Cookie
 */
export async function handleCookieClear() {
    try {
        saveCookieToGlobals('');

        log("info", `Cookie已清除`);
        return jsonResponse({ 
            success: true, 
            data: null,
            message: 'Cookie已清除' 
        });
    } catch (error) {
        log("error", `清除Cookie异常: ${error.message}`);
        return jsonResponse({ success: false, message: error.message }, 500);
    }
}

/**
 * 刷新/验证Cookie
 */
export async function handleCookieRefresh() {
    try {
        const cookie = getCookieFromGlobals();
        
        if (!cookie) {
            return jsonResponse({ 
                success: false, 
                message: '没有已保存的Cookie' 
            }, 400);
        }

        const verifyResult = await verifyCookieValidity(cookie);
        
        if (verifyResult.isValid) {
            return jsonResponse({
                success: true,
                data: {
                    isValid: true,
                    uname: verifyResult.data.uname,
                    mid: verifyResult.data.mid,
                    face: verifyResult.data.face,
                    level_info: verifyResult.data.level_info,
                    vipStatus: verifyResult.data.vipStatus
                },
                message: 'Cookie仍然有效'
            });
        } else {
            return jsonResponse({
                success: false,
                message: 'Cookie已失效: ' + (verifyResult.error || '请重新扫码登录')
            }, 400);
        }
    } catch (error) {
        log("error", `刷新Cookie异常: ${error.message}`);
        return jsonResponse({ success: false, message: error.message }, 500);
    }
}


/**
 * 使用 refresh_token 刷新 Cookie（修复版）
 */
export async function handleCookieRefreshToken(request) {
    try {
        const body = await request.json();
        const cookie = body.cookie;
        
        if (!cookie) {
            return jsonResponse({ 
                success: false, 
                message: '缺少cookie参数' 
            }, 400);
        }
        
        log("info", `刷新Cookie请求，Cookie长度: ${cookie.length}`);
        
        // 1. 标准化 Cookie
        const normalizedCookie = normalizeCookie(cookie);
        
        // 先验证当前 Cookie 是否有效
        const verifyResult = await verifyCookieValidity(normalizedCookie);
        
        if (!verifyResult.isValid) {
            return jsonResponse({
                success: false,
                data: {
                    isValid: false,
                    message: 'Cookie已失效，请重新扫码登录'
                }
            });
        }
        
        // 获取 refresh_token
        // 优先级：请求参数 -> Cookie 字符串中提取 -> 环境变量
        let refreshToken = body.refresh_token || '';
        
        // 如果请求体没有，尝试从 Cookie 字符串中提取 refresh_token
        if (!refreshToken && cookie.includes('refresh_token=')) {
            const match = cookie.match(/refresh_token=([^;]+)/);
            if (match && match[1]) {
                refreshToken = match[1].trim();
                log("info", "从Cookie字符串中提取到 refresh_token");
            }
        }

        if (!refreshToken) {
            // 没有 refresh_token，返回当前 Cookie 仍有效
            let expiresAt = parseExpiresFromCookie(normalizedCookie);
            
            return jsonResponse({
                success: true,
                data: {
                    isValid: true,
                    uname: verifyResult.data.uname,
                    mid: verifyResult.data.mid,
                    expiresAt: expiresAt,
                    message: '没有refresh_token，无法刷新。当前Cookie仍有效。'
                }
            });
        }
        
        log("info", "尝试刷新Cookie");
        
        try {
            // 提取 csrf (bili_jct)
            const csrf = extractBiliJct(normalizedCookie);
            if (!csrf) {
                log("warn", "无法从Cookie中提取bili_jct");
                return jsonResponse({
                    success: true,
                    data: {
                        isValid: true,
                        uname: verifyResult.data.uname,
                        mid: verifyResult.data.mid,
                        expiresAt: parseExpiresFromCookie(normalizedCookie),
                        message: '无法提取csrf，刷新失败。当前Cookie仍有效。'
                    }
                });
            }
            
            // 步骤1: 获取 correspondPath
            const ts = Date.now();
            const correspondPath = await getCorrespondPath(ts);
            
            if (!correspondPath) {
                return jsonResponse({
                    success: true,
                    data: {
                        isValid: true,
                        uname: verifyResult.data.uname,
                        mid: verifyResult.data.mid,
                        expiresAt: parseExpiresFromCookie(normalizedCookie),
                        message: '获取correspondPath失败。当前Cookie仍有效。'
                    }
                });
            }
            
            // 步骤2: 获取 refresh_csrf
            const refreshCsrf = await getRefreshCsrf(correspondPath, normalizedCookie);
            
            if (!refreshCsrf) {
                return jsonResponse({
                    success: true,
                    data: {
                        isValid: true,
                        uname: verifyResult.data.uname,
                        mid: verifyResult.data.mid,
                        expiresAt: parseExpiresFromCookie(normalizedCookie),
                        message: '获取refresh_csrf失败。当前Cookie仍有效。'
                    }
                });
            }
            
            // 步骤3: 调用刷新接口
            const refreshResponse = await fetch('https://passport.bilibili.com/x/passport-login/web/cookie/refresh', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://www.bilibili.com',
                    'Origin': 'https://www.bilibili.com',
                    'Cookie': normalizedCookie
                },
                body: new URLSearchParams({
                    'csrf': csrf,
                    'refresh_csrf': refreshCsrf,
                    'source': 'main_web',
                    'refresh_token': refreshToken
                }).toString()
            });
            
            const refreshResult = await refreshResponse.json();
            
            if (refreshResult.code === 0 && refreshResult.data) {
                // 刷新成功，从响应头获取新的 Cookie
                const setCookieHeaders = refreshResponse.headers.getSetCookie ? 
                    refreshResponse.headers.getSetCookie() : 
                    [refreshResponse.headers.get('set-cookie')].filter(Boolean);
                
                let newCookieParts = {};
                
                // 解析 Set-Cookie 头
                for (const setCookie of setCookieHeaders) {
                    if (setCookie) {
                        const parts = setCookie.split(';')[0].split('=');
                        if (parts.length >= 2) {
                            const key = parts[0].trim();
                            const value = parts.slice(1).join('=').trim();
                            if (['SESSDATA', 'bili_jct', 'DedeUserID', 'DedeUserID__ckMd5', 'sid'].includes(key)) {
                                newCookieParts[key] = value;
                            }
                        }
                    }
                }
                
                // 合并新旧 Cookie
                const oldCookieParts = {};
                normalizedCookie.split(';').forEach(part => {
                    const [key, ...valueParts] = part.trim().split('=');
                    if (key && valueParts.length > 0) {
                        oldCookieParts[key.trim()] = valueParts.join('=');
                    }
                });
                
                const mergedCookieParts = { ...oldCookieParts, ...newCookieParts };
                
                const newCookie = Object.entries(mergedCookieParts)
                    .filter(([key]) => ['SESSDATA', 'bili_jct', 'DedeUserID', 'DedeUserID__ckMd5', 'sid'].includes(key))
                    .map(([key, value]) => `${key}=${value}`)
                    .join('; ');
                
                // 验证新 Cookie
                const newVerifyResult = await verifyCookieValidity(newCookie);
                
                if (newVerifyResult.isValid) {
                    let expiresAt = parseExpiresFromCookie(newCookie);
                    
                    log("info", `Cookie刷新成功，用户: ${newVerifyResult.data.uname}`);
                    
                    // 获取新的 refresh_token（如果有）
                    const newRefreshToken = refreshResult.data.refresh_token;
                    
                    // 步骤4: 确认刷新（使旧token失效）
                    try {
                        await confirmRefresh(csrf, refreshToken);
                    } catch (confirmErr) {
                        // 确认失败不影响使用
                    }
                    
                    return jsonResponse({
                        success: true,
                        data: {
                            newCookie: newCookie,
                            uname: newVerifyResult.data.uname,
                            mid: newVerifyResult.data.mid,
                            expiresAt: expiresAt,
                            newRefreshToken: newRefreshToken || null,
                            refreshed: true
                        }
                    });
                } else {
                    return jsonResponse({
                        success: false,
                        data: {
                            isValid: false,
                            message: '刷新后的Cookie验证失败，请重新扫码登录'
                        }
                    });
                }
            } else {
                const errorMsg = refreshResult.message || '刷新失败';
                
                return jsonResponse({
                    success: true,
                    data: {
                        isValid: true,
                        uname: verifyResult.data.uname,
                        mid: verifyResult.data.mid,
                        expiresAt: parseExpiresFromCookie(normalizedCookie),
                        message: `刷新失败(${errorMsg})，当前Cookie仍有效`
                    }
                });
            }
        } catch (refreshError) {
            
            return jsonResponse({
                success: true,
                data: {
                    isValid: true,
                    uname: verifyResult.data.uname,
                    mid: verifyResult.data.mid,
                    expiresAt: parseExpiresFromCookie(normalizedCookie),
                    message: '刷新请求失败，当前Cookie仍有效'
                }
            });
        }
    } catch (error) {
        log("error", `刷新Cookie异常: ${error.message}`);
        return jsonResponse({ success: false, message: error.message }, 500);
    }
}

/**
 * 从Cookie中解析过期时间
 */
function parseExpiresFromCookie(cookie) {
    try {
        const sessdataMatch = cookie.match(/SESSDATA=([^;]+)/);
        if (sessdataMatch) {
            let sessdata = sessdataMatch[1];
            try {
                sessdata = decodeURIComponent(sessdata);
            } catch (e) {}
            
            const parts = sessdata.split(',');
            if (parts.length >= 2) {
                const timestamp = parseInt(parts[1], 10);
                const now = Math.floor(Date.now() / 1000);
                if (!isNaN(timestamp) && timestamp > 1600000000 && timestamp < 2147483647 && timestamp > now) {
                    return timestamp;
                }
            }
        }
    } catch (e) {
        log("warn", `解析过期时间失败: ${e.message}`);
    }
    return Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
}

/**
 * 获取 correspondPath（用于刷新Cookie）
 * 使用 RSA 加密时间戳
 */
async function getCorrespondPath(timestamp) {
    try {
        // B站的公钥
        const publicKey = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDLgd2OAkcGVtoE3ThUREbio0Eg
Uc/prcajMKXvkCKFCWhJYJcLkcM2DKKcSeFpD/j6Boy538YXnR6VhcuUJOhH2x71
nzPjfdTcqMz7djHum0qSZA0AyCBDABUqCrfNgCiJ00Ra7GmRj+YCK1NJEuewlb40
JNrRuoEUXpabUzGB8QIDAQAB
-----END PUBLIC KEY-----`;

        // 动态导入 crypto 模块（Node.js 环境）
        let crypto;
        try {
            crypto = await import('crypto');
        } catch (e) {
            // 浏览器环境不支持
            return null;
        }
        
        const data = `refresh_${timestamp}`;
        
        const encrypted = crypto.publicEncrypt(
            {
                key: publicKey,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: 'sha256'
            },
            Buffer.from(data)
        );
        
        return encrypted.toString('hex');
    } catch (error) {
        log("error", `生成correspondPath失败: ${error.message}`);
        return null;
    }
}

/**
 * 获取 refresh_csrf
 */
async function getRefreshCsrf(correspondPath, cookie) {
    try {
        const url = `https://www.bilibili.com/correspond/1/${correspondPath}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.bilibili.com/',
                'Cookie': cookie
            }
        });
        
        const html = await response.text();
        
        // 从 HTML 中提取 refresh_csrf
        const match = html.match(/<div id="1-name">([^<]+)<\/div>/);
        if (match && match[1]) {
            return match[1];
        }
        
        return null;
    } catch (error) {
        log("error", `获取refresh_csrf失败: ${error.message}`);
        return null;
    }
}

/**
 * 确认刷新（使旧的 refresh_token 失效）
 */
async function confirmRefresh(csrf, oldRefreshToken) {
    try {
        await fetch('https://passport.bilibili.com/x/passport-login/web/confirm/refresh', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.bilibili.com'
            },
            body: new URLSearchParams({
                'csrf': csrf,
                'refresh_token': oldRefreshToken
            }).toString()
        });
    } catch (error) {
        // 确认失败不是致命错误
        throw error;
    }
}


/**
 * 从 Cookie 中提取 bili_jct（csrf token）
 */
function extractBiliJct(cookie) {
    const match = cookie.match(/bili_jct=([^;]+)/);
    return match ? match[1] : '';
}