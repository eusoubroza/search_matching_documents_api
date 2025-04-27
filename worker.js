import { parentPort, workerData } from "worker_threads";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import * as dotenv from "dotenv";

dotenv.config();

// Supabase and OpenAI setup
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

(async () => {
  try {
    const { text } = workerData;

    // 1. Generate embedding
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: text,
    });
    const embedding = embeddingResponse.data[0].embedding;

    // 2. Classify user text (KAG step)
    const classificationResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `
You are an expert document query interpreter.

Extract fields:

{
  "company": (string | null),
  "year": (number | null),
  "employee_count_filter": (string | null),
  "income_filter": (string | null),
  "free_text": (string | null)
}

Rules:
- Return only JSON
- If missing, set null
- Numbers must be numeric
`
        },
        {
          role: "user",
          content: text,
        },
      ],
      temperature: 0,
    });

    const cleanedClassification = classificationResponse.choices[0].message.content
      .replace(/```json\n?/g, '')
      .replace(/```/g, '')
      .trim();
    const classified = JSON.parse(cleanedClassification);

    // 3. Fetch all documents
    const { data: documents, error: fetchError } = await supabase
      .from('teste2')
      .select('id, content, metadata');

    if (fetchError) throw fetchError;

    // 4. Smart filter using OpenAI reader
    let smartMatches = [];

    for (const doc of documents) {
      let match = true;

      const extracted = await extractStructuredDataFromDocument(doc.content);

      if (classified.company && extracted.company && !extracted.company.toLowerCase().includes(classified.company.toLowerCase())) match = false;
      if (classified.year && extracted.year && extracted.year !== classified.year) match = false;

      if (classified.employee_count_filter && extracted.number_of_employees !== null) {
        const condition = parseCondition(classified.employee_count_filter);
        if (!compareCondition(extracted.number_of_employees, condition.operator, condition.value)) match = false;
      }

      if (classified.income_filter && extracted.income !== null) {
        const condition = parseCondition(classified.income_filter);
        if (!compareCondition(extracted.income, condition.operator, condition.value)) match = false;
      }

      if (match) {
        smartMatches.push(doc);
      }
    }

    // 5. Semantic vector search if needed
    let vectorMatches = [];
    if (smartMatches.length === 0) {
      const { data: vectors, error: vectorError } = await supabase.rpc("match_documents_api", {
        query_embedding: embedding,
        match_threshold: 0.4,
        match_count: 5,
      });

      if (vectorError) throw vectorError;
      vectorMatches = vectors || [];
    }

    // 6. Best match logic
    const bestMatch = smartMatches.length > 0 ? smartMatches.slice(0, 2) : vectorMatches.slice(0, 2);

    parentPort.postMessage({
      text,
      classification: classified,
      matches: bestMatch,
    });

  } catch (err) {
    parentPort.postMessage({ error: err.message });
  }
})();

// Helper Functions

async function extractStructuredDataFromDocument(content) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `
You are an intelligent document reader.

Extract the following fields from the document text:

{
  "company": (string | null),
  "year": (number | null),
  "number_of_employees": (number | null),
  "income": (number | null)
}

Rules:
- If a field is not found, return null.
- Return only valid JSON.
- No explanations.
- Numbers must be numeric (no "$" or commas).
`
      },
      {
        role: "user",
        content: content,
      },
    ],
    temperature: 0,
  });

  const cleaned = response.choices[0].message.content
    .replace(/```json\n?/g, '')
    .replace(/```/g, '')
    .trim();

  return JSON.parse(cleaned);
}

function parseCondition(conditionStr) {
  const operator = conditionStr.startsWith(">=") ? ">=" :
                   conditionStr.startsWith("<=") ? "<=" :
                   conditionStr.startsWith(">") ? ">" :
                   conditionStr.startsWith("<") ? "<" : null;
  const value = parseFloat(conditionStr.replace(/[^\d.]/g, ''));
  return { operator, value };
}

function compareCondition(value, operator, target) {
  switch (operator) {
    case ">=": return value >= target;
    case "<=": return value <= target;
    case ">": return value > target;
    case "<": return value < target;
    default: return false;
  }
}
