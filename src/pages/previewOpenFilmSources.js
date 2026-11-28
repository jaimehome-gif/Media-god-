// Preview-only public, openly licensed film lookup. No account or provider credentials.
export const OPEN_FILMS = Object.freeze([
  { title:"Big Buck Bunny", file:"File:Big Buck Bunny 4K.webm", year:2008 },
  { title:"Sintel", file:"File:Sintel movie 4K.webm", year:2010 },
  { title:"Tears of Steel", file:"File:Tears of Steel in 4k - Official Blender Foundation release.webm", year:2012 },
]);

export function commonsChoices(data, film) {
  if (!OPEN_FILMS.some(entry => entry.file === film?.file)) return [];
  const pages = data?.query?.pages;
  const page = (Array.isArray(pages) ? pages : Object.values(pages || {})).find(p => p.title === film.file);
  const entries = page?.videoinfo?.[0]?.derivatives || [];
  const seen = new Set();
  return entries.flatMap(entry => {
    let url;
    try { url = new URL(entry.src); } catch { return []; }
    if (url.protocol !== "https:" || url.hostname !== "upload.wikimedia.org" || url.username || url.password ||
        !url.pathname.startsWith("/wikipedia/commons/transcoded/")) return [];
    const match = url.pathname.match(/\.(360|480|720|1080)p\.(vp9|vp8)\.webm$/i);
    if (!match || seen.has(url.href)) return [];
    seen.add(url.href);
    const height = Number(match[1]), codec = match[2].toLowerCase();
    return [{id:"commons-"+height+"-"+codec,type:"file",url:url.href,src:url.href,addon:"Wikimedia Commons",
      label:film.title+" · "+height+"p "+codec.toUpperCase()+" · audio to verify",height,videoCodec:codec,preferNativeVlc:true}];
  }).sort((a,b)=>b.height-a.height).slice(0,6);
}

export async function searchOpenFilm(film, signal) {
  if (!OPEN_FILMS.some(entry=>entry.file===film?.file)) throw Error("Select a listed openly licensed film.");
  const url=new URL("https://commons.wikimedia.org/w/api.php");
  url.search=new URLSearchParams({action:"query",titles:film.file,prop:"videoinfo",viprop:"derivatives",format:"json",formatversion:"2",origin:"*"});
  const response=await fetch(url,{signal,credentials:"omit",referrerPolicy:"no-referrer"});
  if (!response.ok) throw Error("Wikimedia returned HTTP "+response.status);
  const data=await response.json();
  if (data.error) throw Error("The media catalogue could not return sources.");
  return commonsChoices(data,film);
}
