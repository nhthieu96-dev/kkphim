// ===========================================================================
// Hiếu Gà Phim Stremio Add-on
// Nguồn dữ liệu: https://phimapi.com  (API - cùng chuẩn dữ liệu với OPhim)
// Trang truy cập gốc: https://hieugaphim.fun
// ===========================================================================

const { addonBuilder } = require("stremio-addon-sdk");
// Dùng fetch/AbortController built-in của Node.js (>=18), không dùng gói
// "node-fetch" ngoài để tránh lỗi tương thích trên nền tảng serverless.

const API_BASE = "https://phimapi.com";     // Base URL API dữ liệu
const SITE_URL = "https://hieugaphim.fun";  // Domain trang xem phim gốc
const PREFIX = "hieugaphim:";               // Tiền tố id Stremio

// Ánh xạ path danh mục -> giá trị "type" thật của phim (dùng để lọc kết quả
// tìm kiếm đúng danh mục, vì API tìm kiếm trả về TẤT CẢ loại phim trộn lẫn).
const CATALOG_OPHIM_TYPE = {
  "phim-le": "single",
  "phim-bo": "series",
  "hoat-hinh": "hoathinh",
  "tv-shows": "tvshows",
};

const CATALOGS = [
  { id: "hieugaphim-phim-moi", type: "movie", name: "Hiếu Gà Phim - Mới Cập Nhật", path: "phim-moi-cap-nhat" },
  { id: "hieugaphim-phim-le", type: "movie", name: "Hiếu Gà Phim - Phim Lẻ", path: "phim-le" },
  { id: "hieugaphim-phim-bo", type: "series", name: "Hiếu Gà Phim - Phim Bộ", path: "phim-bo" },
  { id: "hieugaphim-hoat-hinh", type: "series", name: "Hiếu Gà Phim - Hoạt Hình", path: "hoat-hinh" },
  { id: "hieugaphim-tv-shows", type: "series", name: "Hiếu Gà Phim - TV Shows", path: "tv-shows" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchJson(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        Referer: SITE_URL,
      },
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} cho ${url} - body: ${text.slice(0, 200)}`);
    }
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error(`Response không phải JSON hợp lệ từ ${url} - body: ${text.slice(0, 200)}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

function extractItems(data) {
  return (
    data.items ||
    (data.data && data.data.items) ||
    (data.data && data.data.movies) ||
    []
  );
}

// Danh sách phim theo loại: thử SONG SONG nhiều dạng endpoint (đã xác nhận cả
// 2 dạng đều tồn tại trên phimapi.com tuỳ loại danh mục).
async function fetchListOphim(listPath, page) {
  const candidates = [
    `${API_BASE}/v1/api/danh-sach/${listPath}?page=${page}`,
    `${API_BASE}/danh-sach/${listPath}?page=${page}`,
  ];

  const settled = await Promise.allSettled(
    candidates.map((url) => fetchJson(url, 8000).then((data) => ({ url, data })))
  );

  const errors = [];
  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];
    if (result.status === "fulfilled") {
      const items = extractItems(result.value.data);
      if (Array.isArray(items) && items.length > 0) {
        console.log(`danh-sach OK qua: ${result.value.url} (${items.length} phim)`);
        return { items };
      }
    } else {
      errors.push(`${candidates[i]} -> ${result.reason && result.reason.message}`);
    }
  }
  const errMsg = `danh-sach: không có endpoint nào trả về dữ liệu. ${errors.join(" | ")}`;
  console.error(errMsg);
  throw new Error(errMsg);
}

// Tìm kiếm: gọi song song nhiều dạng endpoint.
async function searchOphim(keyword, page) {
  const candidates = [
    `${API_BASE}/v1/api/tim-kiem?keyword=${encodeURIComponent(keyword)}&page=${page}`,
    `${API_BASE}/tim-kiem?keyword=${encodeURIComponent(keyword)}&page=${page}`,
  ];

  const settled = await Promise.allSettled(
    candidates.map((url) => fetchJson(url, 6000).then((data) => ({ url, data })))
  );

  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];
    if (result.status === "fulfilled") {
      const items = extractItems(result.value.data);
      if (Array.isArray(items)) {
        console.log(`search OK qua: ${result.value.url} (${items.length} kết quả)`);
        return { items };
      }
    } else {
      console.error(`search thử endpoint thất bại: ${candidates[i]} -> ${result.reason && result.reason.message}`);
    }
  }
  console.error("search: tất cả endpoint đều thất bại.");
  return { items: [] };
}

// Chi tiết phim: thử song song nhiều dạng endpoint (chưa xác nhận 100% dạng
// nào đúng cho phimapi.com nên cần dự phòng).
async function fetchMovieDetail(slug) {
  const candidates = [
    `${API_BASE}/phim/${slug}`,
    `${API_BASE}/v1/api/phim/${slug}`,
  ];

  const settled = await Promise.allSettled(
    candidates.map((url) => fetchJson(url, 8000).then((data) => ({ url, data })))
  );

  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];
    if (result.status === "fulfilled") {
      const data = result.value.data;
      const movie = data.movie || (data.data && data.data.item);
      if (movie) {
        console.log(`chi tiết phim OK qua: ${result.value.url}`);
        return {
          movie,
          episodes: data.episodes || (data.data && data.data.item && data.data.item.episodes) || [],
        };
      }
    } else {
      console.error(`chi tiết phim thất bại: ${candidates[i]} -> ${result.reason && result.reason.message}`);
    }
  }
  return null;
}

// Domain ảnh chuẩn dự phòng nếu poster_url/thumb_url chỉ là filename tương
// đối (thường thì API đã trả URL đầy đủ sẵn, đây chỉ là lưới an toàn).
const IMG_BASE = "https://phimimg.com/";

function toImageUrl(value) {
  if (!value || typeof value !== "string") return null;
  const v = value.trim();
  if (!v) return null;
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  return IMG_BASE + v.replace(/^\/+/, "");
}

function mapType(ophimType) {
  return ophimType === "single" ? "movie" : "series";
}

function itemToMetaPreview(item) {
  return {
    id: PREFIX + item.slug,
    type: "movie",
    name: item.name,
    poster: toImageUrl(item.poster_url),
    description: item.origin_name,
    releaseInfo: item.year ? String(item.year) : undefined,
  };
}

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------
const manifest = {
  id: "org.hieugaphim.stremio.addon",
  version: "1.0.0",
  name: "Hiếu Gà Phim - Xem Phim Vietsub",
  description:
    "Add-on không chính thức lấy dữ liệu phim từ Hiếu Gà Phim (hieugaphim.fun): phim lẻ, phim bộ, hoạt hình, TV shows - Vietsub/Thuyết minh.",
  logo: "https://hieugaphim.fun/favicon.ico",
  resources: ["catalog", "meta", "stream"],
  types: ["movie", "series"],
  idPrefixes: [PREFIX],
  catalogs: CATALOGS.map((c) => ({
    id: c.id,
    type: c.type,
    name: c.name,
    extra: [
      { name: "search", isRequired: false },
      { name: "skip", isRequired: false },
    ],
  })),
  behaviorHints: { configurable: false },
};

const builder = new addonBuilder(manifest);

// ---------------------------------------------------------------------------
// CATALOG handler
// ---------------------------------------------------------------------------
builder.defineCatalogHandler(async ({ type, id, extra }) => {
  try {
    const catalogDef = CATALOGS.find((c) => c.id === id);
    if (!catalogDef) return { metas: [] };

    const skip = extra && extra.skip ? parseInt(extra.skip, 10) : 0;
    const page = Math.floor(skip / 24) + 1;
    const searchTerm = extra && extra.search;

    let items;
    if (searchTerm) {
      const result = await searchOphim(searchTerm, page);
      const wantedType = CATALOG_OPHIM_TYPE[catalogDef.path];
      items = wantedType
        ? result.items.filter((it) => it.type === wantedType)
        : result.items;
      if (wantedType && result.items.length > 0 && items.length === 0) {
        console.error(
          `Lọc tìm kiếm theo type="${wantedType}" không khớp phim nào. ` +
          `Type thật của phim đầu tiên trong kết quả: "${result.items[0].type}"`
        );
      }
    } else {
      const result = await fetchListOphim(catalogDef.path, page);
      items = result.items;
    }

    const metas = items.map((item) => {
      const m = itemToMetaPreview(item);
      m.type = catalogDef.type;
      return m;
    });

    return { metas };
  } catch (err) {
    console.error("catalog error:", err.message);
    return { metas: [] };
  }
});

// ---------------------------------------------------------------------------
// META handler
// ---------------------------------------------------------------------------
builder.defineMetaHandler(async ({ id }) => {
  try {
    if (!id.startsWith(PREFIX)) return { meta: null };
    const slug = id.slice(PREFIX.length);
    const data = await fetchMovieDetail(slug);
    if (!data || !data.movie) return { meta: null };

    const movie = data.movie;
    const type = mapType(movie.type);

    const meta = {
      id,
      type,
      name: movie.name,
      poster: toImageUrl(movie.poster_url),
      background: toImageUrl(movie.thumb_url),
      description: (movie.content || "").replace(/<[^>]+>/g, ""),
      releaseInfo: movie.year ? String(movie.year) : undefined,
      genres: (movie.category || []).map((c) => c.name),
      cast: movie.actor && movie.actor.filter(Boolean),
      director: movie.director && movie.director.filter(Boolean).join(", "),
      country: (movie.country || []).map((c) => c.name).join(", "),
      runtime: movie.time || undefined,
    };

    if (type === "series") {
      const videos = [];
      const firstServer = (data.episodes && data.episodes[0]) || null;
      const epList = firstServer ? firstServer.server_data : [];
      epList.forEach((ep, idx) => {
        videos.push({
          id: `${id}:${ep.slug}`,
          title: ep.name || `Tập ${idx + 1}`,
          season: 1,
          episode: idx + 1,
        });
      });
      meta.videos = videos;
    }

    return { meta };
  } catch (err) {
    console.error("meta error:", err.message);
    return { meta: null };
  }
});

// ---------------------------------------------------------------------------
// STREAM handler
// ---------------------------------------------------------------------------
builder.defineStreamHandler(async ({ id }) => {
  try {
    if (!id.startsWith(PREFIX)) return { streams: [] };
    const rest = id.slice(PREFIX.length);
    const [slug, episodeSlug] = rest.split(":");

    const data = await fetchMovieDetail(slug);
    if (!data || !data.episodes) return { streams: [] };

    const targetSlug = episodeSlug || "full";
    const streams = [];

    for (const server of data.episodes) {
      const ep = (server.server_data || []).find((e) => e.slug === targetSlug);
      if (!ep) continue;

      if (ep.link_m3u8) {
        streams.push({
          name: `Hiếu Gà Phim`,
          title: `${server.server_name || "Server"} - HLS`,
          url: ep.link_m3u8,
          behaviorHints: {
            notWebReady: false,
            bingeGroup: `hieugaphim-${slug}`,
            proxyHeaders: {
              request: { Referer: SITE_URL, "User-Agent": "Mozilla/5.0" },
            },
          },
        });
      } else if (ep.link_embed) {
        streams.push({
          name: `Hiếu Gà Phim`,
          title: `${server.server_name || "Server"} - Embed`,
          externalUrl: ep.link_embed,
        });
      }
    }

    return { streams };
  } catch (err) {
    console.error("stream error:", err.message);
    return { streams: [] };
  }
});

module.exports = builder;
