export default {
  async fetch(request, env) {
    const rangeHeader = request.headers.get("Range");

    // No Range header requested -- just serve normally, but make sure the
    // browser knows up front that this server *can* do range requests, so
    // it knows seeking is worth attempting later.
    if (!rangeHeader) {
      const response = await env.ASSETS.fetch(request);
      const headers = new Headers(response.headers);
      headers.set("Accept-Ranges", "bytes");
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    // A Range header is present (e.g. audio/video seeking). Cloudflare's
    // zero-code static asset serving doesn't reliably honor these, so fetch
    // the full asset once and slice it ourselves into a proper 206 response.
    const fullResponse = await env.ASSETS.fetch(
      new Request(request.url, { method: "GET" })
    );
    if (!fullResponse.ok) return fullResponse;

    const buffer = await fullResponse.arrayBuffer();
    const size = buffer.byteLength;

    const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
    if (!match) {
      const headers = new Headers(fullResponse.headers);
      headers.set("Accept-Ranges", "bytes");
      return new Response(buffer, { status: 200, headers });
    }

    let start = match[1] ? parseInt(match[1], 10) : 0;
    let end = match[2] ? parseInt(match[2], 10) : size - 1;
    if (Number.isNaN(start)) start = 0;
    if (Number.isNaN(end) || end >= size) end = size - 1;

    if (start > end || start >= size) {
      return new Response(null, {
        status: 416,
        headers: {
          "Content-Range": `bytes */${size}`,
          "Accept-Ranges": "bytes",
        },
      });
    }

    const chunk = buffer.slice(start, end + 1);
    const headers = new Headers(fullResponse.headers);
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    headers.set("Content-Length", String(chunk.byteLength));
    headers.set("Accept-Ranges", "bytes");

    return new Response(chunk, { status: 206, headers });
  },
};
