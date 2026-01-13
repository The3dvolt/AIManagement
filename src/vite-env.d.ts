/// <reference types="vite/client" />

// Suppress missing type errors for libraries without @types packages installed
declare module 'sql.js';
declare module 'papaparse';
declare module 'pdfjs-dist';

// Fix for missing types in Vercel build
declare module '@mlc-ai/web-llm';

interface Navigator {
    gpu: any;
}