import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Content-Type", "application/json");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { content: userMessage } = req.body;

    if (!userMessage) {
      res.setHeader("Content-Type", "application/json");
      return res.status(400).json({ error: "Message content required" });
    }

    // Simple non-streaming response for reliability
    const result = await model.generateContent(userMessage);
    const response = result.response;
    const text = response.text();

    res.setHeader("Content-Type", "application/json");
    return res.status(200).json({ content: text, done: true });

  } catch (error: any) {
    console.error("Coach API Error:", error);
    res.setHeader("Content-Type", "application/json");
    
    // Return specific error message
    if (error.message?.includes("quota") || error.message?.includes("limit")) {
      return res.status(429).json({ error: "API limit reached. Try again later." });
    }
    if (error.message?.includes("api key") || error.message?.includes("API_KEY")) {
      return res.status(500).json({ error: "API configuration error" });
    }
    
    return res.status(500).json({ error: "Service temporarily unavailable" });
  }
}
