// Export a default object with a fetch method
export default {
  async fetch(request, env, ctx) {
    try {
      console.log("Request received:", request.url);
      const url = new URL(request.url);

      // Handle API requests
      if (url.pathname.startsWith("/flickr-api-proxy/")) {
        console.log("Processing API request");

        const {
          FLICKR_API_KEY,
          FLICKR_PHOTOSET_ID,
          FLICKR_USER_ID,
          FLICKR_EXTRAS,
        } = env;

        console.log("Environment variables loaded:", {
          apiKeyExists: !!FLICKR_API_KEY,
          photosetIdExists: !!FLICKR_PHOTOSET_ID,
          userIdExists: !!FLICKR_USER_ID,
          extrasExists: !!FLICKR_EXTRAS,
        });

        const CONFIG = {
          api_key: FLICKR_API_KEY,
          photoset_id: FLICKR_PHOTOSET_ID,
          userId: FLICKR_USER_ID,
          extras: FLICKR_EXTRAS,
        };

        const flickrUrl = `https://api.flickr.com/services/rest/?method=flickr.photosets.getPhotos&api_key=${CONFIG.api_key}&photoset_id=${CONFIG.photoset_id}&user_id=${CONFIG.userId}&extras=${CONFIG.extras}&format=json&nojsoncallback=1`;
        console.log(
          "Fetching from Flickr API:",
          flickrUrl.replace(CONFIG.api_key, "API_KEY_REDACTED")
        );

        try {
          const response = await fetch(flickrUrl);
          console.log("Flickr API response status:", response.status);

          const data = await response.json();
          console.log("Flickr API response:", data.stat);

          return new Response(
            JSON.stringify({
              success: data.stat === "ok",
              photos: data.stat === "ok" ? data.photoset.photo : [],
              message: data.stat !== "ok" ? data.message : "",
            }),
            {
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=86400", // 24 hours in seconds
              },
            }
          );
        } catch (error) {
          console.error("Error fetching from Flickr API:", error);
          return new Response(
            JSON.stringify({
              success: false,
              message: "Error fetching from Flickr API.",
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      }

      // For non-API requests, let the static assets handling take over
      console.log("Handling static asset request");
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error("Unhandled error in worker:", error);
      return new Response(
        JSON.stringify({
          success: false,
          message: "Internal server error.",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  },
};
