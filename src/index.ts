import { z } from "zod";
import type { 
	Tool, 
	TextContent,
	CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";

// DeepClick API 配置
const DEEPCLICK_API_BASE = "https://console-api-test.deepclick.com/api/console";

interface Env {
	// 环境变量可以留空，因为 token 通过邮箱动态获取
}

// SSE 会话管理
interface SSESession {
	id: string;
	encoder: TextEncoder;
	controller: ReadableStreamDefaultController;
	lastActivity: number;
}

// 全局 SSE 会话存储（内存中）
const sseSessions = new Map<string, SSESession>();

// 生成唯一的会话 ID
function generateSessionId(): string {
	return `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

// 清理过期的 SSE 会话（超过 5 分钟无活动）
function cleanupExpiredSessions() {
	const now = Date.now();
	const timeout = 5 * 60 * 1000; // 5 分钟
	for (const [id, session] of sseSessions.entries()) {
		if (now - session.lastActivity > timeout) {
			try {
				session.controller.close();
			} catch (e) {
				// 忽略关闭错误
			}
			sseSessions.delete(id);
		}
	}
}

// Zod Schema: 创建推广链接的请求参数
const CreateLinkSchema = z.object({
	token: z.string().min(1, "Token 不能为空"),
	name: z.string().min(1, "推广链接名称不能为空"),
	domain_id: z.number().int().positive("域名 ID 必须是正整数"),
});

// Zod Schema: 查询推广链接的请求参数
const ListLinksSchema = z.object({
	token: z.string().min(1, "Token 不能为空"),
	page_num: z.number().int().positive("页码必须是正整数").optional().default(1),
	page_size: z.number().int().positive("每页数量必须是正整数").max(100, "每页最多 100 条").optional().default(10),
	link_name: z.string().optional().default(""),
	link_id: z.string().optional().default(""),
	app_name: z.string().optional().default(""),
	app_id: z.string().optional().default(""),
});

// Zod Schema: 获取 Token 的请求参数
const GetTokenSchema = z.object({
	email: z.string().email("邮箱格式不正确"),
});

// Zod Schema: 获取可用域名列表的请求参数
const GetDomainsSchema = z.object({
	token: z.string().min(1, "Token 不能为空"),
});

// 类型推导
type CreateLinkParams = z.infer<typeof CreateLinkSchema>;
type ListLinksParams = z.infer<typeof ListLinksSchema>;
type GetTokenParams = z.infer<typeof GetTokenSchema>;
type GetDomainsParams = z.infer<typeof GetDomainsSchema>;

// MCP 工具定义（符合 MCP 协议规范）
const MCP_TOOLS: Tool[] = [
	{
		name: "create_promotional_link",
		description: "在 DeepClick 平台上创建新的推广链接（其他参数已预设）",
		inputSchema: {
			type: "object",
			properties: {
				token: {
					type: "string",
					description: "DeepClick API Token（通过 get_deepclick_token 获取）",
				},
				name: {
					type: "string",
					description: "推广链接名称",
				},
				domain_id: {
					type: "number",
					description: "域名 ID（从 get_available_domains 获取的域名列表中选择）",
				},
			},
			required: ["token", "name", "domain_id"],
		},
	},
	{
		name: "list_promotional_links",
		description: "查询 DeepClick 平台上的推广链接列表",
		inputSchema: {
			type: "object",
			properties: {
				token: {
					type: "string",
					description: "DeepClick API Token（通过 get_deepclick_token 获取）",
				},
				link_name: {
					type: "string",
					description: "链接名称（用于搜索，可选）",
				}
			},
			required: ["token"],
		},
	},
	{
		name: "get_deepclick_token",
		description: "通过邮箱获取 DeepClick API 的 Bearer Token",
		inputSchema: {
			type: "object",
			properties: {
				email: {
					type: "string",
					description: "用户邮箱地址, 格式为: <用户名拼音>@qiliangjia.com",
				},
			},
			required: ["email"],
		},
	},
	{
		name: "get_available_domains",
		description: "获取 DeepClick 平台上可用的域名列表",
		inputSchema: {
			type: "object",
			properties: {
				token: {
					type: "string",
					description: "DeepClick API Token（通过 get_deepclick_token 获取）",
				},
			},
			required: ["token"],
		},
	},
];

// 创建推广链接（大部分参数固定，只需传入 name 和 domain_id）
async function createPromotionalLink(params: CreateLinkParams, token: string) {
	const requestBody = {
		link: {
			id: null,
			name: params.name,
			icon_url: "https://image.deepclick.com/uploads/129_20251216080422_926.png",
			jump_url: "https://console-test-deepclick.qiliangjia.one/promotional-link/link-detail",
			channel_id: "4",
			attribution_type: 3,
			szy_pixels: [],
			app_id: 1013087208491520,
			app_type: 2,
			app_name: "44444",
			campaign_id: 340179456,
			first_type: 1,
			re_target_type: 2,
			domain_id: params.domain_id,
			is_ad_report: 0,
			remark: "123",
			partner: 1,
			cape_type: 2,
			ad_template_type: 0,
			complaint_setting: {
				logic: "and",
				conditions: [{ field: "", op: "gt", value: null }],
			},
			complaint_set: 0,
			url_start_type: "",
			campaign_name: "0105_page_1",
			back_assets: {
				feed_info: null,
				multi_image_info: null,
				pure_video_info: null,
				custom_page_info: {
					action_btn: "徒步徒步",
					image_urls: [
						"https://image.deepclick.com/uploads/883_20260105095556_333",
						"https://image.deepclick.com/uploads/289_20260105095556_221",
					],
					parameters: {
						button_color: "linear-gradient(270deg, #0c65ff 0%, #6d00fc 46.15%, #ff003c 100%)",
						button_is_floating: true,
					},
				},
			},
			back_template_type: 4,
			back_style_id: 7,
		},
		sub_push: null,
	};

	const response = await fetch(`${DEEPCLICK_API_BASE}/ad/link/create`, {
		method: "POST",
		headers: {
			"accept": "application/json, text/plain, */*",
			"authorization": `Bearer ${token}`,
			"content-type": "application/json",
			"dc-lang": "zh-CN",
		},
		body: JSON.stringify(requestBody),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`DeepClick API 请求失败: ${response.status} ${errorText}`);
	}

	return await response.json();
}

// 查询推广链接列表
async function listPromotionalLinks(params: ListLinksParams, token: string) {
	const requestBody = {
		page_num: params.page_num,
		page_size: params.page_size,
		link_name: params.link_name,
		link_id: params.link_id,
		app_name: params.app_name,
		app_id: params.app_id,
	};

	const response = await fetch(`${DEEPCLICK_API_BASE}/ad/linkAd/list`, {
		method: "POST",
		headers: {
			"accept": "application/json, text/plain, */*",
			"authorization": `Bearer ${token}`,
			"content-type": "application/json",
			"dc-lang": "zh-CN",
		},
		body: JSON.stringify(requestBody),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`DeepClick API 请求失败: ${response.status} ${errorText}`);
	}

	const result = await response.json() as any;

	return result.data.items.map((item: any) => ({
		id: item.id,
		name: item.name,
		promotion_link: item.promotion_link,
	}));
}

// 获取 Token
async function getToken(params: GetTokenParams) {
	const requestBody = {
		captcha_code: "Hmo2FGG", // 固定验证码
		email: params.email,
		register_from: 0,
	};

	const response = await fetch(`${DEEPCLICK_API_BASE}/account/register_by_captcha`, {
		method: "POST",
		headers: {
			"accept": "*/*",
			"content-type": "application/json",
		},
		body: JSON.stringify(requestBody),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`获取 Token 失败: ${response.status} ${errorText}`);
	}

	return await response.json();
}

// 获取可用域名列表
async function getDomains(params: GetDomainsParams, token: string) {
	const requestBody = {
		cape_type: [1, 2], // 固定参数
	};

	const response = await fetch(`${DEEPCLICK_API_BASE}/data_dropdown/domain`, {
		method: "POST",
		headers: {
			"accept": "application/json, text/plain, */*",
			"authorization": `Bearer ${token}`,
			"content-type": "application/json",
			"dc-lang": "zh-CN",
		},
		body: JSON.stringify(requestBody),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`获取域名列表失败: ${response.status} ${errorText}`);
	}

	const result = await response.json() as any;
	
	// 返回简化的域名列表
	return result.data?.items?.map((item: any) => ({
		id: item.id,
		domain: item.custom_domain,
	})) || [];
}

// 发送 SSE 消息
function sendSSEMessage(session: SSESession, data: any) {
	try {
		const message = `data: ${JSON.stringify(data)}\n\n`;
		session.controller.enqueue(session.encoder.encode(message));
		session.lastActivity = Date.now();
	} catch (error) {
		console.error("发送 SSE 消息失败:", error);
	}
}

// 创建 SSE 连接
function createSSEStream(sessionId: string): ReadableStream {
	const encoder = new TextEncoder();
	
	return new ReadableStream({
		start(controller) {
			// 保存会话
			const session: SSESession = {
				id: sessionId,
				encoder,
				controller,
				lastActivity: Date.now(),
			};
			sseSessions.set(sessionId, session);

			// 发送初始 endpoint 事件
			const endpointMessage = `event: endpoint\ndata: /messages\n\n`;
			controller.enqueue(encoder.encode(endpointMessage));

			// 定期发送心跳保持连接
			const heartbeatInterval = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(': heartbeat\n\n'));
					session.lastActivity = Date.now();
				} catch (error) {
					clearInterval(heartbeatInterval);
				}
			}, 15000); // 每 15 秒发送一次心跳

			// 清理过期会话
			cleanupExpiredSessions();
		},
		cancel() {
			sseSessions.delete(sessionId);
		},
	});
}

// 处理 MCP JSON-RPC 请求
async function handleMCPRequest(request: any): Promise<any> {
	const { jsonrpc, id, method, params } = request;

	// 验证 JSON-RPC 版本
	if (jsonrpc !== "2.0") {
		return {
			jsonrpc: "2.0",
			id: id || null,
			error: {
				code: -32600,
				message: "无效的请求：JSON-RPC 版本必须是 2.0",
			},
		};
	}

	try {
		switch (method) {
			case "initialize":
				return {
					jsonrpc: "2.0",
					id,
					result: {
						protocolVersion: "2024-11-05",
						serverInfo: {
							name: "deepclick-mcp-worker",
							version: "1.0.0",
						},
						capabilities: {
							tools: {},
						},
					},
				};

			case "tools/list":
				return {
					jsonrpc: "2.0",
					id,
					result: {
						tools: MCP_TOOLS,
					},
				};

			case "tools/call": {
				const { name, arguments: args } = params;

				switch (name) {
					case "create_promotional_link": {
						// 使用 zod 验证参数
						const parseResult = CreateLinkSchema.safeParse(args);
						if (!parseResult.success) {
							return {
								jsonrpc: "2.0",
								id,
								error: {
									code: -32602,
									message: "参数验证失败",
									data: parseResult.error.format(),
								},
							};
						}

						const result = await createPromotionalLink(parseResult.data, parseResult.data.token);
						
						const toolResult: CallToolResult = {
							content: [
								{
									type: "text",
									text: JSON.stringify(result, null, 2),
								} as TextContent,
							],
						};
						
						return {
							jsonrpc: "2.0",
							id,
							result: toolResult,
						};
					}

					case "list_promotional_links": {
						// 使用 zod 验证参数
						const parseResult = ListLinksSchema.safeParse(args);
						if (!parseResult.success) {
							return {
								jsonrpc: "2.0",
								id,
								error: {
									code: -32602,
									message: "参数验证失败",
									data: parseResult.error.format(),
								},
							};
						}

						const result = await listPromotionalLinks(parseResult.data, parseResult.data.token);
						
						const toolResult: CallToolResult = {
							content: [
								{
									type: "text",
									text: JSON.stringify(result, null, 2),
								} as TextContent,
							],
						};
						
						return {
							jsonrpc: "2.0",
							id,
							result: toolResult,
						};
					}

					case "get_deepclick_token": {
						// 使用 zod 验证参数
						const parseResult = GetTokenSchema.safeParse(args);
						if (!parseResult.success) {
							return {
								jsonrpc: "2.0",
								id,
								error: {
									code: -32602,
									message: "参数验证失败",
									data: parseResult.error.format(),
								},
							};
						}

						const result = await getToken(parseResult.data);
						
						const toolResult: CallToolResult = {
							content: [
								{
									type: "text",
									text: JSON.stringify(result, null, 2),
								} as TextContent,
							],
						};
						
						return {
							jsonrpc: "2.0",
							id,
							result: toolResult,
						};
					}

					case "get_available_domains": {
						// 使用 zod 验证参数
						const parseResult = GetDomainsSchema.safeParse(args);
						if (!parseResult.success) {
							return {
								jsonrpc: "2.0",
								id,
								error: {
									code: -32602,
									message: "参数验证失败",
									data: parseResult.error.format(),
								},
							};
						}

						const result = await getDomains(parseResult.data, parseResult.data.token);
						
						const toolResult: CallToolResult = {
							content: [
								{
									type: "text",
									text: JSON.stringify(result, null, 2),
								} as TextContent,
							],
						};
						
						return {
							jsonrpc: "2.0",
							id,
							result: toolResult,
						};
					}

					default:
						return {
							jsonrpc: "2.0",
							id,
							error: {
								code: -32601,
								message: `未知工具: ${name}`,
							},
						};
				}
			}

			default:
				return {
					jsonrpc: "2.0",
					id,
					error: {
						code: -32601,
						message: `未知方法: ${method}`,
					},
				};
		}
	} catch (error) {
		console.error("MCP 请求处理错误:", error);
		return {
			jsonrpc: "2.0",
			id,
			error: {
				code: -32603,
				message: error instanceof Error ? error.message : "内部错误",
			},
		};
	}
}

// 主 Worker 处理函数
export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		// 处理 CORS 预检请求
		if (request.method === "OPTIONS") {
			return new Response(null, {
				headers: {
					"access-control-allow-origin": "*",
					"access-control-allow-methods": "GET, POST, OPTIONS",
					"access-control-allow-headers": "Content-Type, X-Session-Id",
				},
			});
		}

		// SSE 端点 - 建立 SSE 连接
		if (url.pathname === "/sse" && request.method === "GET") {
			const sessionId = generateSessionId();
			const stream = createSSEStream(sessionId);

			return new Response(stream, {
				headers: {
					"content-type": "text/event-stream",
					"cache-control": "no-cache",
					"connection": "keep-alive",
					"access-control-allow-origin": "*",
					"x-session-id": sessionId,
				},
			});
		}

		// SSE 消息端点 - 接收客户端请求并通过 SSE 返回响应
		if (url.pathname === "/messages" && request.method === "POST") {
			try {
				const sessionId = request.headers.get("x-session-id");
				if (!sessionId) {
					return new Response(
						JSON.stringify({
							error: "缺少 X-Session-Id 头",
						}),
						{
							status: 400,
							headers: {
								"content-type": "application/json;charset=UTF-8",
								"access-control-allow-origin": "*",
							},
						}
					);
				}

				const session = sseSessions.get(sessionId);
				if (!session) {
					return new Response(
						JSON.stringify({
							error: "会话不存在或已过期",
						}),
						{
							status: 404,
							headers: {
								"content-type": "application/json;charset=UTF-8",
								"access-control-allow-origin": "*",
							},
						}
					);
				}

				const requestData = await request.json();
				const response = await handleMCPRequest(requestData);

				// 通过 SSE 发送响应
				sendSSEMessage(session, response);

				// 返回确认
				return new Response(
					JSON.stringify({ status: "sent" }),
					{
						status: 202,
						headers: {
							"content-type": "application/json;charset=UTF-8",
							"access-control-allow-origin": "*",
						},
					}
				);
			} catch (error) {
				console.error("处理 SSE 消息错误:", error);
				return new Response(
					JSON.stringify({
						error: error instanceof Error ? error.message : "未知错误",
					}),
					{
						status: 500,
						headers: {
							"content-type": "application/json;charset=UTF-8",
							"access-control-allow-origin": "*",
						},
					}
				);
			}
		}

		// 首页 - 显示 MCP 服务信息
		if (url.pathname === "/" && request.method === "GET") {
			return new Response(
				`
<!DOCTYPE html>
<html lang="zh-CN">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>DeepClick MCP Server</title>
	<style>
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
			max-width: 900px;
			margin: 40px auto;
			padding: 0 20px;
			line-height: 1.6;
			color: #333;
		}
		h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
		h2 { color: #34495e; margin-top: 30px; border-bottom: 2px solid #ecf0f1; padding-bottom: 8px; }
		.info-box {
			background: #f8f9fa;
			border-left: 4px solid #3498db;
			padding: 15px;
			margin: 15px 0;
			border-radius: 4px;
		}
		.tool {
			background: #e8f4f8;
			border-left: 4px solid #2ecc71;
			padding: 15px;
			margin: 15px 0;
			border-radius: 4px;
		}
		code {
			background: #e8e8e8;
			padding: 2px 6px;
			border-radius: 3px;
			font-family: 'Courier New', monospace;
		}
		pre {
			background: #2c3e50;
			color: #ecf0f1;
			padding: 15px;
			border-radius: 5px;
			overflow-x: auto;
		}
		pre code {
			background: transparent;
			color: inherit;
		}
		.status {
			display: inline-block;
			background: #2ecc71;
			color: white;
			padding: 4px 12px;
			border-radius: 20px;
			font-size: 14px;
			font-weight: bold;
		}
	</style>
</head>
<body>
	<h1>🚀 DeepClick MCP Server</h1>
	<p><span class="status">✓ 运行中</span></p>
	<p>基于 Model Context Protocol (MCP) 的 DeepClick 推广链接管理服务</p>

	<div class="info-box">
		<h3>📡 服务信息</h3>
		<ul>
			<li><strong>服务名称:</strong> deepclick-mcp-worker</li>
			<li><strong>版本:</strong> 1.0.0</li>
			<li><strong>协议版本:</strong> MCP 2024-11-05</li>
			<li><strong>部署平台:</strong> Cloudflare Workers</li>
			<li><strong>传输方式:</strong> HTTP POST + SSE (Server-Sent Events)</li>
		</ul>
	</div>

	<h2>🛠️ 可用工具</h2>

	<div class="tool">
		<h3>1. get_deepclick_token</h3>
		<p><strong>描述:</strong> 通过邮箱获取 DeepClick API 的 Bearer Token</p>
		<p><strong>必需参数:</strong></p>
		<ul>
			<li><code>email</code> - 用户邮箱地址</li>
		</ul>
		<p><strong>返回:</strong> Token（后续工具调用需要使用）</p>
	</div>

	<div class="tool">
		<h3>2. create_promotional_link</h3>
		<p><strong>描述:</strong> 在 DeepClick 平台上创建新的推广链接</p>
		<p>其他参数已预设好，只需提供 token、链接名称和域名 ID！</p>
		<p><strong>必需参数:</strong></p>
		<ul>
			<li><code>token</code> - API Token（通过 get_deepclick_token 获取）</li>
			<li><code>name</code> - 推广链接名称</li>
			<li><code>domain_id</code> - 域名 ID（从 get_available_domains 获取）</li>
		</ul>
	</div>

	<div class="tool">
		<h3>3. list_promotional_links</h3>
		<p><strong>描述:</strong> 查询 DeepClick 平台上的推广链接列表</p>
		<p><strong>必需参数:</strong></p>
		<ul>
			<li><code>token</code> - API Token（通过 get_deepclick_token 获取）</li>
		</ul>
		<p><strong>可选参数:</strong></p>
		<ul>
			<li><code>page_num</code> - 页码（默认 1）</li>
			<li><code>page_size</code> - 每页数量（默认 10）</li>
			<li><code>link_name</code> - 链接名称（用于搜索）</li>
			<li><code>link_id</code> - 链接 ID（用于搜索）</li>
			<li><code>app_name</code> - 应用名称（用于搜索）</li>
			<li><code>app_id</code> - 应用 ID（用于搜索）</li>
		</ul>
	</div>

	<div class="tool">
		<h3>4. get_available_domains</h3>
		<p><strong>描述:</strong> 获取 DeepClick 平台上可用的域名列表</p>
		<p><strong>必需参数:</strong></p>
		<ul>
			<li><code>token</code> - API Token（通过 get_deepclick_token 获取）</li>
		</ul>
	</div>

	<h2>🔌 如何连接</h2>
	
	<div class="info-box">
		<h3>方式一：SSE 传输（推荐）</h3>
		<p>使用 Server-Sent Events，支持实时消息推送：</p>
		<pre><code>{
  "mcpServers": {
    "deepclick": {
      "url": "https://your-worker.workers.dev/sse"
    }
  }
}</code></pre>
		<p><strong>优势：</strong> 实时通信、支持服务器推送、更好的集成体验</p>
	</div>

	<div class="info-box">
		<h3>方式二：HTTP POST 传输</h3>
		<p>使用传统的 HTTP 请求-响应模式：</p>
		<pre><code>{
  "mcpServers": {
    "deepclick": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-http", "https://your-worker.workers.dev/mcp"]
    }
  }
}</code></pre>
		<p><strong>优势：</strong> 简单、兼容性好、易于调试</p>
	</div>

	<p>将 <code>your-worker.workers.dev</code> 替换为你的 Worker 域名。</p>

	<h2>🔧 认证方式</h2>
	<p><strong>工作流程:</strong></p>
	<ol>
		<li>首先调用 <code>get_deepclick_token</code> 工具，传入邮箱获取 Token</li>
		<li>使用获得的 Token 调用其他工具（create、list、get_domains）</li>
		<li>在同一个会话中，Token 可以复用，无需每次都重新获取</li>
	</ol>
	<p>验证码已固定为 <code>Hmo2FGG</code>，无需手动输入。</p>

	<h2>📖 MCP 协议端点</h2>
	<ul>
		<li><code>GET /sse</code> - SSE 连接建立（返回 X-Session-Id）</li>
		<li><code>POST /messages</code> - SSE 消息端点（需要 X-Session-Id 头）</li>
		<li><code>POST /mcp</code> - HTTP POST 模式的 JSON-RPC 请求处理</li>
	</ul>
	
	<h2>🔄 传输方式对比</h2>
	<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
		<thead>
			<tr style="background: #34495e; color: white;">
				<th style="padding: 10px; text-align: left; border: 1px solid #ddd;">特性</th>
				<th style="padding: 10px; text-align: left; border: 1px solid #ddd;">SSE</th>
				<th style="padding: 10px; text-align: left; border: 1px solid #ddd;">HTTP POST</th>
			</tr>
		</thead>
		<tbody>
			<tr>
				<td style="padding: 10px; border: 1px solid #ddd;">实时通信</td>
				<td style="padding: 10px; border: 1px solid #ddd;">✅ 支持</td>
				<td style="padding: 10px; border: 1px solid #ddd;">❌ 不支持</td>
			</tr>
			<tr style="background: #f8f9fa;">
				<td style="padding: 10px; border: 1px solid #ddd;">服务器推送</td>
				<td style="padding: 10px; border: 1px solid #ddd;">✅ 支持</td>
				<td style="padding: 10px; border: 1px solid #ddd;">❌ 不支持</td>
			</tr>
			<tr>
				<td style="padding: 10px; border: 1px solid #ddd;">连接保持</td>
				<td style="padding: 10px; border: 1px solid #ddd;">✅ 长连接</td>
				<td style="padding: 10px; border: 1px solid #ddd;">❌ 短连接</td>
			</tr>
			<tr style="background: #f8f9fa;">
				<td style="padding: 10px; border: 1px solid #ddd;">调试难度</td>
				<td style="padding: 10px; border: 1px solid #ddd;">⚠️ 较难</td>
				<td style="padding: 10px; border: 1px solid #ddd;">✅ 简单</td>
			</tr>
			<tr>
				<td style="padding: 10px; border: 1px solid #ddd;">推荐场景</td>
				<td style="padding: 10px; border: 1px solid #ddd;">生产环境</td>
				<td style="padding: 10px; border: 1px solid #ddd;">开发调试</td>
			</tr>
		</tbody>
	</table>
</body>
</html>
				`,
				{
					headers: {
						"content-type": "text/html;charset=UTF-8",
					},
				}
			);
		}

		// MCP 端点 - 处理 JSON-RPC 请求
		if (url.pathname === "/mcp" && request.method === "POST") {
			try {
				const requestData = await request.json();
				const response = await handleMCPRequest(requestData);

				return new Response(JSON.stringify(response), {
					status: 200,
					headers: {
						"content-type": "application/json;charset=UTF-8",
						"access-control-allow-origin": "*",
					},
				});
			} catch (error) {
				console.error("请求处理错误:", error);
				return new Response(
					JSON.stringify({
						jsonrpc: "2.0",
						error: {
							code: -32700,
							message: "解析错误",
						},
					}),
					{
						status: 400,
						headers: {
							"content-type": "application/json;charset=UTF-8",
							"access-control-allow-origin": "*",
						},
					}
				);
			}
		}

		// 404
		return new Response(
			JSON.stringify({
				error: "未找到该端点",
			}),
			{
				status: 404,
				headers: {
					"content-type": "application/json;charset=UTF-8",
				},
			}
		);
	},
} satisfies ExportedHandler<Env>;
