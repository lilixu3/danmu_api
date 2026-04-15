# 绑定自己的域名（以 Spaceship + Cloudflare + Vercel 为例）

这篇只讲一件事：**把已经部署好的本项目，绑定到你自己的域名上。**

说明：
- **Spaceship 只是域名提供商示例**，你的域名在哪里买都可以。
- **Vercel 只是云平台示例**，这篇教程按 Vercel 的界面讲。
- DNS 托管用 **Cloudflare** 举例。

## 开始前准备

你需要先有：

- 一个已经部署成功的 Vercel 项目
- 一个你自己的域名
- Cloudflare 账号
- 域名注册商后台（本文用 Spaceship 举例）

---

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

![Vercel 添加域名](https://www.lilixu3.qzz.io/i/danmu-api/custom-domain/vercel-add-domain.jpeg)

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

---

## 第 2 步：看 Vercel 让你填什么记录

这一步最重要：**后面在 Cloudflare 里填什么，完全以 Vercel 当前页面显示为准。**

一般最常见的是下面两种：

### 情况 1：Vercel 只给你一条 `A` 记录

这通常是你添加的是**根域名**，例如：

- `example.com`

这种情况后面去 Cloudflare，通常只需要加 **1 条 `A` 记录**。

![Vercel 官方 DNS 提示](https://www.lilixu3.qzz.io/i/danmu-api/custom-domain/vercel-official-dns-form.png)

### 情况 2：Vercel 给你 `CNAME + TXT`

这通常是你添加的是**子域名**，例如：

- `www.example.com`

或者 Vercel 要你先做一次域名验证。

这种情况后面去 Cloudflare，通常要加 **2 条记录**：

1. 先加 `TXT`
2. 再加 `CNAME`

注意：

- `TXT` 的 `Name` 和 `Content`，**按 Vercel 页面原样填写**
- 不要自己把 `TXT` 的名字改成 `www`
- `CNAME` 才是你真正要接到 Vercel 的域名，例如 `www`

![Vercel 官方 TXT 提示](https://www.lilixu3.qzz.io/i/danmu-api/custom-domain/vercel-official-txt-records.png)

---

## 第 3 步：把域名添加到 Cloudflare

登录 Cloudflare 后：

1. 点 `Add a domain`
2. 输入你的域名，例如 `example.com`
3. 选 Free 套餐
4. 继续下一步

![Cloudflare 添加域名](https://www.lilixu3.qzz.io/i/danmu-api/custom-domain/cloudflare-add-domain.jpeg)

Cloudflare 会给你两条 nameserver，先不要关页面，下一步要拿去注册商后台填。

![Cloudflare nameserver](https://www.lilixu3.qzz.io/i/danmu-api/custom-domain/cloudflare-nameservers.jpeg)

---

## 第 4 步：去域名注册商后台改 nameserver

### 如果你的域名在 Spaceship

进入域名后台后找到：

- `Advanced DNS`
- `Nameservers`
- `Change`
- `Custom nameservers`

然后把 Cloudflare 给你的两条 nameserver 填进去并保存。

![Spaceship 修改 nameserver 入口](https://www.lilixu3.qzz.io/i/danmu-api/custom-domain/spaceship-change-nameservers.png)

![Spaceship 确认 custom nameserver](https://www.lilixu3.qzz.io/i/danmu-api/custom-domain/spaceship-confirm-custom-dns.png)

### 如果你的域名不在 Spaceship

也一样：

- 去你的域名注册商后台
- 找到 `Nameservers`
- 改成 Cloudflare 给你的两条 nameserver

注意：

- 如果注册商后台开着 `DNSSEC`，先关掉，再改 nameserver

---

## 第 5 步：回到 Cloudflare 填 DNS

进入：

- `Cloudflare`
- 你的域名
- `DNS`
- `Add record`

### 这里有一条必须记住

**指向 Vercel 的 `A` 和 `CNAME`，`Proxy status` 一律选 `DNS only`，不要开橙云。**

### 情况 1：Vercel 只给你一条 `A` 记录时，Cloudflare 这样填

进入 `DNS -> Add record` 后，按下面填：

1. `Type` 选 `A`
2. `Name` 填 `@`
3. `IPv4 address` 填 **Vercel 当前页面显示的值**
4. `Proxy status` 选 `DNS only`
5. `TTL` 保持默认或 `Auto`
6. 点保存

你可以直接理解成：

- 你的域名是 `example.com`
- 那 `Name` 就填 `@`

![Cloudflare DNS 填写示意](https://www.lilixu3.qzz.io/i/danmu-api/custom-domain/cloudflare-dns-records.jpeg)

### 情况 2：Vercel 给你 `CNAME + TXT` 时，Cloudflare 这样填

这时不要只加 `CNAME`，而是按下面顺序做。

#### 先加 `TXT`

1. 点一次 `Add record`
2. `Type` 选 `TXT`
3. `Name` 填 **Vercel 页面显示的名字**
4. `Content` 填 **Vercel 页面显示的值**
5. `TTL` 保持默认或 `Auto`
6. 点保存

这里最容易填错的是：

- `TXT` 的 `Name` 不一定是 `www`
- 你不要自己改，**Vercel 显示什么就填什么**

#### 再加 `CNAME`

1. 再点一次 `Add record`
2. `Type` 选 `CNAME`
3. `Name` 填你要用的子域名前缀，例如 `www`
4. `Target` 填 **Vercel 页面显示的 CNAME 值**
5. `Proxy status` 选 `DNS only`
6. `TTL` 保持默认或 `Auto`
7. 点保存

例如：

- 你要接的是 `www.example.com`
- 那 `CNAME` 这一条的 `Name` 就填 `www`

如果 Cloudflare 里已经有同名旧记录，例如已经有一个旧的 `www`：

- 先删掉旧的同名记录
- 再按 Vercel 当前页面给的值重新添加

![Cloudflare DNS 填写示意](https://www.lilixu3.qzz.io/i/danmu-api/custom-domain/cloudflare-dns-records.jpeg)

一句话记住：

- **只有 `A`** → 去 Cloudflare 加 **1 条 `A`**
- **`CNAME + TXT`** → 去 Cloudflare 加 **2 条：先 `TXT`，再 `CNAME`**

---

## 第 6 步：回到 Vercel 等验证成功

回到：

- `Vercel`
- `Settings`
- `Domains`

然后等：

- 域名状态变成可用
- SSL 证书签发完成

如果没有立刻成功，一般是 DNS 传播还没完成，先等一会儿。

![Vercel 域名验证成功](https://www.lilixu3.qzz.io/i/danmu-api/custom-domain/vercel-ssl-issued.jpeg)

---

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

---

## 最常见的 3 个错误

### 1）照抄旧教程里的记录值

不要照抄别人文章里的旧 `CNAME` 或旧 IP，**以你自己的 Vercel 当前页面显示为准。**

### 2）Cloudflare 开了橙云

指向 Vercel 的 `A` 和 `CNAME`，先统一用 `DNS only`。

### 3）DNSSEC 没关

如果你的注册商后台开着 `DNSSEC`，改 nameserver 前先关掉。

---

## 官方文档

- Vercel 自定义域名：<https://vercel.com/docs/domains/set-up-custom-domain>
- Vercel + Cloudflare：<https://vercel.com/kb/guide/cloudflare-with-vercel>
- Vercel 域名跳转：<https://vercel.com/docs/domains/working-with-domains/deploying-and-redirecting>
- Cloudflare 添加域名：<https://developers.cloudflare.com/fundamentals/manage-domains/add-site/>
- Spaceship 自定义 nameserver：<https://www.spaceship.com/en-GB/knowledgebase/connect-domain-custom-nameservers/>
