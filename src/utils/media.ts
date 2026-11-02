/**
 * 图片地址归一化
 * ------------------------------------------------------------------
 * 解决的问题：生产环境（Vercel）是 **HTTPS**，而项目里的图片地址是 **HTTP** 的：
 *   1. 七牛图库 `http://tns15ev3b.hn-bkt.clouddn.com/...`
 *      —— 该域名的 HTTPS 不可用（证书不匹配，会 421），无法直接升级协议；
 *   2. 后端直出的上传图 `http://203.195.180.247:8080/api/v1/uploads/...`
 *      —— 后端没有 HTTPS，直连同样会被拦。
 *
 * 浏览器会把 HTTPS 页面里的 http:// 资源判定为「混合内容（Mixed Content）」并拦截，
 * 表现为图片全部裂开。因此统一改写成**同源相对路径**，交给平台侧代理转发：
 *   · `/qiniu/**`  -> vercel.json / vite.config.ts 代理到七牛
 *   · `/api/v1/**` -> vercel.json / vite.config.ts 代理到后端
 * 这样浏览器看到的是同源 HTTPS 请求，不会触发混合内容，也不需要后端配 CORS。
 */

/** 七牛图库域名（HTTP 专用，HTTPS 不可用） */
const QINIU_ORIGIN = 'http://tns15ev3b.hn-bkt.clouddn.com'

/** 线上后端 origin（非 HTTPS） */
const BACKEND_ORIGIN = 'http://203.195.180.247:8080'

/**
 * 把后端/七牛返回的图片地址转成当前站点可直接加载的地址。
 * @param url 原始地址，可为 http 绝对地址、相对路径、https 地址或空值
 */
export function mediaUrl(url?: string | null): string {
  if (!url) return ''
  const u = String(url).trim()
  if (!u) return ''

  // 七牛图 -> 同源代理 /qiniu/**
  if (u.startsWith(QINIU_ORIGIN)) {
    return '/qiniu' + u.slice(QINIU_ORIGIN.length)
  }

  // 后端直出绝对地址 -> 去掉 origin，保留 /api/v1/**
  if (u.startsWith(BACKEND_ORIGIN)) {
    return u.slice(BACKEND_ORIGIN.length) || '/'
  }

  // 相对路径 / https 地址 / data: 等，原样返回
  return u
}
