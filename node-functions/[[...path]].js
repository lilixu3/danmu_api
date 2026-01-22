import { onRequest } from './index.js';

// EdgeOne rewrite 规则指向 /node-functions/[[...path]].js
// 原仓库里误写成了 "[[...path]]..js"（多了一个点），会导致生产部署找不到文件。
export { onRequest };
