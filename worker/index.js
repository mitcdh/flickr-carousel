const FLICKR_API_URL = "https://api.flickr.com/services/rest/";
const FLICKR_REQUEST_TIMEOUT = 12000;
const SUCCESS_CACHE_CONTROL = "public, max-age=86400";

function jsonResponse(payload, options = {}) {
  const { status = 200, cacheControl = "no-store", headers = {} } = options;
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": cacheControl,
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

function buildFlickrUrl(env) {
  const requiredVariables = [
    "FLICKR_API_KEY",
    "FLICKR_PHOTOSET_ID",
    "FLICKR_USER_ID",
    "FLICKR_EXTRAS",
  ];
  const missingVariables = requiredVariables.filter((name) => !env[name]);

  if (missingVariables.length > 0) {
    throw new Error(
      `Missing worker configuration: ${missingVariables.join(", ")}`,
    );
  }

  const flickrUrl = new URL(FLICKR_API_URL);
  flickrUrl.search = new URLSearchParams({
    method: "flickr.photosets.getPhotos",
    api_key: env.FLICKR_API_KEY,
    photoset_id: env.FLICKR_PHOTOSET_ID,
    user_id: env.FLICKR_USER_ID,
    extras: env.FLICKR_EXTRAS,
    format: "json",
    nojsoncallback: "1",
  }).toString();
  return flickrUrl;
}

async function handlePhotoRequest(request, env) {
  if (request.method !== "GET") {
    return jsonResponse(
      { success: false, message: "Method not allowed." },
      { status: 405, headers: { Allow: "GET" } },
    );
  }

  const response = await fetch(buildFlickrUrl(env), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(FLICKR_REQUEST_TIMEOUT),
  });
  if (!response.ok) {
    throw new Error(`Flickr returned HTTP ${response.status}`);
  }

  const data = await response.json();
  if (data.stat !== "ok") {
    throw new Error(data.message || "Flickr returned an error");
  }

  const photos = data.photoset?.photo;
  if (!Array.isArray(photos)) {
    throw new TypeError("Flickr returned an invalid photo list");
  }

  return jsonResponse(
    { success: true, photos, message: "" },
    { cacheControl: SUCCESS_CACHE_CONTROL },
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/flickr-api-proxy/")) {
      try {
        return await handlePhotoRequest(request, env);
      } catch (error) {
        console.error("Carousel: Flickr proxy request failed", error);
        return jsonResponse(
          { success: false, message: "Unable to fetch photos from Flickr." },
          { status: 502 },
        );
      }
    }

    return env.ASSETS.fetch(request);
  },
};
