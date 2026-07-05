// app/api/chat/route.js
// Server-side proxy for Claude API calls.
// The ANTHROPIC_API_KEY env var is set in Vercel dashboard — never exposed to the browser.

export async function POST(request) {
  try {
    const body = await request.json();
    const { system, messages } = body;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system,
        messages,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return Response.json({ error: err }, { status: res.status });
    }

    const data = await res.json();
    const reply = data.content?.map((c) => c.text || "").join("") || "";
    return Response.json({ reply });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
