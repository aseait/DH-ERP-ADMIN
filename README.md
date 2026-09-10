# velzon-typescript

velzon-typescript

## 环境要求

- Node.js（建议 18+，Docker 镜像使用的是 Node 20）
- npm

## 安装依赖

项目中的 `react-dual-listbox` 声明的 peer dependency 尚未适配 React 19，直接 `npm install` 会因为 peer dependency 冲突报错（`ERESOLVE`），需要加 `--legacy-peer-deps`：

```bash
npm install --legacy-peer-deps
```

> Windows + PowerShell 提示"无法加载文件 npm.ps1，因为在此系统上禁止运行脚本"：
> 这是 PowerShell 执行策略限制，和 npm 无关。执行一次即可永久解决（只影响当前用户，无需管理员权限）：
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
> ```
> 设置后需要重新打开一个新的终端窗口才会生效。

## 环境变量配置

根目录下的 `.env` 用于本地开发，主要变量：

- `REACT_APP_DH_API`：后端接口地址
- `REACT_APP_DEFAULTAUTH`：默认鉴权方式
- `GENERATE_SOURCEMAP`：是否生成 sourcemap

另外 `public/` 目录下有运行时配置文件（浏览器直接加载，非构建时注入）：

- `public/config.template.js`：配置模板
- `public/config.dev.js`：开发环境配置
- `public/config.js`：实际生效的配置文件（`build:dev` 会自动用 `config.dev.js` 覆盖它）

## 本地运行（开发模式）

```bash
npm start
```

默认启动开发服务器，访问 `http://localhost:3000`，保存代码后自动热更新。

## 构建

```bash
# 标准生产构建
npm run build

# 开发环境构建（构建后会用 public/config.dev.js 覆盖 build/config.js）
npm run build:dev

# 生产环境构建
npm run build:prod
```

构建产物输出到 `build/` 目录。构建完成后可用任意静态服务器预览，例如：

```bash
npx serve -s build
```

## 使用 Docker 构建 / 运行

项目提供了多阶段 `Dockerfile`（构建阶段用 Node 20 编译，运行阶段用 nginx 提供静态资源），会自动使用 `--legacy-peer-deps` 安装依赖：

```bash
# 构建镜像（可选：通过 --build-arg 在构建期注入接口地址）
docker build -t dh-erp-admin --build-arg REACT_APP_DH_API=https://api.example.com .

# 运行容器，映射到本机 8080 端口
docker run -p 8080:80 dh-erp-admin
```

访问 `http://localhost:8080` 即可。

## 其他常用命令

```bash
npm run lint         # 代码检查
npm run lint:fix      # 自动修复可修复的 lint 问题
npm run format        # 格式化代码
npm run format:check  # 检查格式是否符合规范
npm test              # 运行测试
```
