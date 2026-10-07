import {
  Tv,
  Film,
  Music,
  Newspaper,
  Trophy,
  ShoppingBag,
  Baby,
  Clapperboard,
  Globe,
  type LucideIcon,
} from 'lucide-react'

export type Channel = {
  id: number
  name: string
  logo: string
  url: string
  currentProgram: string
  time: string
  viewers: string
  country: string
}

export type ChannelCategory = {
  name: string
  icon: LucideIcon
  channels: Channel[]
}

// ---------------------------------------------------------------------------
// Channel data — sourced from the Free-TV/IPTV public playlist
// (https://github.com/Free-TV/IPTV).  To add or update a channel, edit the
// relevant array below.  The UK list mirrors playlists/playlist_uk.m3u8;
// international channels mirror the "News", "Music (EN)" and
// "Documentaries (EN)" groups in the root playlist.m3u8.
//
// HTTPS endpoints are preferred; a small number of channels only publish HTTP
// endpoints and are included because the user explicitly requested them — the
// player will show a graceful error if the browser blocks mixed content.
// ---------------------------------------------------------------------------

const ukChannels: Channel[] = [
  { id: 1, name: 'BBC One', logo: '🇬🇧', url: 'https://vs-hls-pushb-uk-live.akamaized.net/x=4/i=urn:bbc:pips:service:bbc_one_yorks/iptv_hd_abr_v1.m3u8', currentProgram: 'BBC One Live', time: '24/7', viewers: '4.2M', country: 'UK' },
  { id: 2, name: 'BBC Two', logo: '🇬🇧', url: 'https://vs-hls-push-uk-live.akamaized.net/x=4/i=urn:bbc:pips:service:bbc_two_hd/iptv_hd_abr_v1.m3u8', currentProgram: 'BBC Two Live', time: '24/7', viewers: '3.1M', country: 'UK' },
  { id: 3, name: 'ITV 1', logo: '🇬🇧', url: 'http://45.14.84.37/itv1/index.m3u8', currentProgram: 'ITV 1 Live', time: '24/7', viewers: '2.8M', country: 'UK' },
  { id: 4, name: 'STV', logo: '🏴', url: 'https://csm-e-stv-eb.tls1.yospace.com/csm/live/139900483.m3u8', currentProgram: 'STV Live', time: '24/7', viewers: '850K', country: 'UK' },
  { id: 5, name: 'S4C', logo: '🏴', url: 'https://live-uk.s4c-cdn.co.uk/out/v1/a0134f1fd5a2461b9422b574566d4442/live_uk.m3u8', currentProgram: 'S4C Live', time: '24/7', viewers: '320K', country: 'UK' },
  { id: 6, name: 'Channel 5', logo: '🇬🇧', url: 'http://193.46.58.239:8080/Channel5/index.m3u8', currentProgram: 'Channel 5 Live', time: '24/7', viewers: '1.5M', country: 'UK' },
  { id: 7, name: 'ITV 2', logo: '🇬🇧', url: 'http://45.14.84.37/itv2/index.m3u8', currentProgram: 'ITV 2 Live', time: '24/7', viewers: '1.2M', country: 'UK' },
  { id: 8, name: 'BBC Alba', logo: '🇬🇧', url: 'https://vs-hls-pushb-uk-live.akamaized.net/x=4/i=urn:bbc:pips:service:bbc_alba/iptv_hd_abr_v1.m3u8', currentProgram: 'BBC Alba Live', time: '24/7', viewers: '120K', country: 'UK' },
  { id: 9, name: 'BBC Four', logo: '🇬🇧', url: 'https://vs-hls-pushb-uk-live.akamaized.net/x=4/i=urn:bbc:pips:service:bbc_four_hd/iptv_hd_abr_v1.m3u8', currentProgram: 'BBC Four Live', time: '24/7', viewers: '450K', country: 'UK' },
  { id: 10, name: 'BBC Scotland', logo: '🏴', url: 'https://vs-hls-pushb-uk-live.akamaized.net/x=4/i=urn:bbc:pips:service:bbc_scotland_hd/pc_hd_abr_v2.m3u8', currentProgram: 'BBC Scotland Live', time: '24/7', viewers: '680K', country: 'UK' },
  { id: 11, name: 'ITV 3', logo: '🇬🇧', url: 'http://45.14.84.37/itv3/index.m3u8', currentProgram: 'ITV 3 Live', time: '24/7', viewers: '980K', country: 'UK' },
  { id: 12, name: 'BBC Three', logo: '🇬🇧', url: 'https://vs-hls-pushb-uk-live.akamaized.net/x=4/i=urn:bbc:pips:service:bbc_three_hd/iptv_hd_abr_v1.m3u8', currentProgram: 'BBC Three Live', time: '24/7', viewers: '1.1M', country: 'UK' },
  { id: 13, name: 'ITV 4', logo: '🇬🇧', url: 'http://45.14.84.37/itv4/index.m3u8', currentProgram: 'ITV 4 Live', time: '24/7', viewers: '760K', country: 'UK' },
]

const newsChannels: Channel[] = [
  { id: 20, name: 'BBC News', logo: '📰', url: 'https://vs-hls-push-ww-live.akamaized.net/x=4/i=urn:bbc:pips:service:bbc_news_channel_hd/t=3840/v=pv14/b=5070016/main.m3u8', currentProgram: 'BBC News Live', time: '24/7', viewers: '5.2M', country: 'UK' },
  { id: 21, name: 'BBC Parliament', logo: '🏛️', url: 'https://vs-hls-pushb-uk-live.akamaized.net/x=4/i=urn:bbc:pips:service:bbc_parliament/pc_hd_abr_v2.m3u8', currentProgram: 'Parliament Live', time: '24/7', viewers: '90K', country: 'UK' },
  { id: 22, name: 'Sky News', logo: '📰', url: 'https://linear021-gb-hls1-prd-ak.cdn.skycdp.com/Content/HLS_001_hd/Live/channel(skynews)/index_mob.m3u8', currentProgram: 'Sky News Live', time: '24/7', viewers: '3.4M', country: 'UK' },
  { id: 23, name: 'GB News', logo: '📰', url: 'https://live-gbnews.simplestreamcdn.com/live5/gbnews/bitrate1.isml/manifest.m3u8', currentProgram: 'GB News Live', time: '24/7', viewers: '1.2M', country: 'UK' },
  { id: 24, name: 'TalkTV', logo: '📰', url: 'https://488f4ce4.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/TEctZ2JfVGFsa19ITFM/playlist.m3u8', currentProgram: 'TalkTV Live', time: '24/7', viewers: '580K', country: 'UK' },
  { id: 25, name: 'France 24 English', logo: '🇫🇷', url: 'https://live.france24.com/hls/live/2037218-b/F24_EN_HI_HLS/master_5000.m3u8', currentProgram: 'France 24 English Live', time: '24/7', viewers: '2.1M', country: 'FR' },
  { id: 26, name: 'DW English', logo: '🇩🇪', url: 'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8', currentProgram: 'DW News Live', time: '24/7', viewers: '1.8M', country: 'DE' },
  { id: 27, name: 'Al Jazeera English', logo: '🇶🇦', url: 'https://live-hls-apps-aje-fa.getaj.net/AJE/index.m3u8', currentProgram: 'Al Jazeera Live', time: '24/7', viewers: '4.5M', country: 'QA' },
  { id: 28, name: 'CGTN', logo: '🇨🇳', url: 'https://news.cgtn.com/resource/live/english/cgtn-news.m3u8', currentProgram: 'CGTN Live', time: '24/7', viewers: '1.6M', country: 'CN' },
  { id: 29, name: 'NHK World Japan', logo: '🇯🇵', url: 'https://master.nhkworld.jp/nhkworld-tv/playlist/live.m3u8', currentProgram: 'NHK World Live', time: '24/7', viewers: '2.3M', country: 'JP' },
  { id: 30, name: 'TRT World', logo: '🇹🇷', url: 'https://tv-trtworld.medya.trt.com.tr/master.m3u8', currentProgram: 'TRT World Live', time: '24/7', viewers: '1.4M', country: 'TR' },
  { id: 31, name: 'Bloomberg TV', logo: '💼', url: 'https://bloomberg.com/media-manifest/streams/eu.m3u8', currentProgram: 'Bloomberg Live', time: '24/7', viewers: '1.9M', country: 'US' },
  { id: 32, name: 'Euronews English', logo: '🇪🇺', url: 'https://dash4.antik.sk/live/test_euronews/playlist.m3u8', currentProgram: 'Euronews Live', time: '24/7', viewers: '2.7M', country: 'FR' },
  { id: 33, name: 'Arirang World', logo: '🇰🇷', url: 'http://amdlive.ctnd.com.edgesuite.net/arirang_1ch/smil:arirang_1ch.smil/chunklist_b2256000_sleng.m3u8', currentProgram: 'Arirang World Live', time: '24/7', viewers: '890K', country: 'KR' },
  { id: 34, name: 'NBC News NOW', logo: '🇺🇸', url: 'https://d1si3n1st4nkgb.cloudfront.net/10502/88896001/hls/master.m3u8?ads.xumo_channelId=88896001', currentProgram: 'NBC News NOW Live', time: '24/7', viewers: '1.5M', country: 'US' },
  { id: 35, name: 'Reuters', logo: '📰', url: 'https://amg00453-reuters-amg00453c1-rakuten-uk-2110.playouts.now.amagi.tv/playlist/amg00453-reuters-reuters-rakutenuk/playlist.m3u8', currentProgram: 'Reuters Live', time: '24/7', viewers: '920K', country: 'US' },
  { id: 36, name: 'CBS News', logo: '🇺🇸', url: 'https://dai.google.com/linear/hls/event/Sid4xiTQTkCT1SLu6rjUSQ/master.m3u8', currentProgram: 'CBS News Live', time: '24/7', viewers: '1.3M', country: 'US' },
  { id: 37, name: 'The Guardian', logo: '📰', url: 'https://rakuten-guardian-1-ie.samsung.wurl.tv/playlist.m3u8', currentProgram: 'The Guardian Live', time: '24/7', viewers: '480K', country: 'UK' },
  { id: 38, name: 'Cheddar', logo: '💼', url: 'https://hls.livecdn.io/cheddar.com/cheddar/playlist.m3u8', currentProgram: 'Cheddar Business Live', time: '24/7', viewers: '650K', country: 'US' },
]

const entertainmentChannels: Channel[] = [
  { id: 40, name: 'Great! Movies', logo: '🎬', url: 'https://amg01753-narrativeuk-amg01753c3-lg-gb-1833.playouts.now.amagi.tv/playlist/amg01753-narrativeuk-greatmovies-lggb/playlist.m3u8', currentProgram: 'Great! Movies Live', time: '24/7', viewers: '420K', country: 'UK' },
  { id: 41, name: 'Great! Romance', logo: '💕', url: 'https://amg01753-narrativeuk-amg01753c2-lg-gb-1832.playouts.now.amagi.tv/playlist/amg01753-narrativeuk-greatchristmas-lggb/playlist.m3u8', currentProgram: 'Great! Romance Live', time: '24/7', viewers: '280K', country: 'UK' },
  { id: 42, name: 'Blaze', logo: '🔥', url: 'https://live.blaze.tv/live7/blaze/bitrate1.isml/live.m3u8', currentProgram: 'Blaze Live', time: '24/7', viewers: '540K', country: 'UK' },
  { id: 43, name: 'True Crime', logo: '🔍', url: 'https://b6cca454.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/U2Ftc3VuZy1nYl9UcnVlQ3JpbWVVS2Zyb21DQlNSZWFsaXR5X0hMUw/playlist.m3u8', currentProgram: 'True Crime Live', time: '24/7', viewers: '380K', country: 'UK' },
  { id: 44, name: 'TBN UK', logo: '✝️', url: 'https://live-tbn-ssai.simplestreamcdn.com/v1/master/774d979dd66704abea7c5b62cb34c6815fda0d35/tbn-live/manifest.m3u8', currentProgram: 'TBN UK Live', time: '24/7', viewers: '190K', country: 'UK' },
  { id: 45, name: 'Talking Pictures TV', logo: '📽️', url: 'http://92.114.85.72:8000/play/a0la', currentProgram: 'Talking Pictures Live', time: '24/7', viewers: '150K', country: 'UK' },
  { id: 46, name: 'Together TV', logo: '🤝', url: 'http://92.114.85.72:8000/play/a0j8', currentProgram: 'Together TV Live', time: '24/7', viewers: '130K', country: 'UK' },
]

const shoppingChannels: Channel[] = [
  { id: 50, name: 'QVC UK', logo: '🛍️', url: 'https://qvcuk-live.akamaized.net/hls/live/2097112/qvc/3/3.m3u8', currentProgram: 'QVC UK Live', time: '24/7', viewers: '680K', country: 'UK' },
  { id: 51, name: 'QVC Beauty', logo: '💄', url: 'https://qvcuk-live.akamaized.net/hls/live/2097112/qby/3/3.m3u8', currentProgram: 'QVC Beauty Live', time: '24/7', viewers: '320K', country: 'UK' },
  { id: 52, name: 'QVC Extra', logo: '🛍️', url: 'https://qvcuk-live.akamaized.net/hls/live/2097112/qex/3/3.m3u8', currentProgram: 'QVC Extra Live', time: '24/7', viewers: '240K', country: 'UK' },
  { id: 53, name: 'QVC Style', logo: '👗', url: 'https://qvcuk-live.akamaized.net/hls/live/2097112/qst/3/3.m3u8', currentProgram: 'QVC Style Live', time: '24/7', viewers: '280K', country: 'UK' },
  { id: 54, name: 'TJC', logo: '💎', url: 'https://cdn-shop-lc-01.akamaized.net/Content/HLS_HLS/Live/channel(TJCOTT)/index.m3u8', currentProgram: 'TJC Live', time: '24/7', viewers: '190K', country: 'UK' },
  { id: 55, name: 'Jewellery Maker', logo: '💍', url: 'https://lo3.gemporia.com/abrjewellerymaker/smil:livestreamFullHD.smil/playlist.m3u8', currentProgram: 'Jewellery Maker Live', time: '24/7', viewers: '110K', country: 'UK' },
  { id: 56, name: 'Hobby Maker', logo: '🎨', url: 'https://lo3.gemporia.com/abrhobbymakerukgfx/smil:livestreamFullHD.smil/playlist.m3u8', currentProgram: 'Hobby Maker Live', time: '24/7', viewers: '85K', country: 'UK' },
  { id: 57, name: 'GemsTV', logo: '💎', url: 'https://lo3.gemporia.com/abrgemporiaukgfx/smil:livestream.smil/playlist.m3u8', currentProgram: 'GemsTV Live', time: '24/7', viewers: '95K', country: 'UK' },
]

const musicChannels: Channel[] = [
  { id: 60, name: 'Now 70s', logo: '🎵', url: 'https://lightning-now70s-samsungnz.amagi.tv/playlist.m3u8', currentProgram: 'Now 70s Music', time: '24/7', viewers: '450K', country: 'UK' },
  { id: 61, name: 'Now 80s', logo: '🎸', url: 'https://lightning-now80s-samsunguk.amagi.tv/playlist.m3u8', currentProgram: 'Now 80s Music', time: '24/7', viewers: '620K', country: 'UK' },
  { id: 62, name: 'Now Rock', logo: '🤘', url: 'https://lightning-now90s-samsungnz.amagi.tv/playlist.m3u8', currentProgram: 'Now Rock Music', time: '24/7', viewers: '380K', country: 'UK' },
]

const documentaryChannels: Channel[] = [
  { id: 70, name: 'CGTN Documentary', logo: '🌍', url: 'https://news.cgtn.com/resource/live/document/cgtn-doc.m3u8', currentProgram: 'CGTN Documentary Live', time: '24/7', viewers: '340K', country: 'CN' },
  { id: 71, name: 'RT Documentary', logo: '🎬', url: 'https://rt-rtd.rttv.com/dvr/rtdoc/playlist.m3u8', currentProgram: 'RT Documentary Live', time: '24/7', viewers: '520K', country: 'RU' },
  { id: 72, name: 'Peer TV South Tyrol', logo: '🏔️', url: 'https://iptv.peer.biz/live/peertv-en.m3u8', currentProgram: 'Peer TV Live', time: '24/7', viewers: '85K', country: 'IT' },
]

const kidsChannels: Channel[] = [
  { id: 80, name: 'CBBC', logo: '🧒', url: 'https://vs-hls-pushb-uk-live.akamaized.net/x=4/i=urn:bbc:pips:service:cbbc_hd/t=3840/v=pv14/b=5070016/main.m3u8', currentProgram: 'CBBC Live', time: '24/7', viewers: '890K', country: 'UK' },
  { id: 81, name: 'CBeebies', logo: '👶', url: 'https://vs-hls-pushb-uk-live.akamaized.net/x=4/i=urn:bbc:pips:service:cbeebies_hd/t=3840/v=pv14/b=5070016/main.m3u8', currentProgram: 'CBeebies Live', time: '24/7', viewers: '1.2M', country: 'UK' },
  { id: 82, name: 'Pop', logo: '🎈', url: 'https://amg01753-narrativeentert-popkids-lggb-xyy5k.amagi.tv/ts-eu-w1-n2/playlist/amg01753-narrativeentert-popkids-lggb/playlist.m3u8', currentProgram: 'Pop Kids Live', time: '24/7', viewers: '340K', country: 'UK' },
]

export const channelCategories: ChannelCategory[] = [
  { name: 'UK Channels', icon: Tv, channels: ukChannels },
  { name: 'News', icon: Newspaper, channels: newsChannels },
  { name: 'Entertainment', icon: Clapperboard, channels: entertainmentChannels },
  { name: 'Shopping', icon: ShoppingBag, channels: shoppingChannels },
  { name: 'Music', icon: Music, channels: musicChannels },
  { name: 'Documentary', icon: Globe, channels: documentaryChannels },
  { name: 'Kids', icon: Baby, channels: kidsChannels },
]

export const allChannels: Channel[] = channelCategories.flatMap((c) => c.channels)

export function getChannelById(id: number): Channel | undefined {
  return allChannels.find((c) => c.id === id)
}

export function getCategoryForChannel(id: number): ChannelCategory | undefined {
  return channelCategories.find((c) => c.channels.some((ch) => ch.id === id))
}

export type EpgEntry = {
  time: string
  title: string
  live: boolean
}

// Deterministic mock EPG schedule built from the channel's "now" program.
export function getChannelSchedule(id: number): EpgEntry[] {
  const channel = getChannelById(id)
  if (!channel) return []

  const upcoming = [
    channel.currentProgram,
    'Primetime Highlights',
    'Late Night Special',
    'After Dark Marathon',
    'Early Morning Block',
  ]

  return upcoming.map((title, i) => {
    const hour = (20 + i) % 24
    const next = (hour + 1) % 24
    return {
      time: `${String(hour).padStart(2, '0')}:00 - ${String(next).padStart(2, '0')}:00`,
      title,
      live: i === 0,
    }
  })
}

// Fallback test stream (used only if a channel has no URL).
export const LIVE_STREAM_URL =
  'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8'
