import esbuild from 'esbuild';
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
  './ui/css/base.css.js',
  './ui/css/components.css.js',
  './ui/css/forms.css.js',
  './ui/css/responsive.css.js',
  './ui/js/main.js',
  './ui/js/preview.js',
  './ui/js/logview.js',
  './ui/js/apitest.js',
  './ui/js/pushdanmu.js',
  './ui/js/requestrecords.js',
  './ui/js/systemsettings.js',
  'danmu_api/ui/template.js',
  'danmu_api/ui/css/base.css.js',
  'danmu_api/ui/css/components.css.js',
  'danmu_api/ui/css/forms.css.js',
  'danmu_api/ui/css/responsive.css.js',
  'danmu_api/ui/js/main.js',
  'danmu_api/ui/js/preview.js',
  'danmu_api/ui/js/logview.js',
  'danmu_api/ui/js/apitest.js',
  'danmu_api/ui/js/pushdanmu.js',
  'danmu_api/ui/js/requestrecords.js',
  'danmu_api/ui/js/systemsettings.js'
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
    plugins: [
      // 插件：排除UI相关模块
      {
        name: 'exclude-ui-modules',
        setup(build) {
          build.onResolve({ filter: /.*ui.*\.(css|js)$|.*template\.js$/ }, (args) => {
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
