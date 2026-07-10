import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { conversationId, content: userMessage } = req.body;

    if (!userMessage) {
      return res.status(400).json({ error: "Message content required" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const chat = model.startChat({});
    const result = await chat.sendMessageStream(userMessage);

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      res.write(`data: ${JSON.stringify({ content: chunkText })}

`);
    }

    res.write(`data: ${JSON.stringify({ done: true })}

`);
    res.end();

  } catch (error: any) {
    console.error("Coach API Error:", error);
    res.setHeader("Content-Type", "application/json");
    res.status(500).json({ error: "Service unavailable" });
  }
}
