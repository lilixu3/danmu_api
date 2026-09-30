import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const project = fileURLToPath(new URL('../outbound/', import.meta.url));
mkdirSync(new URL('../outbound/bin/', import.meta.url), { recursive: true });
const name = process.platform === 'win32' ? 'danmu-outbound.exe' : 'danmu-outbound';
const result = spawnSync('go', ['build', '-trimpath', '-ldflags=-s -w', '-o', 'bin/' + name, '.'], { cwd: project, stdio: 'inherit' });
if (result.error) {
  console.error('构建增强直连组件需要 Go 1.26+。Termux 可运行 pkg install golang；安装后重新执行 npm run build:outbound。');
  process.exit(1);
}
process.exit(result.status ?? 1);
