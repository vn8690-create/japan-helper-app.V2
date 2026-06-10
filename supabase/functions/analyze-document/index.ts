import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// Max image size accepted (bytes after base64 decode). ~10 MB raw.
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

// Gemini API call timeout in milliseconds.
const GEMINI_TIMEOUT_MS = 25_000;

// Accepted MIME types for Gemini Vision.
const ACCEPTED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

type Urgency = "low" | "medium" | "high" | "critical";
type DocumentType = "tax" | "insurance" | "pension" | "cityHall" | "other";

type ErrorCode =
  | "API_KEY_MISSING"
  | "INVALID_INPUT"
  | "IMAGE_TOO_LARGE"
  | "UNSUPPORTED_MIME"
  | "GEMINI_ERROR"
  | "GEMINI_BLOCKED"
  | "TIMEOUT"
  | "PARSE_ERROR"
  | "NO_TEXT"
  | "UNKNOWN";

interface ActionItem {
  title: string;
  description: string;
  due_date: string | null;
  urgency: Urgency;
  category: DocumentType;
}

interface AnalysisResult {
  ocrText: string;
  title: string;
  documentType: DocumentType;
  urgency: Urgency;
  deadline: string | null;
  summary: string;
  actionItems: ActionItem[];
}

function errorResponse(code: ErrorCode, message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message, code }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Gemini prompt
// ---------------------------------------------------------------------------
function buildPrompt(language: string, today: string): string {
  const summaryLang =
    language === "ja" ? "Japanese" : language === "vi" ? "Vietnamese" : "English";

  return `You are a document analysis assistant helping foreign residents in Japan understand official Japanese documents.

Carefully analyze the document image. Respond with ONLY valid JSON — no markdown fences, no extra text.

Required JSON format:
{
  "ocrText": "<all text extracted from the image — keep original Japanese characters>",
  "title": "<short descriptive English title, e.g. 'Resident Tax Notice 2026'>",
  "documentType": "<tax|insurance|pension|cityHall|other>",
  "urgency": "<low|medium|high|critical>",
  "deadline": "<YYYY-MM-DD of the most important deadline, or null>",
  "summary": "<3-5 bullet points in ${summaryLang}, each starting with '• ' on its own line — explain what the doc is, key amounts/dates, action required>",
  "actionItems": [
    {
      "title": "<concise action in English>",
      "description": "<one sentence in ${summaryLang}>",
      "due_date": "<YYYY-MM-DD or null>",
      "urgency": "<low|medium|high|critical>",
      "category": "<tax|insurance|pension|cityHall|other>"
    }
  ]
}

Classification:
- "tax"       : 住民税, 所得税, 確定申告, tax payment slips
- "insurance" : 国民健康保険, 社会保険, health insurance docs
- "pension"   : 年金, 国民年金, 厚生年金
- "cityHall"  : 住民票, マイナンバー, 転居届, 転入届, municipal notices
- "other"     : utility bills, bank letters, school notices, anything else

Urgency (today = ${today}):
- "critical" : deadline ≤ 7 days away, or already past
- "high"     : deadline ≤ 30 days
- "medium"   : deadline ≤ 90 days
- "low"      : no deadline, or > 90 days away

Provide 1–3 concrete actionItems.
If the image is blurry, unreadable, or not a document, set documentType "other" and explain clearly in the summary what the problem is.
If no text is visible at all, set ocrText to "" and explain in summary.`;
}

// ---------------------------------------------------------------------------
// Gemini API call with timeout + 1 retry on 429/503
// ---------------------------------------------------------------------------
async function callGemini(
  imageBase64: string,
  mimeType: string,
  prompt: string,
  apiKey: string,
  attempt = 0
): Promise<{ text: string } | { blocked: true } | { error: string; retryable: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const res = await fetch(
      `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inlineData: { mimeType, data: imageBase64 } },
                { text: prompt },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
            maxOutputTokens: 4096,
          },
          safetySettings: [
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
          ],
        }),
      }
    );

    clearTimeout(timer);

    // Retry once on rate-limit or server overload
    if ((res.status === 429 || res.status === 503) && attempt < 1) {
      const waitMs = res.status === 429 ? 3000 : 1500;
      await new Promise((r) => setTimeout(r, waitMs));
      return callGemini(imageBase64, mimeType, prompt, apiKey, attempt + 1);
    }

    if (!res.ok) {
      let msg = `Gemini HTTP ${res.status}`;
      try {
        const body = await res.json();
        msg = body?.error?.message ?? msg;
      } catch { /* ignore */ }
      return { error: msg, retryable: res.status >= 500 };
    }

    const data = await res.json();

    // Check for safety block
    const finishReason = data?.candidates?.[0]?.finishReason;
    if (finishReason === "SAFETY" || finishReason === "RECITATION") {
      return { blocked: true };
    }

    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return { error: "Empty Gemini response", retryable: false };
    }
    return { text };
  } catch (err) {
    clearTimeout(timer);
    if ((err as Error).name === "AbortError") {
      return { error: "Request timed out after 25 seconds", retryable: true };
    }
    return { error: (err as Error).message ?? "Network error", retryable: true };
  }
}

// ---------------------------------------------------------------------------
// JSON parsing with code-fence stripping
// ---------------------------------------------------------------------------
function safeParseJson(raw: string): Record<string, unknown> | null {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* fall through */ }
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// Validate + normalise Gemini JSON into a strict AnalysisResult
// ---------------------------------------------------------------------------
function normalise(raw: Record<string, unknown>): AnalysisResult {
  const VALID_DOC_TYPES: DocumentType[] = ["tax", "insurance", "pension", "cityHall", "other"];
  const VALID_URGENCIES: Urgency[] = ["low", "medium", "high", "critical"];
  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

  const documentType = VALID_DOC_TYPES.includes(raw.documentType as DocumentType)
    ? (raw.documentType as DocumentType)
    : "other";

  const urgency = VALID_URGENCIES.includes(raw.urgency as Urgency)
    ? (raw.urgency as Urgency)
    : "medium";

  const deadline =
    typeof raw.deadline === "string" && ISO_DATE.test(raw.deadline)
      ? raw.deadline
      : null;

  const rawItems = Array.isArray(raw.actionItems) ? raw.actionItems : [];
  const actionItems: ActionItem[] = rawItems.slice(0, 5).map((item) => {
    const i = item as Record<string, unknown>;
    return {
      title: typeof i.title === "string" && i.title ? i.title : "Review document",
      description: typeof i.description === "string" ? i.description : "",
      due_date:
        typeof i.due_date === "string" && ISO_DATE.test(i.due_date) ? i.due_date : null,
      urgency: VALID_URGENCIES.includes(i.urgency as Urgency)
        ? (i.urgency as Urgency)
        : urgency,
      category: VALID_DOC_TYPES.includes(i.category as DocumentType)
        ? (i.category as DocumentType)
        : documentType,
    };
  });

  const ocrText = typeof raw.ocrText === "string" ? raw.ocrText.trim() : "";
  const title =
    typeof raw.title === "string" && raw.title.trim()
      ? raw.title.trim()
      : "Document";
  const summary = typeof raw.summary === "string" ? raw.summary.trim() : "";

  return { ocrText, title, documentType, urgency, deadline, summary, actionItems };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Health check / diagnostic endpoint — GET /analyze-document[?action=test[&model=X]]
  if (req.method === "GET") {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const overrideModel = url.searchParams.get("model");

    // ?action=test  — fire the simplest possible generateContent("hello") and
    // return the complete raw Gemini response for diagnosis
    if (action === "test" && apiKey) {
      const modelsToTry = overrideModel
        ? [overrideModel]
        : [GEMINI_MODEL, "gemini-2.0-flash", "gemini-2.5-flash", "gemini-flash-latest"];

      const results: Record<string, unknown>[] = [];

      for (const model of modelsToTry) {
        for (const apiVer of ["v1beta", "v1"]) {
          const endpoint = `https://generativelanguage.googleapis.com/${apiVer}/models/${model}:generateContent?key=${apiKey}`;
          const body = JSON.stringify({
            contents: [{ parts: [{ text: "Reply with exactly: GEMINI_OK" }] }],
          });
          try {
            const res = await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body,
              signal: AbortSignal.timeout(15000),
            });
            const rawText = await res.text();
            let parsed: unknown;
            try { parsed = JSON.parse(rawText); } catch { parsed = rawText; }
            results.push({ model, apiVer, httpStatus: res.status, response: parsed });
            if (res.ok) break; // found working combo for this model
          } catch (err) {
            results.push({ model, apiVer, httpStatus: 0, error: (err as Error).message });
          }
        }
      }
      return jsonResponse({ action: "test", currentModel: GEMINI_MODEL, results });
    }

    // Default health check
    let availableModels: string[] = [];
    if (apiKey) {
      try {
        const listRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=50`,
          { signal: AbortSignal.timeout(8000) }
        );
        if (listRes.ok) {
          const listData = await listRes.json();
          availableModels = (listData.models ?? [])
            .filter((m: { supportedGenerationMethods?: string[] }) =>
              m.supportedGenerationMethods?.includes("generateContent")
            )
            .map((m: { name: string }) => m.name.replace("models/", ""));
        }
      } catch { /* ignore */ }
    }
    return jsonResponse({
      status: "ok",
      function: "analyze-document",
      model: GEMINI_MODEL,
      geminiConfigured: Boolean(apiKey),
      availableModels,
      maxImageBytes: MAX_IMAGE_BYTES,
      acceptedMimeTypes: [...ACCEPTED_MIME_TYPES],
    });
  }

  if (req.method !== "POST") {
    return errorResponse("INVALID_INPUT", "Method not allowed", 405);
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return errorResponse("API_KEY_MISSING", "GEMINI_API_KEY is not configured", 500);
    }

    let body: { imageBase64?: string; mimeType?: string; language?: string };
    try {
      body = await req.json();
    } catch {
      return errorResponse("INVALID_INPUT", "Request body must be valid JSON");
    }

    const { imageBase64, mimeType, language = "en" } = body;

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return errorResponse("INVALID_INPUT", "imageBase64 is required");
    }
    if (!mimeType || typeof mimeType !== "string") {
      return errorResponse("INVALID_INPUT", "mimeType is required");
    }

    const normalizedMime = mimeType.toLowerCase();
    if (!ACCEPTED_MIME_TYPES.has(normalizedMime)) {
      return errorResponse(
        "UNSUPPORTED_MIME",
        `Unsupported image type: ${mimeType}. Accepted: JPEG, PNG, WebP, GIF, HEIC`
      );
    }

    // Check decoded image size
    const estimatedBytes = Math.floor((imageBase64.length * 3) / 4);
    if (estimatedBytes > MAX_IMAGE_BYTES) {
      return errorResponse(
        "IMAGE_TOO_LARGE",
        `Image too large (${(estimatedBytes / 1024 / 1024).toFixed(1)} MB). Maximum is 10 MB. Please compress or resize the image.`
      );
    }

    const today = new Date().toISOString().split("T")[0];
    const prompt = buildPrompt(language, today);

    const geminiResult = await callGemini(imageBase64, normalizedMime, prompt, GEMINI_API_KEY);

    if ("blocked" in geminiResult) {
      return errorResponse("GEMINI_BLOCKED", "Image was blocked by Gemini safety filters", 422);
    }

    if ("error" in geminiResult) {
      const isTimeout = geminiResult.error.includes("timed out");
      const code: ErrorCode = isTimeout ? "TIMEOUT" : "GEMINI_ERROR";
      return errorResponse(code, geminiResult.error, 502);
    }

    const parsed = safeParseJson(geminiResult.text);
    if (!parsed) {
      return errorResponse(
        "PARSE_ERROR",
        "Could not parse AI response as JSON",
        502
      );
    }

    const result = normalise(parsed);

    // Detect "no text" scenario after normalisation
    if (result.ocrText.length < 5 && !result.summary) {
      return errorResponse(
        "NO_TEXT",
        "No readable text found in image. Please use a clearer, well-lit photo.",
        422
      );
    }

    return jsonResponse(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected server error";
    return errorResponse("UNKNOWN", message, 500);
  }
});
