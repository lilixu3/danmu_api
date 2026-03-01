import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Globals } from './danmu_api/configs/globals.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 定义要排除的UI相关模块
const uiModules = [
  './ui/template.js',
  '../ui/template.js',
  '../../ui/template.js',
  './ui/css/tokens.css.js',
  './ui/css/foundation.css.js',
  './ui/css/shell.css.js',
  './ui/css/components-shared.css.js',
  './ui/css/forms-controls.css.js',
  './ui/css/feature-overview.css.js',
  './ui/css/feature-settings.css.js',
  './ui/css/feature-api.css.js',
  './ui/css/status.css.js',
  './ui/css/theme-dark.css.js',
  './ui/css/responsive.css.js',
  './ui/js/main.js',
  './ui/js/preview.js',
  './ui/js/logview.js',
  './ui/js/apitest.js',
  './ui/js/pushdanmu.js',
  './ui/js/requestrecords.js',
  './ui/js/systemsettings.js',
  './utils/local-redis-util.js',
  'danmu_api/ui/template.js',
  'danmu_api/ui/css/tokens.css.js',
  'danmu_api/ui/css/foundation.css.js',
  'danmu_api/ui/css/shell.css.js',
  'danmu_api/ui/css/components-shared.css.js',
  'danmu_api/ui/css/forms-controls.css.js',
  'danmu_api/ui/css/feature-overview.css.js',
  'danmu_api/ui/css/feature-settings.css.js',
  'danmu_api/ui/css/feature-api.css.js',
  'danmu_api/ui/css/status.css.js',
  'danmu_api/ui/css/theme-dark.css.js',
  'danmu_api/ui/css/responsive.css.js',
  'danmu_api/ui/js/main.js',
  'danmu_api/ui/js/preview.js',
  'danmu_api/ui/js/logview.js',
  'danmu_api/ui/js/apitest.js',
  'danmu_api/ui/js/pushdanmu.js',
  'danmu_api/ui/js/requestrecords.js',
  'danmu_api/ui/js/systemsettings.js',
  'danmu_api/utils/local-redis-util.js'
];

const entryPath = path.resolve(__dirname, 'forward/forward-widget.js');
const distPath = path.resolve(__dirname, 'dist/logvar-danmu.js');
const polyfillPath = path.resolve(__dirname, 'forward/custom-polyfill.js');
const customPolyfillContent = fs.readFileSync(polyfillPath, 'utf8');

try {
  await esbuild.build({
    entryPoints: [entryPath],
    bundle: true,
    minify: false,
    sourcemap: false,
    platform: 'neutral',
    target: 'es2020',
    outfile: distPath,
    format: 'esm',
    external: ['redis'],
    plugins: [
      // 插件：排除UI相关模块
      {
        name: 'exclude-ui-modules',
        setup(build) {
          build.onResolve({ filter: /.*ui.*\.(css|js)$|.*template\.js$|.*local-redis-util\.js$/ }, (args) => {
            if (uiModules.some(uiModule => args.path.includes(uiModule.replace('./', '').replace('../', '')))) {
              return { path: args.path, external: true };
            }
          });
        }
      },
      // 插件：移除导出语句（仅对输出文件进行处理）
      {
        name: 'remove-exports',
        setup(build) {
          build.onEnd((result) => {
            if (result.errors.length === 0) {
              let outputContent = fs.readFileSync(distPath, 'utf8');

              // 更通用的模式，匹配包含这四个函数名的导出语句
              const genericExportPattern = /export\s*{\s*(?:\s*(?:getCommentsById|getDanmuWithSegmentTime|getDetailById|searchDanmu)\s*,?\s*){4}\s*};?/g;
              outputContent = outputContent.replace(genericExportPattern, '');

              // 替换 httpGet 和 httpPost
              outputContent = outputContent.replace(/await\s+httpGet/g, 'await Widget.http.get');
              outputContent = outputContent.replace(/await\s+httpPost/g, 'await Widget.http.post');

              // 删除本地redis相关
              outputContent = outputContent.replace(/.*setLocalRedisKey.*\n?/g, '\n');
              outputContent = outputContent.replace(/.*updateLocalRedisCaches.*\n?/g, '\n');

              fs.writeFileSync(distPath, outputContent);
            }
          });
        }
      }
    ],
    define: {
      widgetVersion: JSON.stringify(Globals.VERSION)
    },
    banner: {
      js: customPolyfillContent
    },
    logLevel: 'info'
  });

  console.log('Forward widget bundle created successfully!');
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}
