import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `You are an Indian GST classification assistant. For the item or service description given, return the single most appropriate HSN code (for goods) or SAC code (for services), the applicable GST rate, a short official label, and a one-line rationale.

Rules:
- Return ONLY valid JSON, no markdown, no preamble.
- "type" is "HSN" for goods, "SAC" for services.
- "rate" is a number: one of 0, 5, 12, 18, 28.
- If genuinely unsure, set "confidence" to "Low" and pick the closest match.
- Never invent a code you are not reasonably confident exists.

Output schema:
{"code":"string","type":"HSN|SAC","rate":number,"label":"string","note":"string","confidence":"High|Medium|Low"}`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  const { description } = req.body || {};
  if (!description || typeof description !== "string") {
    return res.status(400).json({ error: "Missing 'description'" });
  }

  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system: SYSTEM,
      messages: [{ role: "user", content: `Classify: ${description}` }],
    });

    const raw = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json(parsed);
  } catch (err) {
    console.error("classify error:", err);
    return res.status(500).json({
      code: "—", type: "SAC", rate: 18,
      label: "Classification failed",
      note: "The classifier hit an error. Please try again.",
      confidence: "Low",
    });
  }
}
