# 给本项目绑定自己的域名（Spaceship + Cloudflare + Vercel）

本文只讲一件事：**把已经部署到 Vercel 的本项目，绑定到你自己的域名上。**

说明：
- 域名提供商用 **Spaceship** 举例。
- DNS 托管用 **Cloudflare** 举例。
- 云平台只用 **Vercel** 举例。
- 本项目也支持其他平台部署，但这篇只适用于 **Vercel 自定义域名**。

## 开始前准备

你需要先有这些东西：

- 一个已经部署成功的 Vercel 项目
- 一个你自己的域名
- Cloudflare 账号
- Spaceship 账号（如果你的域名不在 Spaceship，也没关系，后面只需要去你的注册商后台改 nameserver）

## 第 1 步：先在 Vercel 里添加域名

进入你的项目：

- `Settings`
- `Domains`
- `Add Domain`

然后：

- 输入你最终要使用的域名
- 点确认

例如：

- 你最终要用 `www.example.com`
- 那这里就先添加 `www.example.com`

### 可选：如果你还想让另一个域名自动跳转过来

例如：

- 正式地址是 `www.example.com`
- 同时希望 `example.com` 也能打开，并自动跳到 `www.example.com`

那就这样做：

1. 先添加 `www.example.com`
2. 回到同一个 `Domains` 页面
3. 再点一次 `Add Domain`
4. 再添加 `example.com`
5. 在 `example.com` 这一条记录里点 `Edit`
6. 把 `Redirect to` 设为 `www.example.com`

注意：

- **一个输入框一次只加一个域名**
- 如果你要两个域名，就在同一个项目里点两次 `Add Domain`

## 第 2 步：看 Vercel 让你填什么记录

这一步最重要：**后面在 Cloudflare 里填什么，完全以 Vercel 当前页面显示为准。**

你常见到的情况是：

| 域名类型 | Vercel 常见提示 | 你后面要做什么 |
|---|---|---|
| 根域名 `example.com` | `A` 记录，常见值是 `76.76.21.21` | 去 Cloudflare 添加一条 `A` |
| 子域名 `www.example.com` | `CNAME`，常见值是 `cname.vercel-dns.com` 或其他 Vercel 当前给出的值 | 去 Cloudflare 添加一条 `CNAME` |
| 某些情况 | `TXT` 验证记录 | 只有 Vercel 明确要求时才加 |

## 第 3 步：把域名添加到 Cloudflare

登录 Cloudflare 后：

1. 点 `Add a domain`
2. 输入你的域名，例如 `example.com`
3. 选 Free 套餐
4. 继续下一步

Cloudflare 会给你两条 nameserver，先不要关页面，下一步要拿去注册商后台填。

## 第 4 步：去 Spaceship 改 nameserver

如果你的域名在 Spaceship，就去域名后台找到：

- `Advanced DNS`
- `Nameservers`
- `Change`
- `Custom nameservers`

然后把 Cloudflare 给你的两条 nameserver 填进去并保存。

如果你的域名不在 Spaceship，也一样：

- 去你的域名注册商后台
- 找到 `Nameservers`
- 改成 Cloudflare 给你的两条 nameserver

注意：

- 如果注册商后台开着 `DNSSEC`，先关掉，再改 nameserver

## 第 5 步：回到 Cloudflare 填 DNS

进入：

- `Cloudflare`
- 你的域名
- `DNS`
- `Add record`

### 这里有一条必须记住

**指向 Vercel 的 `A` 和 `CNAME`，`Proxy status` 一律选 `DNS only`，不要开橙云。**

按 Vercel 页面提示填写：

| 如果 Vercel 让你加 | Cloudflare 里这样填 |
|---|---|
| `A` | `Type = A`，`Name = @`，`IPv4 = Vercel 显示的值`，`Proxy status = DNS only` |
| `CNAME` | `Type = CNAME`，`Name = 你的子域名前缀`（例如 `www`），`Target = Vercel 显示的值`，`Proxy status = DNS only` |
| `TXT` | `Type = TXT`，`Name = Vercel 显示的名字`，`Content = Vercel 显示的值` |

不要自己猜，不要照抄别人的旧教程，**直接照着你自己 Vercel 页面当前显示的值填。**

## 第 6 步：回到 Vercel 等验证成功

回到：

- `Vercel`
- `Settings`
- `Domains`

然后等：

- 域名状态变成可用
- SSL 证书签发完成

如果没有立刻成功，一般是 DNS 传播还没完成，先等一会儿。

## 第 7 步：最后测试

如果你最终使用的是 `www.example.com`，就测试：

- `http://www.example.com`
- `https://www.example.com`

如果你还加了一个跳转域名，例如 `example.com`，再额外测试：

- `http://example.com`
- `https://example.com`

正常结果应该是：

- 正式域名可以正常打开
- 如果设置了跳转，另一个域名会自动跳到正式域名
- 浏览器没有证书错误

## 最常见的 3 个错误

### 1）照抄旧教程里的记录值

不要照抄别人文章里的旧 `CNAME` 或旧 IP，**以你自己的 Vercel 当前页面显示为准。**

### 2）Cloudflare 开了橙云

指向 Vercel 的 `A` 和 `CNAME`，先统一用 `DNS only`。

### 3）DNSSEC 没关

如果你的注册商后台开着 `DNSSEC`，改 nameserver 前先关掉。

## 官方文档

- Vercel 自定义域名：<https://vercel.com/docs/domains/set-up-custom-domain>
- Vercel + Cloudflare：<https://vercel.com/kb/guide/cloudflare-with-vercel>
- Vercel 域名跳转：<https://vercel.com/docs/domains/working-with-domains/deploying-and-redirecting>
- Cloudflare 添加域名：<https://developers.cloudflare.com/fundamentals/manage-domains/add-site/>
- Spaceship 自定义 nameserver：<https://www.spaceship.com/en-GB/knowledgebase/connect-domain-custom-nameservers/>
