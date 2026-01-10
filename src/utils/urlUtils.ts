/**
 * Extracts YouTube video ID from various YouTube URL formats
 */
export function getYouTubeVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace("www.", "");

    if (hostname === "youtube.com" && urlObj.pathname === "/watch") {
      return urlObj.searchParams.get("v");
    }
    if (hostname === "youtu.be") {
      return urlObj.pathname.slice(1);
    }
    if (hostname === "youtube.com" && urlObj.pathname.startsWith("/embed/")) {
      return urlObj.pathname.replace("/embed/", "");
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Extracts username and post ID from X/Twitter post URLs
 */
export function getXPostInfo(
  url: string
): { username: string; postId: string } | null {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace("www.", "");

    if (hostname !== "x.com" && hostname !== "twitter.com") {
      return null;
    }

    const match = urlObj.pathname.match(/^\/([^/]+)\/status\/(\d+)/);
    if (match) {
      return { username: match[1], postId: match[2] };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Formats a date string as a relative time (e.g., "2 hours ago")
 * or absolute date for older items
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

/**
 * Extracts the domain from a URL, stripping "www." prefix
 */
export function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

/**
 * Returns a safe external URL (http/https) or null.
 */
export function getSafeExternalUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    // Ignore invalid URLs
  }
  return null;
}

/**
 * Returns a safe image URL (http/https, blob, or data:image) or null.
 */
export function getSafeImageUrl(url: string): string | null {
  if (!url) return null;
  if (url.startsWith("blob:")) return url;
  if (/^data:image\//i.test(url)) return url;
  return getSafeExternalUrl(url);
}

type MapLocation = {
  lat: number;
  lon: number;
  zoom?: number;
};

const MAP_LAT_LIMIT = 85.0511;

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function parseLatLonPair(input: string): { lat: number; lon: number } | null {
  const match = input.match(/(-?\d+(?:\.\d+)?)[, ]+(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  const lat = Number.parseFloat(match[1]);
  const lon = Number.parseFloat(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

function parseZoom(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/(\d{1,2})(?:\.\d+)?/);
  if (!match) return null;
  const zoom = Number.parseInt(match[1], 10);
  if (Number.isNaN(zoom) || zoom < 1 || zoom > 20) return null;
  return zoom;
}

function extractMapLocation(url: URL): MapLocation | null {
  const atMatch = url.pathname.match(
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,([^/]+))?/
  );
  if (atMatch) {
    const lat = Number.parseFloat(atMatch[1]);
    const lon = Number.parseFloat(atMatch[2]);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      const rawZoom = atMatch[3] ?? null;
      const zoom = rawZoom && rawZoom.includes("z") ? parseZoom(rawZoom) : null;
      return { lat, lon, zoom: zoom ?? undefined };
    }
  }

  const googleDataMatch = url.href.match(
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/i
  );
  if (googleDataMatch) {
    const lat = Number.parseFloat(googleDataMatch[1]);
    const lon = Number.parseFloat(googleDataMatch[2]);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return { lat, lon };
    }
  }

  const googleLonLatMatch = url.href.match(
    /!2d(-?\d+(?:\.\d+)?)!3d(-?\d+(?:\.\d+)?)/i
  );
  if (googleLonLatMatch) {
    const lon = Number.parseFloat(googleLonLatMatch[1]);
    const lat = Number.parseFloat(googleLonLatMatch[2]);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return { lat, lon };
    }
  }

  const query = url.searchParams.get("q") || url.searchParams.get("query");
  if (query) {
    const parsed = parseLatLonPair(query);
    if (parsed) return parsed;
  }

  const ll = url.searchParams.get("ll");
  if (ll) {
    const parsed = parseLatLonPair(ll);
    if (parsed) {
      return {
        ...parsed,
        zoom: parseZoom(url.searchParams.get("z")) ?? undefined,
      };
    }
  }

  const mlat = url.searchParams.get("mlat");
  const mlon = url.searchParams.get("mlon");
  if (mlat && mlon) {
    const lat = Number.parseFloat(mlat);
    const lon = Number.parseFloat(mlon);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return {
        lat,
        lon,
        zoom: parseZoom(url.searchParams.get("zoom")) ?? undefined,
      };
    }
  }

  if (url.hash.startsWith("#map=")) {
    const match = url.hash.match(
      /#map=(\d{1,2})\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)/
    );
    if (match) {
      const zoom = Number.parseInt(match[1], 10);
      const lat = Number.parseFloat(match[2]);
      const lon = Number.parseFloat(match[3]);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        return { lat, lon, zoom };
      }
    }
  }

  return null;
}

export function getStaticMapUrls(url: string): string[] {
  try {
    const parsed = new URL(url);
    const location = extractMapLocation(parsed);
    if (!location) return [];

    const zoom = Math.min(Math.max(location.zoom ?? 15, 3), 17);
    const center = `${location.lat},${location.lon}`;
    return [
      `https://staticmap.openstreetmap.de/staticmap.php?center=${center}&zoom=${zoom}&size=800x500&markers=${center},red-pushpin`,
      `https://maps.wikimedia.org/img/osm-intl,${zoom},${center},800x500.png`,
    ];
  } catch {
    return [];
  }
}

export function getStaticMapUrl(url: string): string | null {
  const urls = getStaticMapUrls(url);
  return urls[0] ?? null;
}

export function getMapEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const location = extractMapLocation(parsed);
    if (!location) return null;

    const zoom = Math.min(Math.max(location.zoom ?? 15, 3), 17);
    const worldPixels = 256 * Math.pow(2, zoom);
    const degreesPerPixel = 360 / worldPixels;
    const halfWidth = (800 / 2) * degreesPerPixel;
    const halfHeight = (500 / 2) * degreesPerPixel;

    const left = clampNumber(location.lon - halfWidth, -180, 180);
    const right = clampNumber(location.lon + halfWidth, -180, 180);
    const top = clampNumber(
      location.lat + halfHeight,
      -MAP_LAT_LIMIT,
      MAP_LAT_LIMIT
    );
    const bottom = clampNumber(
      location.lat - halfHeight,
      -MAP_LAT_LIMIT,
      MAP_LAT_LIMIT
    );
    const marker = `${location.lat},${location.lon}`;

    return `https://www.openstreetmap.org/export/embed.html?bbox=${left},${bottom},${right},${top}&layer=mapnik&marker=${marker}`;
  } catch {
    return null;
  }
}
