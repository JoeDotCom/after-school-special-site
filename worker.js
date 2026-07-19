export default {
  async fetch(request, env) {
    // Proxy every request through the static asset binding. Routing static
    // files through a Worker (instead of Cloudflare's zero-code assets-only
    // mode) is what enables proper HTTP Range request support -- needed for
    // audio/video seeking to work at all.
    return env.ASSETS.fetch(request);
  },
};
