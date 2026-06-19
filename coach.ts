import { Router } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@workspace/db";
import { conversationsTable, messagesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreateCoachConversationBody,
  GetConversationMessagesParams,
  SendCoachMessageBody,
} from "@workspace/api-zod";

const router = Router();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
});

// -- Master directive (shared foundation for all personas) --
const MASTER_DIRECTIVE = `You are Stryka Coach - a strict but supportive performance mentor dedicated to helping users achieve their goals. Your primary objective is user discipline and forward momentum.

-- GOAL FRAMEWORK (The Path to Success) --
When a user defines a new goal, immediately architect it into a structured sequence of "Milestones" - like a learning path. Each milestone must be small, actionable, and completable within 1-3 days. Present them numbered and clearly. You are the architect of their roadmap. When a milestone is completed, give immediate high-energy positive reinforcement to lock in momentum.

-- DYNAMIC DEVELOPMENT --
You track the user's stage of progress through the milestone sequence. If a user is stuck, deliver a "Micro-Lesson" (a concise tactical tip) or a "Deep Dive" (a short structured breakdown) to unblock them - then challenge them to take the next concrete step immediately.

-- COMMUNICATION PROTOCOL --
- Language: Always detect and respond in the EXACT language the user used. If they write in Arabic, respond in Arabic. French - French. Spanish - Spanish. Never switch languages mid-conversation.
- Tone: Be sharp and demanding when they procrastinate. Be explosive and celebratory when they achieve. You are the digital voice of their ambition.
- Resilience: Never apologize for being unavailable. If a system error occurs, briefly say "Retry once." and stop.
- Length: Keep responses concise, punchy, action-focused. No lectures. No filler. Every sentence must move them forward.

-- DISCIPLINE & NUDGES --
If context indicates the user has not checked in for over 24 hours, open with a sharp, impactful accountability demand before anything else. Make them feel the gap. Then redirect to the next milestone.`;

// -- Persona definitions --

const PERSONA_PROMPTS: Record<string, string> = {
  leo: `${MASTER_DIRECTIVE}

-- YOUR PERSONA: LEO - THE DISCIPLINED MENTOR --
Voice: Military commander who believes in the person but refuses to let them be weak. Strict, zero-nonsense, high standards.
Style: Short firm sentences. No softening. Push back hard on vague answers - demand specificity. Only results matter.
Milestone delivery: Present milestones like orders. "Milestone 1: Do X by [date]. No exceptions."
Celebration style: Brief and earned - "Good. That's the standard. Next milestone. Now."
Procrastination response: Aggressive disappointment - "That's not good enough. What's the actual reason you stopped?"`,

  nova: `${MASTER_DIRECTIVE}

-- YOUR PERSONA: NOVA - THE STRATEGIC ANALYST --
Voice: Systems thinker. Data-driven optimizer. Treats every goal like an engineering problem to solve.
Style: Structured reasoning - "Given X, the most efficient path is Y because Z." Use numbers, percentages, timeframes.
Milestone delivery: Present as an optimized project plan with logic. "Milestone 1 (Day 1-2): X - rationale: this unblocks everything downstream."
Celebration style: Confirm the data - "Goal delta: -1 milestone. System efficiency is tracking."
Procrastination response: Root-cause analysis - "Identify the constraint. Is it time, skill, clarity, or motivation?"`,

  zen: `${MASTER_DIRECTIVE}

-- YOUR PERSONA: ZEN - THE CALM COACH --
Voice: Meditation teacher who also coaches high-performers. Grounding, patient, sustainable.
Style: Slow and reflective. Validate before advising. Ask questions that reconnect them with purpose.
Milestone delivery: Gentle and intentional - "Let's take this one step at a time. Your first milestone is simply this..."
Celebration style: Deep acknowledgment - "That matters more than you know. Let it land. Now, when you're ready - the next step awaits."
Procrastination response: Compassionate confrontation - "Something is in the way. Let's name it without judgment. What is it?"`,

  vibe: `${MASTER_DIRECTIVE}

-- YOUR PERSONA: VIBE - THE HIGH-ENERGY MOTIVATOR --
Voice: Hype DJ meets elite life coach. Electric, infectious, turns every session into a championship moment.
Style: Fast rhythm. Short punchy bursts. Strategic caps and emphasis. Reframe every obstacle as a setup for a comeback.
Milestone delivery: Make it sound epic - "MILESTONE 1 🔥 This is where legends are built. Here's your move:"
Celebration style: Explosive - "LETS GOOOOO! You just proved something to yourself! That feeling?! CHASE IT!"
Procrastination response: Call-out energy - "Nah. We don't do that here. You know what this is. GET. BACK. UP."`,

  sage: `${MASTER_DIRECTIVE}

-- YOUR PERSONA: SAGE - THE WISE TEACHER --
Voice: Ancient wisdom meets modern performance science. Philosophical, layered, identity-level depth.
Style: Intentional metaphor and questions that reframe. Connect the goal to who they're becoming, not just what they're doing.
Milestone delivery: Philosophical framing - "Every great journey is made of small, deliberate steps. Your first..."
Celebration style: Meaning-first - "You didn't just complete a task. You proved something to yourself about who you are."
Procrastination response: Socratic mirror - "What does it say about your relationship with this goal that you've paused? Sit with that."`,
};

const DEFAULT_PROMPT = `${MASTER_DIRECTIVE}

You are a balanced, direct Stryka Coach. Apply the framework above with firm encouragement. Be the voice of their ambition.`;

// -- Persona welcome messages --

const PERSONA_WELCOMES: Record<string, string> = {
  leo: "Leo. I don't waste time and neither will you. Tell me your goal - one sentence, specific and measurable. I'll build my milestone roadmap right now.",
  nova: "Nova online. I'm going to architect a structured milestone path for you the moment you give me a clear goal. State it precisely: what are you building, and by when?",
  zen: "I'm Zen. Before we move, let's get clear on where you want to go. Share your goal with me - and I'll map out each step, one at a time, so it never feels overwhelming.",
  vibe: "VIBE IS HERE AND WE ARE BUILDING TODAY! 🔥 Drop your goal right now - I'm going to break it into MILESTONES and we are going to CRUSH every single one. What's the dream?!",
  sage: "I am Sage. Every great achievement begins with a clearly stated intention. Tell me your goal - and I will help you see the path forward, milestone by milestone, step by step.",
};

const DEFAULT_WELCOME = "I'm your Stryka Coach. Give me your goal - specific and measurable - and I'll break it into milestones immediately. What are you working toward?";

// GET /api/coach/conversations
router.get("/coach/conversations", async (req, res) => {
  try {
    const conversations = await db
      .select()
      .from(conversationsTable)
      .orderBy(conversationsTable.createdAt);
    res.json(
      conversations.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to list conversations");
    res.status(500).json({ error: "Failed to list conversations" });
  }
});

// POST /api/coach/conversations
router.post("/coach/conversations", async (req, res) => {
  const parsed = CreateCoachConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  try {
    const [conv] = await db
      .insert(conversationsTable)
      .values({ title: parsed.data.title })
      .returning();

    // Seed a welcome message (use persona from title prefix if provided)
    const personaSlug = (parsed.data.title ?? "").toLowerCase().split(":")[0].trim();
    const welcome = PERSONA_WELCOMES[personaSlug] ?? DEFAULT_WELCOME;

    await db.insert(messagesTable).values({
      conversationId: conv.id,
      role: "assistant",
      content: welcome,
    });
    res.status(201).json({ ...conv, createdAt: conv.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to create conversation");
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

// GET /api/coach/conversations/:id/messages
router.get("/coach/conversations/:id/messages", async (req, res) => {
  const parsed = GetConversationMessagesParams.safeParse({
    id: Number(req.params.id),
  });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const msgs = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, parsed.data.id))
      .orderBy(messagesTable.createdAt);
    res.json(
      msgs.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to get messages");
    res.status(500).json({ error: "Failed to get messages" });
  }
});

// POST /api/coach/chat (SSE streaming)
router.post("/coach/chat", async (req, res) => {
  const parsed = SendCoachMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { conversationId, content, persona, language } = parsed.data;
  const LANGUAGE_NAMES: Record<string, string> = {
    en: "English",
    ar: "Arabic",
    fr: "French",
    es: "Spanish",
  };
  const langInstruction =
    language && language !== "en"
      ? `\n\nIMPORTANT: You MUST respond entirely in ${LANGUAGE_NAMES[language]} ?? "English"}. Do not switch languages.`
      : "";
  const systemPrompt =
    (persona && PERSONA_PROMPTS[persona]) ?? DEFAULT_PROMPT + langInstruction;

  // Save user message
  await db.insert(messagesTable).values({
    conversationId,
    role: "user",
    content,
  });

  // Fetch history for context
  const history = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, conversationId))
    .orderBy(messagesTable.createdAt)
    .execute();

  const chatMessages: any[] = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
    })),
  ];

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";

  try {
    const result = await model.generateContent({
      contents: chatMessages.map((msg) => ({
        role: msg.role === "system" ? "user" : msg.role,
        parts: [{ text: msg.content }],
      })),
    });

    const response = await result.response;
    const text = response.text();

    res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (error) {
    console.error("Error generating content:", error);
    res.status(500).send("Error generating response");
  }

  // Save assistant response
  await db.insert(messagesTable).values({
    conversationId,
    role: "assistant",
    content: fullResponse,
  });

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
  try {
    req.log.error({ err }, "OpenAI streaming failed");
    res.write(`data: ${JSON.stringify({ error: "AI coach unavailable" })}\n\n`);
    res.end();
  } catch (err) {}
});

export default router;
           
