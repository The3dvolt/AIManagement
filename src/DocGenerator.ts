import { tools, getStoredManual, storeManual } from "../tools";

// Simulating schema.ts content based on tools.ts initDB
const DB_SCHEMA = `
Tables:
1. call_logs (id, contact_name, duration, notes, timestamp)
2. family_budget (category, amount)
3. business_budget (category, amount)
4. knowledge_base (id, content, source, type, timestamp)
`;

export async function generateUserManual(engine: any): Promise<string> {
    // 1. Check persistence
    const existing = getStoredManual();
    if (existing) {
        console.log("Returning cached manual.");
        return existing;
    }

    // 2. Construct Prompt
    const toolDescriptions = tools.map((t: any) => 
        `- ${t.function.name}: ${t.function.description} (Params: ${JSON.stringify(t.function.parameters)})`
    ).join("\n");

    const systemPrompt = `You are a technical writer. Create a professional HTML User Manual for "AI Management by 3dvolt". 
    
    Here is the technical data:
    
    TOOLS AVAILABLE:
    ${toolDescriptions}
    
    DATABASE SCHEMA:
    ${DB_SCHEMA}
    
    INSTRUCTIONS:
    For each function/tool, provide:
    1. A clear "How-to".
    2. A "Real-life Business Example" (e.g., chasing a late invoice).
    3. A "Family Example" (e.g., alerting when milk is low).
    
    Use Tailwind CSS classes for styling within the HTML string. 
    Return ONLY the HTML code, starting with <!DOCTYPE html> or <div>. Do not include markdown backticks.`;

    // 3. Generate
    const response = await engine.chat.completions.create({
        messages: [{ role: "system", content: systemPrompt }],
        temperature: 0.7
    });

    const html = response.choices[0].message.content || "<h1>Error generating manual</h1>";
    
    // Clean up markdown code blocks if present
    const cleanHtml = html.replace(/```html/g, '').replace(/```/g, '');

    // 4. Persist
    storeManual(cleanHtml);

    return cleanHtml;
}