import test from "node:test";
import assert from "node:assert/strict";
import {
  aesCbcDecryptPure,
  aesCbcEncryptPure,
  md5,
  stringToUtf8Bytes,
  utf8BytesToString,
} from "./utils/crypto-util.js";

test("crypto-util md5 should match known digest", () => {
  assert.equal(md5("abc"), "900150983cd24fb0d6963f7d28e17f72");
});

test("crypto-util AES CBC helpers should roundtrip UTF-8 text", () => {
  const plainText = "韩剧TV final architecture";
  const keyBytes = stringToUtf8Bytes("1234567890abcdef");
  const ivBytes = stringToUtf8Bytes("fedcba0987654321");
  const cipherBytes = aesCbcEncryptPure(stringToUtf8Bytes(plainText), keyBytes, ivBytes);
  const decoded = utf8BytesToString(aesCbcDecryptPure(cipherBytes, keyBytes, ivBytes));

  assert.equal(decoded, plainText);
});
