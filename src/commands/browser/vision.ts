import type { Command, CommandGenerator } from '../../types';
import { loadConfig, loadEnv } from '../../config';
import { readFileSync, existsSync } from 'node:fs';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { extname } from 'node:path';

interface VisionCommandOptions {
    prompt?: string;
    model?: string;
    saveTo?: string;
    debug?: boolean;
    context?: string;
}

const DEFAULT_PROMPT = `You are a visual QA assistant. Analyze the provided screenshot and identify any visual issues or anomalies, including:

* Layout problems: overlapping elements, incorrect spacing, alignment issues, responsiveness problems
* Text issues: misspellings, grammar errors, inconsistent capitalization, truncation
* Color inconsistencies: clashing colors, incorrect brand colors, low contrast
* Image quality: blurry images, incorrect aspect ratios, missing images
* UI element inconsistencies: buttons, forms, icons that are not consistent with the overall design
* Accessibility issues: missing alt text, poor color contrast
* Missing content: empty sections, placeholder text
* General aesthetic problems: anything that looks unprofessional or unpolished

Be concise and specific. Provide details about the location and nature of each issue.
If there are no issues in a particular category, you don't need to mention that category.
If everything looks correct, say so briefly.

IMPORTANT: If context files are provided, use them to understand design decisions.
For example, if HTML comments explain that certain elements are deliberately sized
or styled in a particular way, take that into account in your analysis.`;

const SUPPORTED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const SUPPORTED_CONTEXT_EXTENSIONS = new Set(['.html', '.css', '.js', '.txt', '.json']);

export class VisionCommand implements Command {
    private config = loadConfig();

    constructor() {
        loadEnv(); // Ensure environment variables are loaded
    }

    private getMimeType(filePath: string): string {
        const ext = extname(filePath).toLowerCase();
        switch (ext) {
            case '.png':
                return 'image/png';
            case '.jpg':
            case '.jpeg':
                return 'image/jpeg';
            case '.webp':
                return 'image/webp';
            default:
                throw new Error(`Unsupported image format: ${ext}. Supported formats are: ${Array.from(SUPPORTED_EXTENSIONS).join(', ')}`);
        }
    }

    async *execute(imagePath: string, options?: VisionCommandOptions): CommandGenerator {
        if (!imagePath) {
            yield "Error: Please provide the path to the image file.";
            return;
        }

        if (!existsSync(imagePath)) {
            yield `Error: Image file not found: ${imagePath}`;
            return;
        }

        if (!process.env.GEMINI_API_KEY) {
            yield "Error: GEMINI_API_KEY environment variable is not set. Please set it in your .cursor-tools.env file.";
            return;
        }

        try {
            const mimeType = this.getMimeType(imagePath);
            const file = readFileSync(imagePath);
            const base64Image = file.toString('base64');

            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            const modelName = options?.model || this.config.gemini?.model || 'gemini-pro-vision';
            const model = genAI.getGenerativeModel({ model: modelName });

            const prompt = options?.prompt || DEFAULT_PROMPT;

            const request = {
                contents: [
                    {
                        parts: [
                            { text: prompt },
                            {
                                inlineData: {
                                    mimeType,
                                    data: base64Image,
                                },
                            },
                        ],
                    },
                ],
            };

            // Add context files to the request
            if (options?.context) {
                const contextFiles = options.context.split(','); // Split multiple files
                for (const contextFileString of contextFiles) {
                    const [typeHint, contextFilePath] = contextFileString.split(':');
                    const actualPath = contextFilePath || contextFileString; // Support both formats

                    if (!existsSync(actualPath)) {
                        yield `Warning: Context file not found: ${actualPath}. Skipping.\n`;
                        continue;
                    }

                    const contextExt = extname(actualPath).toLowerCase();
                    if (!SUPPORTED_CONTEXT_EXTENSIONS.has(contextExt)) {
                        yield `Warning: Unsupported context file type: ${contextExt}. Skipping.\n`;
                        continue;
                    }

                    try {
                        const contextContent = readFileSync(actualPath, 'utf-8');
                        // Add the context file as a text part to the request
                        request.contents[0].parts.push({
                            text: `\n\n--- Context from ${actualPath} (${typeHint || contextExt.slice(1)}) ---\n\n${contextContent}`,
                        });
                        if (options?.debug) {
                            yield `Debug: Added context from ${actualPath}\n`;
                        }
                    } catch (readError) {
                        yield `Error reading context file ${actualPath}: ${readError instanceof Error ? readError.message : 'Unknown error'}\n`;
                    }
                }
            }

            yield "Analyzing image...";

            // Use streaming for better user experience
            const result = await model.generateContentStream(request);
            
            if (options?.debug) {
                yield "\nDebug: Request sent to Gemini API";
                yield `Debug: Using model ${modelName}`;
                yield `Debug: Image size: ${file.length} bytes`;
                yield "Debug: Starting response stream\n";
            }

            let fullResponse = '';
            for await (const chunk of result.stream) {
                const chunkText = chunk.text();
                fullResponse += chunkText;
                yield chunkText;
            }

            // Save to file if requested
            if (options?.saveTo) {
                try {
                    const fs = await import('node:fs/promises');
                    await fs.writeFile(options.saveTo, fullResponse);
                    yield `\nAnalysis saved to ${options.saveTo}`;
                } catch (error) {
                    yield `\nError saving to file: ${error instanceof Error ? error.message : 'Unknown error'}`;
                }
            }

        } catch (error) {
            if (error instanceof Error) {
                if (error.message.includes('PERMISSION_DENIED')) {
                    yield "Error: Invalid or expired Gemini API key. Please check your GEMINI_API_KEY in .cursor-tools.env";
                } else if (error.message.includes('RESOURCE_EXHAUSTED')) {
                    yield "Error: Gemini API quota exceeded. Please try again later.";
                } else if (error.message.includes('INVALID_ARGUMENT')) {
                    yield "Error: Invalid request to Gemini API. This might be due to an unsupported image format or size.";
                } else {
                    yield `Error: ${error.message}`;
                }
            } else {
                yield "Error: An unknown error occurred while analyzing the image.";
            }
        }
    }
} 