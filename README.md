# DeepClick MCP Worker

一个部署在 Cloudflare Workers 上的 Model Context Protocol (MCP) 服务器，用于管理 DeepClick 推广链接。

## 功能特性

- ✅ 创建 DeepClick 推广链接（仅需邮箱和链接名称）
- ✅ 查询推广链接列表
- ✅ 获取可用域名列表
- ✅ 自动获取 API Token
- ✅ 基于 MCP 协议，可与 Claude Desktop 等 AI 应用集成
- ✅ 部署在 Cloudflare Workers，全球低延迟访问
- ✅ 支持 HTTP 传输的 MCP 服务

## MCP 工具

### 🔑 使用流程

1. **首先获取 Token**: 调用 `get_deepclick_token` 获取 API Token
2. **获取可用域名**: 调用 `get_available_domains` 获取域名列表
3. **创建推广链接**: 使用 Token 和选择的域名 ID 创建链接
4. **Token 可复用**: 在同一会话中，Token 可以多次使用，无需重复获取

### 1. get_deepclick_token

通过邮箱获取 DeepClick API 的 Bearer Token。

**必需参数:**
- `email` (string) - 用户邮箱地址

**返回:**
- Token 字符串（用于后续工具调用）

### 2. create_promotional_link

在 DeepClick 平台上创建新的推广链接。

其他参数已预设好，只需提供 token、链接名称和域名 ID！

**必需参数:**
- `token` (string) - API Token（通过 get_deepclick_token 获取）
- `name` (string) - 推广链接名称
- `domain_id` (number) - 域名 ID（从 get_available_domains 获取）

**预设参数（无需配置）:**
- 应用、渠道、活动等信息已固定
- 跳转 URL、图标等已预设
- 页面模板和样式已配置好

### 3. list_promotional_links

查询 DeepClick 平台上的推广链接列表。

**必需参数:**
- `token` (string) - API Token（通过 get_deepclick_token 获取）

**可选参数:**
- `page_num` (number) - 页码（默认 1）
- `page_size` (number) - 每页数量（默认 10）
- `link_name` (string) - 链接名称（用于搜索）
- `link_id` (string) - 链接 ID（用于搜索）
- `app_name` (string) - 应用名称（用于搜索）
- `app_id` (string) - 应用 ID（用于搜索）

### 4. get_available_domains

获取 DeepClick 平台上可用的域名列表。

**必需参数:**
- `token` (string) - API Token（通过 get_deepclick_token 获取）

## 部署步骤

### 1. 安装依赖

```bash
pnpm install
```

### 2. 本地开发

```bash
pnpm dev
```

服务将运行在 `http://localhost:8787`

### 3. 测试

```bash
./test-mcp.sh http://localhost:8787
```

### 4. 部署到 Cloudflare

```bash
pnpm deploy
```

> **注意：** 无需配置环境变量！验证码已固定为 `Hmo2FGG`。

## 使用示例

### 在 AI 对话中的典型流程：

```
用户: 帮我在 DeepClick 创建一个推广链接
AI: 1. 首先获取 Token
    调用 get_deepclick_token(email: "your@email.com")
    → 返回 Token: "eyJhbGc..."
    
    2. 获取可用域名列表
    调用 get_available_domains(token: "eyJhbGc...")
    → 返回域名列表: [
      { id: 5000051, domain: "example1.com" },
      { id: 5000052, domain: "example2.com" }
    ]
    
    3. 使用 Token 和域名 ID 创建推广链接
    调用 create_promotional_link(
      token: "eyJhbGc...",
      name: "我的推广链接",
      domain_id: 5000051
    )
    → 成功创建！
    
    4. 查看所有链接
    调用 list_promotional_links(token: "eyJhbGc...")
    → 返回链接列表
```

**优势**: Token 在同一会话中可以复用，避免重复获取，提高效率！

## 使用方式

### 在 Claude Desktop 中使用

在 Claude Desktop 的配置文件中添加：

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "deepclick": {
      "url": "https://your-worker.workers.dev/mcp"
    }
  }
}
```

将 `your-worker.workers.dev` 替换为你的 Worker 域名。

### 直接 HTTP 调用

你也可以直接通过 HTTP POST 调用 MCP 端点：

```bash
# 初始化
curl -X POST https://your-worker.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize"
  }'

# 列出工具
curl -X POST https://your-worker.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list"
  }'

# 调用工具 - 查询链接
curl -X POST https://your-worker.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "list_promotional_links",
      "arguments": {
        "page_num": 1,
        "page_size": 10
      }
    }
  }'
```

## 开发指南

### 项目结构

```
.
├── src/
│   └── index.ts          # Worker 主文件，实现 MCP 服务
├── wrangler.json         # Cloudflare Workers 配置
├── tsconfig.json         # TypeScript 配置
├── package.json          # 项目依赖
└── README.md            # 项目文档
```

### 添加新工具

在 `src/index.ts` 中：

1. 在 `MCP_TOOLS` 数组中定义新工具的 schema
2. 在 `handleMCPRequest` 的 `tools/call` 分支中添加处理逻辑
3. 实现具体的 API 调用函数

## 技术栈

- [Cloudflare Workers](https://workers.cloudflare.com/) - 无服务器边缘计算平台
- [Model Context Protocol](https://modelcontextprotocol.io/) - AI 应用集成协议
- TypeScript - 类型安全的 JavaScript
- DeepClick API - 推广链接管理 API

## License

MIT
