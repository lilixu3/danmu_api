import { aesDecryptEcbBase64, base64ToBytes, utf8BytesToString } from "./crypto-util.js";

export * from "./crypto-util.js";

// =====================
// 通用编码/解码工具
// =====================

// 简单的字符串哈希函数
export function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash >>> 0; // 确保为无符号 32 位整数
  }
  return hash.toString(16); // 转换为十六进制
}

// 辅助函数：序列化值，处理 Map 对象
export function serializeValue(key, value) {
  // 对于 lastSelectMap（Map 对象），需要转换为普通对象后再序列化
  if (key === 'lastSelectMap' && value instanceof Map) {
    return JSON.stringify(Object.fromEntries(value));
  }
  return JSON.stringify(value);
}

export function parseDanmakuBase64(base64) {
  const bytes = base64ToBytes(base64);
  const elems = [];

  let offset = 0;
  while (offset < bytes.length) {
    // 每个 DanmakuElem 在 elems 列表里是 length-delimited
    const key = bytes[offset++];
    if (key !== 0x0a) break; // field=1 (elems), wire=2
    const [msgBytes, nextOffset] = readLengthDelimited(bytes, offset);
    offset = nextOffset;

    let innerOffset = 0;
    const elem = {};

    while (innerOffset < msgBytes.length) {
      const tag = msgBytes[innerOffset++];
      const fieldNumber = tag >> 3;
      const wireType = tag & 0x07;

      if (wireType === 0) {
        const [val, innerNext] = readVarint(msgBytes, innerOffset);
        innerOffset = innerNext;
        switch (fieldNumber) {
          case 1: elem.id = val; break;
          case 2: elem.progress = val; break;
          case 3: elem.mode = val; break;
          case 4: elem.fontsize = val; break;
          case 5: elem.color = val; break;
          case 8: elem.ctime = val; break;
          case 9: elem.weight = val; break;
          case 11: elem.pool = val; break;
          case 13: elem.attr = val; break;
          case 15: elem.like_num = val; break;
          case 17: elem.dm_type_v2 = val; break;
        }
      } else if (wireType === 2) {
        const [valBytes, innerNext] = readLengthDelimited(msgBytes, innerOffset);
        innerOffset = innerNext;
        switch (fieldNumber) {
          case 6: elem.midHash = utf8BytesToString(valBytes); break;
          case 7: elem.content = utf8BytesToString(valBytes); break;
          case 10: elem.action = utf8BytesToString(valBytes); break;
          case 12: elem.idStr = utf8BytesToString(valBytes); break;
          case 14: elem.animation = utf8BytesToString(valBytes); break;
          case 16: elem.color_v2 = utf8BytesToString(valBytes); break;
        }
      } else {
        const [, innerNext] = readVarint(msgBytes, innerOffset);
        innerOffset = innerNext;
      }
    }

    elems.push(elem);
  }

  return elems;
}

function readVarint(bytes, offset) {
  let result = 0n;
  let shift = 0n;
  let pos = offset;
  while (true) {
    const b = bytes[pos++];
    result |= BigInt(b & 0x7f) << shift;
    if ((b & 0x80) === 0) break;
    shift += 7n;
  }
  return [Number(result), pos];
}

function readLengthDelimited(bytes, offset) {
  const [length, newOffset] = readVarint(bytes, offset);
  const start = newOffset;
  const end = start + length;
  const slice = bytes.slice(start, end);
  return [slice, end];
}

// djb2 哈希算法将string转成id
export function convertToAsciiSum(sid) {
  let hash = 5381;
  for (let i = 0; i < sid.length; i++) {
    hash = (hash * 33) ^ sid.charCodeAt(i);
  }
  hash = (hash >>> 0) % 9999999;
  // 确保至少 5 位
  return hash < 10000 ? hash + 10000 : hash;
}

export function autoDecode(anything) {
  const text = typeof anything === "string" ? anything.trim() : JSON.stringify(anything ?? "");
  try {
    return JSON.parse(text);
  } catch {}

  const AES_KEY = "3b744389882a4067";
  const dec = aesDecryptEcbBase64(text, AES_KEY);
  if (dec != null) {
    try {
      return JSON.parse(dec);
    } catch {
      return dec;
    }
  }
  return text;
}

function fromCodePoint(codePoint) {
  if (codePoint <= 0xFFFF) {
    return String.fromCharCode(codePoint);
  }

  codePoint -= 0x10000;
  const highSurrogate = (codePoint >> 10) + 0xD800;
  const lowSurrogate = (codePoint & 0x3FF) + 0xDC00;
  return String.fromCharCode(highSurrogate, lowSurrogate);
}

export function decodeHtmlEntities(str) {
  return str.replace(/&#(\d+);/g, (match, num) => {
    return fromCodePoint(parseInt(num, 10));
  }).replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => {
    return fromCodePoint(parseInt(hex, 16));
  });
}
