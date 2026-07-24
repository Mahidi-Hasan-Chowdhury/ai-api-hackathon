// ============================================================================
// GOOGLE GEMINI AI CLIENT
// ============================================================================

import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY!;

export const ai = new GoogleGenerativeAI(apiKey);

// Model constants
export const EMBEDDING_MODEL = "text-embedding-004";
export const GENERATION_MODEL = "gemini-1.5-flash";

// ============================================================================
// VECTOR EMBEDDING GENERATION
// ============================================================================

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const model = ai.getGenerativeModel({ model: EMBEDDING_MODEL });
    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw new Error("Failed to generate vector embedding");
  }
}

// ============================================================================
// AI REPORT PARSING & TRIAGE
// ============================================================================

const AI_SYSTEM_PROMPT = `You are an expert AI Triage Assistant for civic infrastructure issues.
Parse unstructured or informal text in English, Bangla, or Banglish (e.g., 'mirpur 10 near bridge flood wire fallen urgent').

Output ONLY valid JSON without markdown formatting:
{
  "category": One of ['pothole', 'broken_streetlight', 'water_leak', 'illegal_dumping', 'utility', 'infrastructure', 'other'],
  "summary": Concise 1-2 sentence English summary for government officials,
  "severity_level": One of ['low', 'medium', 'high', 'critical'] based on:
    - CRITICAL: Immediate danger to life, major infrastructure collapse, widespread flooding
    - HIGH: Dangerous conditions affecting many people, major traffic hazards
    - MEDIUM: Significant inconvenience, moderate safety concerns
    - LOW: Minor issues, aesthetic problems, limited impact
  "severity_score": Integer from 1 to 10 (1=minor, 10=critical emergency),
  "severity_rationale": 1-sentence explanation of why this severity was assigned,
  "suggested_action": Actionable recommendation for emergency responders,
  "assigned_department": One of ['Roads & Highways', 'Power & Energy', 'Water & Sewerage', 'Waste Management', 'Public Safety'],
  "confidence": Float from 0.0 to 1.0 representing your certainty,
  "language": 'bn' (for Bangla/Banglish), 'en' (English), or 'unknown'
}

Consider proximity to sensitive areas (schools, hospitals, main roads) when determining severity.
Flooding, fallen wires, and broken infrastructure near schools/hospitals should be CRITICAL.`;

export async function parseReportWithAI(
  description: string,
  location: string
): Promise<{
  category: string;
  summary: string;
  severity_level: string;
  severity_score: number;
  severity_rationale: string;
  suggested_action: string;
  assigned_department: string;
  confidence: number;
  language: string;
}> {
  try {
    const model = ai.getGenerativeModel({ model: GENERATION_MODEL });

    const prompt = `Location: ${location}\n\nDescription: ${description}\n\nParse this report and return ONLY JSON.`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      systemInstruction: AI_SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });

    const response = result.response.text();
    const parsed = JSON.parse(response);

    return {
      category: parsed.category || "other",
      summary: parsed.summary || description.substring(0, 200),
      severity_level: parsed.severity_level || "medium",
      severity_score: Math.max(1, Math.min(10, parsed.severity_score || 5)),
      severity_rationale:
        parsed.severity_rationale || "Severity assessed based on available information.",
      suggested_action:
        parsed.suggested_action || "Investigate and assess the situation.",
      assigned_department: parsed.assigned_department || "Other",
      confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
      language: parsed.language || "unknown",
    };
  } catch (error) {
    console.error("Error parsing report with AI:", error);

    // Fallback values
    return {
      category: "other",
      summary: description.substring(0, 200),
      severity_level: "medium",
      severity_score: 5,
      severity_rationale: "Unable to determine severity automatically.",
      suggested_action: "Review and assess the situation.",
      assigned_department: "Other",
      confidence: 0.3,
      language: "unknown",
    };
  }
}

// ============================================================================
// UTILITY: GENERATE UNIQUE TRACKING CODE
// ============================================================================

export function generateTrackingCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No O, 0, I, 1 to avoid confusion
  let code = "REP-";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
