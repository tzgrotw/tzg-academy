/** Cloudflare Stream 的影片 UID 是 32 碼十六進位。管理員可能貼：
 *  - 純 UID：5d5bc37ffcf54c9b82e996823bffbb81
 *  - 觀看/內嵌網址：https://customer-xxxx.cloudflarestream.com/{uid}/watch
 *  - 後台網址：https://dash.cloudflare.com/.../stream/videos/{uid}
 *  全部從字串裡撈出那 32 碼就好。 */
export function extractCfStreamId(input: string): string | null {
  // 取「最後一個」32 碼——dash.cloudflare.com 網址裡帳號 ID 也是 32 碼十六進位，
  // 但影片 UID 一定排在它後面（/stream/videos/{uid}）。
  const all = input.trim().match(/\b[a-f0-9]{32}\b/gi)
  return all && all.length > 0 ? all[all.length - 1].toLowerCase() : null
}
