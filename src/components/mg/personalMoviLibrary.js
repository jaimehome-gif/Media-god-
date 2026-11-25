// Only registered personal library endpoints; no arbitrary media URL or provider handoff.
export function personalEndpoint(server, path) {
  if (!["plex","jellyfin","emby"].includes(server?.type)) throw Error("Unsupported personal library");
  const base = new URL(server.baseUrl);
  if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) throw Error("Personal server needs a secure HTTPS address");
  if (!path.startsWith("/") || path.startsWith("//") || /[?#\\]/.test(path)) throw Error("Invalid personal endpoint");
  return new URL(base.origin + base.pathname.replace(/\/+$/, "") + path);
}
export function personalHeaders(server) {
  return server.apiKey ? {[server.type === "plex" ? "X-Plex-Token" : "X-Emby-Token"]:server.apiKey} : {};
}
export async function personalFetch(server, url, options = {}) {
  if (new URL(url).origin !== new URL(server.baseUrl).origin) throw Error("Unexpected server origin");
  return fetch(url, {...options, headers:{...personalHeaders(server), ...options.headers}, credentials:"omit", redirect:"error", referrerPolicy:"no-referrer", cache:"no-store"});
}
async function json(server, url, signal) {
  const response = await personalFetch(server,url,{headers:{Accept:"application/json"},signal});
  if (!response.ok) throw Error("Personal library request failed ("+response.status+")");
  return response.json();
}
export async function searchPersonalLibrary(server, query, signal) {
  const plex = server.type === "plex";
  const url = personalEndpoint(server,plex ? "/hubs/search" : server.userId ? "/Users/"+encodeURIComponent(server.userId)+"/Items" : "/Items");
  url.searchParams.set(plex ? "query" : "SearchTerm",query);
  url.searchParams.set(plex ? "limit" : "Limit","30");
  if (!plex) { url.searchParams.set("Recursive","true"); url.searchParams.set("IncludeItemTypes","Movie,Episode"); }
  const data = await json(server,url,signal);
  const rows = plex ? (data.MediaContainer?.Hub || []).flatMap(h=>h.Metadata || []) : data.Items || [];
  return rows.filter(row=>plex ? ["movie","episode"].includes(row.type) : ["Movie","Episode"].includes(row.Type)).map(row=>({
    id:String(plex ? row.ratingKey : row.Id), title:String(plex ? row.title : row.Name), serverId:server.id
  })).filter(row=>/^[A-Za-z0-9_-]{1,128}$/.test(row.id)).slice(0,30);
}
export async function personalFileEndpoint(server, item, signal) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(item.id) || item.serverId !== server.id) throw Error("Invalid personal item");
  if (server.type === "plex") {
    const info = await json(server,personalEndpoint(server,"/library/metadata/"+encodeURIComponent(item.id)),signal);
    const part = info.MediaContainer?.Metadata?.[0]?.Media?.[0]?.Part?.[0]?.key;
    if (!/^\/library\/parts\/[A-Za-z0-9_/-]+(?:\.[A-Za-z0-9]+)?$/.test(part || "") || part.split("/").includes("..")) throw Error("No direct personal file");
    return personalEndpoint(server,part);
  }
  const url = personalEndpoint(server,"/Videos/"+encodeURIComponent(item.id)+"/stream");
  url.searchParams.set("Static","true"); return url;
}
export async function readPersonalRange(server,url,offset,length,signal) {
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(length) || length < 1 || length > 8*1024*1024 || !Number.isSafeInteger(offset+length)) throw Error("Invalid byte range");
  const response = await personalFetch(server,url,{headers:{Range:"bytes="+offset+"-"+(offset+length-1)},signal});
  const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get("Content-Range") || "");
  if (response.status !== 206 || !match || Number(match[1]) !== offset || Number(match[2]) >= offset+length || !Number.isSafeInteger(Number(match[3])) || Number(match[2]) >= Number(match[3]) || Number(match[2]) < offset) {
    await response.body?.cancel(); throw Error("Server must support and expose HTTP byte ranges (CORS)");
  }
  const expected=Number(match[2])-offset+1;
  const data=await response.arrayBuffer();
  if (data.byteLength !== expected) throw Error("Invalid media range response");
  return {data,size:Number(match[3])};
}
