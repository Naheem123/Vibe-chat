import { NextRequest, NextResponse } from "next/server";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "YOUR_OPENROUTER_API_KEY_HERE";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, model } = body;

    if (!messages || !model) {
      return NextResponse.json({ error: "Missing messages or model" }, { status: 400 });
    }

    if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY === "YOUR_OPENROUTER_API_KEY_HERE") {
      return NextResponse.json({ 
        error: "Server Configuration Error", 
        message: "OPENROUTER_API_KEY is not configured in the server environment variables. Please add it to your .env.local file and restart the development server." 
      }, { status: 500 });
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Vibe Chat Clone",
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      return NextResponse.json({ error: errorData || "Failed to fetch from OpenRouter" }, { status: response.status });
    }

    // Return the response stream directly to the client
    return new NextResponse(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
