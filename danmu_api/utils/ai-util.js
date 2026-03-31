import { httpPost } from "./http-util.js";

function normalizeBaseURL(baseURL) {
  return String(baseURL || '').trim().replace(/\/+$/, '');
}

function dedupeUrls(urls) {
  return [...new Set(urls.filter(Boolean))];
}

function looksLikeHtmlDocument(text) {
  const trimmed = String(text || '').trim().toLowerCase();
  return trimmed.startsWith('<!doctype html') || trimmed.startsWith('<html') || trimmed.includes('<head>') || trimmed.includes('<body>');
}

function parsePossibleJsonText(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return null;
  const first = trimmed[0];
  if (first !== '{' && first !== '[') return null;
  try {
    return JSON.parse(trimmed);
  } catch (_) {
    return null;
  }
}

function normalizePathname(pathname = '/') {
  const normalized = String(pathname || '/').replace(/\/+$/, '');
  return normalized || '/';
}

function joinPathname(basePath, suffixPath) {
  const left = normalizePathname(basePath);
  const right = String(suffixPath || '').replace(/^\/+/, '');
  if (!right) return left;
  if (left === '/') return `/${right}`;
  return `${left}/${right}`;
}

function hasVersionSegment(pathname = '') {
  return /\/v\d+(\/|$)/i.test(pathname);
}

function detectEndpointKind(url) {
  try {
    const pathname = normalizePathname(new URL(url).pathname);
    if (/\/chat\/completions$/i.test(pathname)) return 'chat';
    if (/\/responses$/i.test(pathname)) return 'responses';
    if (/\/completions$/i.test(pathname)) return 'completions';
    return 'unknown';
  } catch (_) {
    const plain = String(url || '').split('?')[0];
    if (/\/chat\/completions$/i.test(plain)) return 'chat';
    if (/\/responses$/i.test(plain)) return 'responses';
    if (/\/completions$/i.test(plain)) return 'completions';
    return 'unknown';
  }
}

function buildCompletionUrls(baseURL) {
  if (!baseURL) return [];

  try {
    const parsed = new URL(baseURL);
    const pathname = normalizePathname(parsed.pathname);
    const endpointKind = detectEndpointKind(baseURL);
    const candidates = [];

    const pushByPath = (path) => {
      const u = new URL(parsed.toString());
      u.pathname = path;
      candidates.push(u.toString());
    };

    // 允许直接填写完整接口 URL（含查询参数）
    if (endpointKind !== 'unknown') {
      candidates.push(parsed.toString());

      if (endpointKind !== 'chat') {
        pushByPath(pathname.replace(/\/(?:responses|completions)$/i, '/chat/completions'));
      }

      if (endpointKind === 'chat') {
        const prefix = pathname.replace(/\/chat\/completions$/i, '');
        if (!hasVersionSegment(prefix)) {
          pushByPath(joinPathname(prefix, '/v1/chat/completions'));
        }
      }

      return dedupeUrls(candidates);
    }

    // 根地址或 /v1 前缀
    pushByPath(joinPathname(pathname, '/chat/completions'));
    if (!hasVersionSegment(pathname)) {
      pushByPath(joinPathname(pathname, '/v1/chat/completions'));
    }

    return dedupeUrls(candidates);
  } catch (_) {
    // 非标准 URL 兜底（尽量兼容）
    const text = String(baseURL || '').trim();
    const [rawPath, rawQuery = ''] = text.split('?');
    const query = rawQuery ? `?${rawQuery}` : '';
    const cleanPath = rawPath.replace(/\/+$/, '');
    const endpointKind = detectEndpointKind(cleanPath);
    const candidates = [];

    if (endpointKind !== 'unknown') {
      candidates.push(`${cleanPath}${query}`);
      if (endpointKind !== 'chat') {
        candidates.push(`${cleanPath.replace(/\/(?:responses|completions)$/i, '/chat/completions')}${query}`);
      }
      if (endpointKind === 'chat' && !/\/v\d+\/chat\/completions$/i.test(cleanPath)) {
        candidates.push(`${cleanPath.replace(/\/chat\/completions$/i, '/v1/chat/completions')}${query}`);
      }
    } else {
      candidates.push(`${cleanPath}/chat/completions${query}`);
      if (!/\/v\d+$/i.test(cleanPath)) {
        candidates.push(`${cleanPath}/v1/chat/completions${query}`);
      }
    }

    return dedupeUrls(candidates);
  }
}

function extractTextFromContent(content) {
  if (typeof content === 'string') return content;

  if (Array.isArray(content)) {
    return content.map(item => {
      if (typeof item === 'string') return item;
      if (typeof item?.text === 'string') return item.text;
      if (typeof item?.content === 'string') return item.content;
      return '';
    }).join('');
  }

  if (content && typeof content === 'object') {
    if (typeof content.text === 'string') return content.text;
    if (typeof content.content === 'string') return content.content;
  }

  return '';
}

function extractTextFromResponseData(data) {
  if (typeof data === 'string') {
    if (looksLikeHtmlDocument(data)) {
      throw new Error('接口返回了 HTML 页面，请检查 AI_BASE_URL 是否指向正确的 AI API 地址');
    }

    const parsed = parsePossibleJsonText(data);
    if (parsed) {
      return extractTextFromResponseData(parsed);
    }

    return String(data || '').trim();
  }

  if (!data || typeof data !== 'object') {
    throw new Error('AI 返回为空或格式异常');
  }

  if (data.error) {
    const message = typeof data.error === 'string'
      ? data.error
      : (data.error.message || JSON.stringify(data.error));
    throw new Error(message);
  }

  const choiceContent = data?.choices?.[0]?.message?.content;
  const fromChoiceContent = extractTextFromContent(choiceContent).trim();
  if (fromChoiceContent) return fromChoiceContent;

  const fromChoiceText = typeof data?.choices?.[0]?.text === 'string'
    ? data.choices[0].text.trim()
    : '';
  if (fromChoiceText) return fromChoiceText;

  const fromOutputText = typeof data?.output_text === 'string' ? data.output_text.trim() : '';
  if (fromOutputText) return fromOutputText;

  if (Array.isArray(data?.output)) {
    for (const item of data.output) {
      const text = extractTextFromContent(item?.content).trim();
      if (text) return text;
      const nestedText = typeof item?.output_text === 'string' ? item.output_text.trim() : '';
      if (nestedText) return nestedText;
    }
  }

  const shortPayload = JSON.stringify(data).slice(0, 400);
  throw new Error(`无法解析 AI 响应文本，响应片段: ${shortPayload}`);
}

export default class AIClient {
  constructor({ apiKey, baseURL = 'https://api.openai.com/v1', model = 'gpt-4o', systemPrompt = '' }) {
    this.apiKey = apiKey
    this.baseURL = normalizeBaseURL(baseURL)
    this.model = model
    this.systemPrompt = systemPrompt
  }

  getCompletionUrls() {
    if (!this.baseURL) {
      throw new Error('AI_BASE_URL 未配置');
    }
    return buildCompletionUrls(this.baseURL);
  }

  buildChatBody(messages, options = {}) {
    const body = {
      model: options.model || this.model,
      messages,
      stream: false,
    };

    // 中转服务对可选参数支持差异较大，只有显式传入时才带上
    if (options.temperature !== undefined) {
      body.temperature = options.temperature;
    }
    if (options.maxTokens !== undefined) {
      body.max_tokens = options.maxTokens;
    }

    return body;
  }

  buildResponsesBody(messages, options = {}) {
    const body = {
      model: options.model || this.model,
      input: messages.map(item => ({ role: item.role, content: item.content })),
      stream: false,
    };

    if (options.temperature !== undefined) {
      body.temperature = options.temperature;
    }
    if (options.maxTokens !== undefined) {
      body.max_output_tokens = options.maxTokens;
    }

    return body;
  }

  buildLegacyCompletionBody(messages, options = {}) {
    const userMessage = [...messages].reverse().find(item => item?.role === 'user');
    const prompt = userMessage?.content || messages.map(item => item?.content || '').join('\n');

    const body = {
      model: options.model || this.model,
      prompt,
      stream: false,
    };

    if (options.temperature !== undefined) {
      body.temperature = options.temperature;
    }
    if (options.maxTokens !== undefined) {
      body.max_tokens = options.maxTokens;
    }

    return body;
  }

  buildBodyByEndpoint(messages, options = {}, completionUrl) {
    const endpointKind = detectEndpointKind(completionUrl);

    if (endpointKind === 'responses') {
      return this.buildResponsesBody(messages, options);
    }
    if (endpointKind === 'completions') {
      return this.buildLegacyCompletionBody(messages, options);
    }
    return this.buildChatBody(messages, options);
  }

  async chat(messages, options = {}) {
    const completionUrls = this.getCompletionUrls();
    const errors = [];

    for (const completionUrl of completionUrls) {
      try {
        const body = this.buildBodyByEndpoint(messages, options, completionUrl);
        const res = await httpPost(completionUrl, JSON.stringify(body), {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          timeout: 60000
        });

        const contentType = String(res?.headers?.['content-type'] || res?.headers?.['Content-Type'] || '').toLowerCase();
        if (contentType.includes('text/html')) {
          throw new Error('接口返回 text/html，可能是网关管理页或错误路由');
        }

        return extractTextFromResponseData(res.data);
      } catch (error) {
        errors.push(`[${completionUrl}] ${error?.message || '未知错误'}`);
      }
    }

    throw new Error(`AI 调用失败: ${errors.join(' | ')}`);
  }

  // 单轮对话快捷方法
  async ask(prompt, options = {}) {
    const messages = []
    if (this.systemPrompt) {
      messages.push({ role: 'system', content: this.systemPrompt })
    }
    messages.push({ role: 'user', content: prompt })
    return this.chat(messages, options)
  }

  // 多轮对话，自动维护历史
  session(options = {}) {
    const history = []
    const chat = this.chat.bind(this)  // 在这里固定好 this
    const systemPrompt = this.systemPrompt

    if (systemPrompt) {
        history.push({ role: 'system', content: systemPrompt })
    }

    return {
        async send(userMessage) {
            history.push({ role: 'user', content: userMessage })
            const reply = await chat(history, options)  // 直接用 chat，不依赖 this
            history.push({ role: 'assistant', content: reply })
            return reply
        },
        clear() {
            history.length = 0
            if (systemPrompt) {
                history.push({ role: 'system', content: systemPrompt })
            }
        },
        getHistory() {
            return [...history]
        },
    }
  }

  async verify() {
    try {
        const result = await this.ask('hi', { maxTokens: 1 })
        return { ok: true, reply: result }
    } catch (err) {
        return { ok: false, error: err.message }
    }
  }
}
