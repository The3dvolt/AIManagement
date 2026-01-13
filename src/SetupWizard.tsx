import React, { useState, useEffect } from 'react';
import { CreateWebWorkerMLCEngine } from "@mlc-ai/web-llm";
import { initDB } from './tools';
import { PRIVACY_COMMITMENT } from './privacy';
import { EmailService } from './EmailService';

// Constants matching main.ts
const MODEL_TOOLS = "gemma-2b-it-q4f32_1-MLC";
const MODEL_CHAT = "gemma-2b-it-q4f32_1-MLC";

interface SetupWizardProps {
    onComplete: () => void;
}

export const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete }) => {
    const [step, setStep] = useState(1);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<string>("");
    const [downloadPercent, setDownloadPercent] = useState(0);
    
    // User Data for Signup Flow
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [isPro, setIsPro] = useState(false);
    const [isFinalizing, setIsFinalizing] = useState(false);

    useEffect(() => {
        runStep(step);
    }, [step]);

    const runStep = async (currentStep: number) => {
        try {
            if (currentStep === 1) {
                // Step 1: Hardware Check
                if (!navigator.gpu) {
                    setError("Compatibility Error: WebGPU is not supported on this device. This local AI requires hardware acceleration.");
                    return;
                }
                setTimeout(() => setStep(2), 1000);
            } 
            else if (currentStep === 2) {
                // Step 2: Database Init
                setProgress("Initializing Encrypted Database...");
                await initDB();
                setTimeout(() => setStep(3), 1000);
            } 
            else if (currentStep === 3) {
                // Step 3: Model Download
                await downloadModels();
                setStep(4);
            }
        } catch (e: any) {
            setError(e.message || "An unexpected error occurred.");
        }
    };

    const downloadModels = async () => {
        const workerUrl = new URL('./worker.ts', import.meta.url).href;
        
        // Download Chat Model (Gemma-2B)
        setProgress("Downloading Chat Model (Gemma-2B)...");
        await CreateWebWorkerMLCEngine(
            new Worker(workerUrl, { type: 'module' }),
            MODEL_CHAT,
            {
                initProgressCallback: (report: any) => {
                    setDownloadPercent(Math.round(report.progress * 100));
                    setProgress(`Downloading Chat Model: ${report.text}`);
                }
            }
        );

        // Download Tools Model (FunctionGemma proxy)
        setDownloadPercent(0);
        setProgress("Downloading Function Model (FunctionGemma-270M)...");
        await CreateWebWorkerMLCEngine(
            new Worker(workerUrl, { type: 'module' }),
            MODEL_TOOLS,
            {
                initProgressCallback: (report: any) => {
                    setDownloadPercent(Math.round(report.progress * 100));
                    setProgress(`Downloading Function Model: ${report.text}`);
                }
            }
        );
    };

    const handleFinish = async () => {
        setIsFinalizing(true);
        try {
            if (email && name) {
                setProgress("Sending Welcome Email...");
                await EmailService.sendWelcome(email, name, isPro);
            }
        } catch (e) {
            console.error("Failed to send welcome email:", e);
            // Proceed even if email fails (e.g. invalid API key in dev)
        }
        onComplete();
    };

    if (error) {
        return (
            <div style={{ padding: '2rem', color: 'red', textAlign: 'center' }}>
                <h2>Setup Failed</h2>
                <p>{error}</p>
            </div>
        );
    }

    return (
        <div style={{ 
            fontFamily: 'sans-serif', 
            maxWidth: '600px', 
            margin: '2rem auto', 
            padding: '2rem', 
            border: '1px solid #ccc', 
            borderRadius: '8px',
            backgroundColor: '#f9f9f9'
        }}>
            <h1 style={{ textAlign: 'center' }}>AI Management by 3dvolt</h1>
            
            <div style={{ margin: '2rem 0' }}>
                <h3>Setup Wizard - Step {step} of 4</h3>
                
                {step === 1 && <p>Checking Hardware Compatibility...</p>}
                
                {step === 2 && <p>Initializing Local Database...</p>}
                
                {step === 3 && (
                    <div>
                        <p>{progress}</p>
                        <div style={{ width: '100%', backgroundColor: '#ddd', height: '20px', borderRadius: '4px' }}>
                            <div style={{ 
                                width: `${downloadPercent}%`, 
                                backgroundColor: '#4caf50', 
                                height: '100%', 
                                borderRadius: '4px',
                                transition: 'width 0.3s ease'
                            }}></div>
                        </div>
                    </div>
                )}

                {step === 4 && (
                    <div style={{ textAlign: 'center' }}>
                        <h2 style={{ color: '#4caf50' }}>Setup Complete!</h2>
                        <p>Your local AI environment is ready.</p>
                        
                        <div style={{ textAlign: 'left', margin: '20px 0', padding: '15px', backgroundColor: '#fff', border: '1px solid #eee', borderRadius: '8px' }}>
                            <h4 style={{ marginTop: 0 }}>Finalize Account</h4>
                            <label style={{ display: 'block', marginBottom: '10px' }}>
                                Name:
                                <input 
                                    type="text" 
                                    value={name} 
                                    onChange={(e) => setName(e.target.value)}
                                    style={{ width: '100%', padding: '8px', marginTop: '5px', boxSizing: 'border-box' }}
                                    placeholder="Enter your name"
                                />
                            </label>
                            <label style={{ display: 'block', marginBottom: '10px' }}>
                                Email:
                                <input 
                                    type="email" 
                                    value={email} 
                                    onChange={(e) => setEmail(e.target.value)}
                                    style={{ width: '100%', padding: '8px', marginTop: '5px', boxSizing: 'border-box' }}
                                    placeholder="Enter your email"
                                />
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                <input 
                                    type="checkbox" 
                                    checked={isPro} 
                                    onChange={(e) => setIsPro(e.target.checked)}
                                />
                                <span>Enable Pro Features (Demo)</span>
                            </label>
                        </div>

                        <button 
                            onClick={handleFinish}
                            disabled={isFinalizing}
                            style={{
                                padding: '10px 20px',
                                fontSize: '16px',
                                cursor: 'pointer',
                                backgroundColor: '#000',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                opacity: isFinalizing ? 0.7 : 1
                            }}
                        >
                            {isFinalizing ? 'Finalizing...' : 'Launch App'}
                        </button>
                    </div>
                )}
            </div>

            <hr />
            <footer style={{ fontSize: '0.8rem', color: '#666', marginTop: '1rem' }}>
                <strong>Privacy Pledge:</strong>
                <p style={{ whiteSpace: 'pre-wrap' }}>{PRIVACY_COMMITMENT}</p>
            </footer>
        </div>
    );
};