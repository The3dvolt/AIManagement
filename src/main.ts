
import { CreateWebWorkerMLCEngine, MLCEngine } from "@mlc-ai/web-llm";
import React from 'react';
import { createRoot } from 'react-dom/client';
import { SetupWizard } from './SetupWizard';
import { generateUserManual } from "./DocGenerator";
import { ManualViewer } from "./ManualViewer";
import { tools, compose_email, log_call, update_budget, initDB, processUpload, queryKnowledgeBase } from "./tools";
import { PRIVACY_COMMITMENT } from "./privacy";
import MLCEngineWorker from './worker.ts?worker';

const MODEL_TOOLS = "gemma-2b-it-q4f32_1-MLC";
const MODEL_CHAT = "gemma-2b-it-q4f32_1-MLC";
// NOTE: "Gemma 3" vision models are not yet available in WebLLM.
const MODEL_VISION = "gemma-2b-it-q4f16_1-MLC";

// Update App Title
document.title = "AI Management by 3dvolt";

const appInitialized = localStorage.getItem('app_initialized');

if (!appInitialized) {
    const rootElement = document.getElementById('app')!;
    // Clear existing HTML content for the wizard
    rootElement.innerHTML = ''; 
    const root = createRoot(rootElement);
    
    root.render(React.createElement(SetupWizard, {
        onComplete: () => {
            localStorage.setItem('app_initialized', 'true');
            window.location.reload();
        }
    }));
} else {
    startApp();
}

async function startApp() {
    // Add Exit Button
    const exitButton = document.createElement("button");
    exitButton.textContent = "Exit";
    exitButton.style.position = "fixed";
    exitButton.style.top = "10px";
    exitButton.style.right = "10px";
    exitButton.style.zIndex = "2000";
    exitButton.style.padding = "8px 12px";
    exitButton.style.backgroundColor = "#d9534f";
    exitButton.style.color = "white";
    exitButton.style.border = "none";
    exitButton.style.borderRadius = "4px";
    exitButton.style.cursor = "pointer";
    exitButton.onclick = () => {
        if (confirm("Exit application? This will clear your session.")) {
            localStorage.removeItem('app_initialized');
            window.location.reload();
        }
    };
    document.body.appendChild(exitButton);

// Engine 1: Tools & Function Calling
const toolEngine = await CreateWebWorkerMLCEngine(
    new MLCEngineWorker(),
    MODEL_TOOLS,
    {
        initProgressCallback: (progress: any) => {
            console.log("Tool Engine Init:", progress);
        }
    }
);

// Engine 2: Chat & RAG
const chatEngine = await CreateWebWorkerMLCEngine(
    new MLCEngineWorker(),
    MODEL_CHAT,
    {
        initProgressCallback: (progress: any) => {
            console.log("Chat Engine Init:", progress);
        }
    }
);

// Engine 3: Vision
const visionEngine = await CreateWebWorkerMLCEngine(
    new MLCEngineWorker(),
    MODEL_VISION,
    {
        initProgressCallback: (progress: any) => {
            console.log("Vision Engine Init:", progress);
        }
    }
);

await initDB();

// --- DOM Elements ---
const localDevLog = document.getElementById("log-output")!;
const chatOutput = document.getElementById("chat-output")!;
const modeSelect = document.getElementById("mode-select") as HTMLSelectElement;
const fileInput = document.getElementById("file-upload") as HTMLInputElement;
const videoFeed = document.getElementById("video-feed") as HTMLVideoElement;
const ipCameraFeed = document.getElementById("ip-camera-feed") as HTMLImageElement;
const canvasCapture = document.getElementById("canvas-capture") as HTMLCanvasElement;
const startCameraButton = document.getElementById("start-camera-button")!;
const useIpCameraButton = document.getElementById("use-ip-camera-button")!;
const ipCameraUrlInput = document.getElementById("ip-camera-url") as HTMLInputElement;
const manualButton = document.getElementById("manual-button");

// --- State ---
let videoStream: MediaStream | null = null;
let visionSource: 'local' | 'ip' | null = null;

function appendMessage(sender: string, message: string, style: 'user' | 'ai' | 'system' | 'vision') {
    const msgDiv = document.createElement("div");
    msgDiv.innerHTML = `<strong>${sender}:</strong> `;
    const contentSpan = document.createElement("span");
    contentSpan.textContent = message;
    msgDiv.appendChild(contentSpan);
    chatOutput.appendChild(msgDiv);
    chatOutput.scrollTop = chatOutput.scrollHeight;
}

// Display Privacy Commitment on startup
appendMessage("System", "Welcome to AI Management by 3dvolt.", "system");
appendMessage("System", PRIVACY_COMMITMENT, "system");

// Manual Generation Handler
if (manualButton) {
    manualButton.addEventListener("click", async () => {
        appendMessage("System", "Generating User Manual... This may take a moment.", "system");
        try {
            const html = await generateUserManual(chatEngine);
            const manualRoot = document.getElementById("manual-root");
            if (manualRoot) {
                const root = createRoot(manualRoot);
                root.render(React.createElement(ManualViewer, {
                    htmlContent: html,
                    onClose: () => root.unmount()
                }));
            }
        } catch (e: any) {
            appendMessage("System", "Error generating manual: " + e.message, "system");
        }
    });
}

// File Upload Handler
fileInput.addEventListener("change", async (e) => {
    const files = (e.target as HTMLInputElement).files;
    if (files && files.length > 0) {
        localDevLog.textContent = "Processing file...";
        const result = await processUpload(files[0]);
        localDevLog.textContent = JSON.stringify(result, null, 2);
    }
});

// Vision: Start Local Camera
startCameraButton.addEventListener("click", async () => {
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
    }
    ipCameraFeed.style.display = 'none';
    ipCameraFeed.src = '';

    try {
        videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoFeed.srcObject = videoStream;
        videoFeed.style.display = 'block';
        videoFeed.play();
        visionSource = 'local';
    } catch (err) {
        console.error("Camera access denied:", err);
        appendMessage("System", "Could not access the camera. Please check permissions.", "system");
    }
});

// Vision: Use IP Camera
useIpCameraButton.addEventListener("click", () => {
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoFeed.style.display = 'none';
    }
    const url = ipCameraUrlInput.value;
    if (url) {
        // This method works for MJPEG streams, which are common on local IP cameras.
        // RTSP/WebRTC streams are more complex and not supported here.
        ipCameraFeed.src = url;
        ipCameraFeed.style.display = 'block';
        visionSource = 'ip';
    } else {
        appendMessage("System", "Please enter an IP Camera URL.", "system");
    }
});

async function handleVisionPrompt(prompt: string) {
    let sourceElement: HTMLVideoElement | HTMLImageElement | null = null;
    if (visionSource === 'local') sourceElement = videoFeed;
    if (visionSource === 'ip') sourceElement = ipCameraFeed;

    if (!sourceElement) {
        appendMessage("System", "No active vision source.", "system");
        return;
    }

    appendMessage("User", prompt, "user");
    appendMessage("Vision", "Analyzing image...", "vision");

    const ctx = canvasCapture.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(sourceElement, 0, 0, canvasCapture.width, canvasCapture.height);
    const imageDataUrl = canvasCapture.toDataURL('image/jpeg');

    const messages = [{
        "role": "user",
        "content": [
            { "type": "text", "text": prompt },
            { "type": "image_url", "image_url": { "url": imageDataUrl } }
        ]
    }];

    const visionResult = await visionEngine.chat.completions.create({
        messages: messages as any,
        temperature: 0.5,
    });

    const reply = visionResult.choices[0].message.content;
    if (reply) {
        appendMessage(`AI (Vision)`, reply, "ai");
    }
}

document.getElementById("submit-button")?.addEventListener("click", async () => {
    const promptInput = document.getElementById("prompt-input") as HTMLInputElement;
    const prompt = promptInput.value;
    const mode = modeSelect.value;

    if (prompt) {
        // If a vision source is active, use the vision engine
        if (visionSource) {
            await handleVisionPrompt(prompt);
            promptInput.value = ""; // Clear input after processing
            return;
        }

        // --- Standard Chat/Tool Logic ---
        appendMessage("User", prompt, "user");
        promptInput.value = "";

        // 1. RAG Retrieval
        const context = queryKnowledgeBase(prompt);
        
        // 2. Construct System Prompt based on Mode
        let systemPrompt = "";
        if (mode === "family") {
            systemPrompt = "You are a warm, casual family assistant. Use emojis. ";
        } else {
            systemPrompt = "You are a professional, concise business assistant. Be formal. ";
        }

        if (context) {
            systemPrompt += `\nUse the following context from the knowledge base to answer:\n${context}`;
        }

        // 3. Chat with Chat Engine (Session 2)
        const messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt }
        ];

        const chatCompletion = await chatEngine.chat.completions.create({
            messages: messages as any,
            temperature: 0.7,
        });

        const reply = chatCompletion.choices[0].message.content;
        if (reply) {
            appendMessage(`AI (${mode})`, reply, "ai");
        }
        // 4. Check for Tool Intent (Optional: Run parallel check with Tool Engine)
        // For this demo, we run tool check independently to show functionality
        const toolResult = await toolEngine.chat.completions.create({
            tools: tools,
            tool_choice: "auto",
            messages: [{
                "role": "user",
                "content": prompt
            }],
            temperature: 0,
        });

        const response = toolResult.choices[0];
        localDevLog.textContent = "Tool Engine Raw:\n" + JSON.stringify(response, null, 2);

        if (response.message.tool_calls) {
            for (const tool_call of response.message.tool_calls) {
                const args = JSON.parse(tool_call.function.arguments);
                let result;
                switch (tool_call.function.name) {
                    case "compose_email":
                        result = compose_email(args.to, args.subject, args.body);
                        break;
                    case "log_call":
                        result = log_call(args.contact_name, args.duration, args.notes);
                        break;
                    case "update_budget":
                        result = update_budget(args.budgetType, args.category, args.amount, args.operation);
                        break;
                }
                if(result) {
                    appendMessage("System", `Tool Executed: ${tool_call.function.name}. Details: ${result.message}`, "system");
                }
            }
        }
    }
});

// Add Enter key support
const promptInput = document.getElementById("prompt-input");
if (promptInput) {
    promptInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            document.getElementById("submit-button")?.click();
        }
    });
}
}
