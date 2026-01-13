import initSqlJs, { Database } from 'sql.js';
import Papa from 'papaparse';
import * as pdfjsLib from 'pdfjs-dist';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

let db: Database | null = null;
let dbReadyPromise: Promise<void> | null = null;

// Local Tools
export const tools = [
    {
      "type": "function",
      "function": {
        "name": "compose_email",
        "description": "Compose and send an email.",
        "parameters": {
          "type": "object",
          "properties": {
            "to": {
              "type": "string",
              "description": "The recipient's email address."
            },
            "subject": {
              "type": "string",
              "description": "The subject of the email."
            },
            "body": {
              "type": "string",
              "description": "The body of the email."
            }
          },
          "required": ["to", "subject", "body"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "log_call",
        "description": "Log a phone call.",
        "parameters": {
          "type": "object",
          "properties": {
            "contact_name": {
              "type": "string",
              "description": "The name of the contact."
            },
            "duration": {
              "type": "string",
              "description": "The duration of the call."
            },
            "notes": {
              "type": "string",
              "description": "Notes about the call."
            }
          },
          "required": ["contact_name", "duration", "notes"]
        }
      }
    },
    {
        "type": "function",
        "function": {
            "name": "update_budget",
            "description": "Update the budget for a specific category in either the Family or Business budget.",
            "parameters": {
                "type": "object",
                "properties": {
                    "budgetType": {
                        "type": "string",
                        "enum": ["Family", "Business"],
                        "description": "The type of budget to update."
                    },
                    "category": {
                        "type": "string",
                        "description": "The budget category to update."
                    },
                    "amount": {
                        "type": "number",
                        "description": "The amount to add or remove."
                    },
                    "operation": {
                        "type": "string",
                        "enum": ["add", "remove"],
                        "description": "Whether to add to or remove from the current amount."
                    }
                },
                "required": ["budgetType", "category", "amount", "operation"]
            }
        }
    }
  ];

export async function initDB() {
    if (dbReadyPromise) return dbReadyPromise;

    dbReadyPromise = (async () => {
        const SQL = await initSqlJs({
            locateFile: file => `https://sql.js.org/dist/${file}`
        });
        db = new SQL.Database();
        // Create tables
        db.run("CREATE TABLE IF NOT EXISTS call_logs (id INTEGER PRIMARY KEY, contact_name TEXT, duration TEXT, notes TEXT, timestamp TEXT);");
        db.run("CREATE TABLE IF NOT EXISTS family_budget (category TEXT PRIMARY KEY, amount REAL);");
        db.run("CREATE TABLE IF NOT EXISTS business_budget (category TEXT PRIMARY KEY, amount REAL);");
        // RAG Table
        db.run("CREATE TABLE IF NOT EXISTS knowledge_base (id INTEGER PRIMARY KEY, content TEXT, source TEXT, type TEXT, timestamp TEXT);");
        console.log("SQLite DB Initialized");
    })();
    return dbReadyPromise;
}

// --- RAG & File Handling ---

async function storeInOPFS(filename: string, data: ArrayBuffer | string) {
    try {
        const root = await navigator.storage.getDirectory();
        const fileHandle = await root.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(data);
        await writable.close();
        console.log(`Stored ${filename} in OPFS`);
    } catch (e) {
        console.error("OPFS Error:", e);
    }
}

export async function processUpload(file: File) {
    await initDB();
    const arrayBuffer = await file.arrayBuffer();
    
    // 1. Store raw file in OPFS
    await storeInOPFS(file.name, arrayBuffer);

    let textContent = "";

    // 2. Parse Content
    if (file.type === "application/pdf") {
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContentItem = await page.getTextContent();
            const strings = textContentItem.items.map((item: any) => item.str);
            textContent += strings.join(" ") + "\n";
        }
    } else if (file.type === "text/csv" || file.name.endsWith('.csv')) {
        const text = new TextDecoder().decode(arrayBuffer);
        const result = Papa.parse(text, { header: true });
        textContent = JSON.stringify(result.data);
    } else {
        // Fallback for text files
        textContent = new TextDecoder().decode(arrayBuffer);
    }

    // 3. Store in SQLite Knowledge Base
    if (db && textContent.trim()) {
        const stmt = db.prepare("INSERT INTO knowledge_base (content, source, type, timestamp) VALUES (?, ?, ?, ?)");
        stmt.run([textContent, file.name, file.type, new Date().toISOString()]);
        stmt.free();
        return { success: true, message: `Processed ${file.name} into Knowledge Base.` };
    }
    return { success: false, message: "Failed to process file." };
}

export function queryKnowledgeBase(query: string): string {
    if (!db) return "";
    // Simple keyword matching (FTS-lite)
    // In a production app, you might use a vector store or SQLite FTS5 extension
    const keywords = query.split(" ").filter(w => w.length > 3);
    if (keywords.length === 0) return "";

    const likeClauses = keywords.map(() => "content LIKE ?").join(" OR ");
    const params = keywords.map(k => `%${k}%`);
    
    const stmt = db.prepare(`SELECT content, source FROM knowledge_base WHERE ${likeClauses} LIMIT 3`);
    stmt.bind(params);
    
    let context = "";
    while (stmt.step()) {
        const row = stmt.getAsObject();
        context += `[Source: ${row.source}]\n${String(row.content).substring(0, 500)}...\n\n`;
    }
    stmt.free();
    return context;
}

// --- Existing Tools Implementation ---

export function compose_email(to: string, subject: string, body: string) {
    console.log("Composing email to:", to);
    const mailtoLink = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink, '_blank');
    return { success: true, message: `Email to ${to} composed.` };
}

export function log_call(contact_name: string, duration: string, notes: string) {
    if (!db) return { success: false, message: "DB not ready" };
    const stmt = db.prepare("INSERT INTO call_logs (contact_name, duration, notes, timestamp) VALUES (?, ?, ?, ?)");
    stmt.run([contact_name, duration, notes, new Date().toISOString()]);
    stmt.free();
    return { success: true, message: `Logged call with ${contact_name}` };
}

export function update_budget(budgetType: 'Family' | 'Business', category: string, amount: number, operation: 'add' | 'remove') {
    if (!db) return { success: false, message: "DB not ready" };
    const budgetTable = budgetType === 'Family' ? 'family_budget' : 'business_budget';
    
    // 1. Read current amount
    const readStmt = db.prepare(`SELECT amount FROM ${budgetTable} WHERE category = ?`);
    readStmt.bind([category]);
    let currentAmount = 0;
    if (readStmt.step()) {
        const result = readStmt.get();
        currentAmount = result[0] as number;
    }
    readStmt.free();

    // 2. Calculate new amount
    const newAmount = operation === 'add' ? currentAmount + amount : currentAmount - amount;

    // 3. Upsert new amount
    const writeStmt = db.prepare(`INSERT OR REPLACE INTO ${budgetTable} (category, amount) VALUES (?, ?)`);
    writeStmt.run([category, newAmount]);
    writeStmt.free();
    return { success: true, message: `Updated ${budgetType} budget for ${category} to ${newAmount}.` };
}
