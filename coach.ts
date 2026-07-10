import { Router } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

router.post("/coach/chat", async (req, res) => {
  try {
    const { conversationId, content } = req.body;
    
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    
    const chat = model.startChat({});
    const result = await chat.sendMessageStream(content);
    
    let fullResponse = "";
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullResponse += chunkText;
      res.write(`data: ${JSON.stringify({ content: chunkText })}\n\n`);
    }
    
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error) {
    console.error("Coach API Error:", error);
    res.status(500).write(`data: ${JSON.stringify({ error: "Service unavailable" })}\n\n`);
    res.end();
  }
});

export default router;
