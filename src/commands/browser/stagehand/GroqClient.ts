import { GroqClient as BrowserbaseGroqClient } from 'groq-stagehand-client';

export const GroqClient = BrowserbaseGroqClient;

// import type { AvailableModel, CreateChatCompletionOptions, LLMResponse, LogLine } from '@browserbasehq/stagehand';
// import Groq from 'groq-sdk';
// import { zodToJsonSchema } from 'zod-to-json-schema';
// import { LLMClient } from '@browserbasehq/stagehand';
// // import type { LLMCache } from '@browserbasehq/stagehand/lib/cache/LLMCache';
// type LLMCache = {
//     get<T>(options: Record<string, unknown>, key: string): Promise<T>;
//     set<T>(options: Record<string, unknown>, value: T, key: string): Promise<void>;
// };

// export interface GroqClientOptions {
//   apiKey?: string;
//   baseURL?: string;
//   maxRetries?: number;
//   timeout?: number;
// }

// // Groq API has specific parameter limitations
// const MIN_TEMPERATURE = 1e-8; // Minimum allowed temperature value

// // List of unsupported OpenAI parameters that should be filtered out
// const UNSUPPORTED_OPENAI_PARAMS = new Set(['logprobs', 'logit_bias', 'top_logprobs']);

// // Model-specific token limits (context window sizes)
// const MODEL_TOKEN_LIMITS: Record<string, number> = {
//   // Production Models
//   'llama3-70b-8192': 8192,
//   'mixtral-8x7b-32768': 32768,
//   'gemma-7b-it': 8192, // Using conservative limit
//   'llama-3.3-70b-versatile': 128000,
//   'llama-3.1-8b-instant': 128000,
//   'llama-guard-3-8b': 8192,
//   'llama3-8b-8192': 8192,
//   'gemma2-9b-it': 8192,
//   // Preview Models
//   'deepseek-r1-distill-llama-70b': 128000,
//   'llama-3.3-70b-specdec': 8192,
//   'llama-3.2-1b-preview': 128000,
//   'llama-3.2-3b-preview': 128000,
//   'llama-3.2-11b-vision-preview': 128000,
//   'llama-3.2-90b-vision-preview': 128000,
// };

// // Maximum output tokens per model (if different from context window)
// const MODEL_MAX_OUTPUT_TOKENS: Record<string, number> = {
//   'llama-3.3-70b-versatile': 32768,
//   'llama-3.1-8b-instant': 8192,
//   'llama-3.2-1b-preview': 8192,
//   'llama-3.2-3b-preview': 8192,
//   'llama-3.2-11b-vision-preview': 8192,
//   'llama-3.2-90b-vision-preview': 8192,
// };

// // Groq API response types
// export interface GroqMessage {
//   role: 'assistant' | 'system' | 'user' | 'tool';
//   content: string | null;
//   tool_calls?: Array<GroqToolCall>;
// }

// export interface GroqToolCall {
//   id: string;
//   type: 'function';
//   function: {
//     name: string;
//     arguments: string;
//   };
// }

// export interface GroqCompletion {
//   id: string;
//   object: 'chat.completion';
//   created: number;
//   model: string;
//   choices: Array<{
//     index: number;
//     message: GroqMessage;
//     finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
//   }>;
//   usage: {
//     prompt_tokens: number;
//     completion_tokens: number;
//     total_tokens: number;
//   };
// }

// // Groq-specific error classes
// export class GroqError extends Error {
//   constructor(message: string) {
//     super(message);
//     this.name = 'GroqError';
//   }
// }

// export class GroqAPIError extends GroqError {
//   status: number;
//   code: string;
//   param: string | null;

//   constructor(message: string, status: number, code: string, param: string | null = null) {
//     super(message);
//     this.name = 'GroqAPIError';
//     this.status = status;
//     this.code = code;
//     this.param = param;
//   }
// }

// export class GroqAuthenticationError extends GroqAPIError {
//   constructor(message: string) {
//     super(message, 401, 'invalid_api_key');
//     this.name = 'GroqAuthenticationError';
//   }
// }

// export class GroqRateLimitError extends GroqAPIError {
//   constructor(message: string) {
//     super(message, 429, 'rate_limit_exceeded');
//     this.name = 'GroqRateLimitError';
//   }
// }

// export class GroqTimeoutError extends GroqError {
//   constructor(message: string = 'Request timed out') {
//     super(message);
//     this.name = 'GroqTimeoutError';
//   }
// }

// export class GroqConnectionError extends GroqError {
//   constructor(message: string = 'Failed to connect to Groq API') {
//     super(message);
//     this.name = 'GroqConnectionError';
//   }
// }

// export class GroqValidationError extends GroqError {
//   constructor(message: string) {
//     super(message);
//     this.name = 'GroqValidationError';
//   }
// }


// export class GroqClient extends LLMClient {
//   public type = 'groq' as const;
//   private client: Groq;
//   private cache: LLMCache | undefined;
//   private enableCaching: boolean;
//   public clientOptions: GroqClientOptions;

//   /**
//    * Combines system prompts with user-provided instructions.
//    * @param systemPrompt - The base system prompt
//    * @param userProvidedInstructions - Optional user-provided instructions
//    * @returns Combined system prompt with user instructions
//    */
//   private combineSystemPrompt(systemPrompt: string, userProvidedInstructions?: string): string {
//     if (!userProvidedInstructions) {
//       return systemPrompt;
//     }

//     return `${systemPrompt.trim()}

// # Custom Instructions Provided by the User

// Please keep the user's instructions in mind when performing actions. If the user's instructions are not relevant to the current task, ignore them.

// User Instructions:
// ${userProvidedInstructions}`;
//   }

//   /**
//    * Prepares messages array with system prompt and user instructions.
//    * @param messages - Original messages array
//    * @param logger - Logger function
//    * @returns Modified messages array with combined system prompt
//    */
//   private prepareMessages(
//     messages: CreateChatCompletionOptions['options']['messages'],
//     logger: (message: LogLine) => void
//   ): CreateChatCompletionOptions['options']['messages'] {
//     // Find the first system message if it exists
//     const systemMessageIndex = messages.findIndex((msg) => msg.role === 'system');

//     if (systemMessageIndex === -1 && !this.userProvidedInstructions) {
//       // No system message and no user instructions, return original messages
//       return messages;
//     }

//     const newMessages = [...messages];
//     if (systemMessageIndex === -1) {
//       // No system message but we have user instructions, add a new system message
//       logger({
//         category: 'groq',
//         message: 'Adding system message with user instructions',
//         level: 1,
//         auxiliary: {
//           userInstructions: {
//             value: this.userProvidedInstructions || '',
//             type: 'string',
//           },
//         },
//       });

//       newMessages.unshift({
//         role: 'system',
//         content: this.combineSystemPrompt(
//           'You are a helpful assistant.',
//           this.userProvidedInstructions
//         ),
//       });
//     } else {
//       // Combine existing system message with user instructions
//       const existingSystemMessage = newMessages[systemMessageIndex];
//       logger({
//         category: 'groq',
//         message: 'Combining system message with user instructions',
//         level: 1,
//         auxiliary: {
//           originalSystemMessage: {
//             value:
//               typeof existingSystemMessage.content === 'string'
//                 ? existingSystemMessage.content
//                 : JSON.stringify(existingSystemMessage.content),
//             type: 'string',
//           },
//           userInstructions: {
//             value: this.userProvidedInstructions || '',
//             type: 'string',
//           },
//         },
//       });

//       newMessages[systemMessageIndex] = {
//         role: 'system',
//         content: this.combineSystemPrompt(
//           typeof existingSystemMessage.content === 'string'
//             ? existingSystemMessage.content
//             : JSON.stringify(existingSystemMessage.content),
//           this.userProvidedInstructions
//         ),
//       };
//     }

//     return newMessages;
//   }

//   private validateParameters(
//     options: CreateChatCompletionOptions['options'],
//     logger: (message: LogLine) => void
//   ) {
//     // Check for unsupported parameters
//     const unsupportedParams = Object.keys(options).filter((param) =>
//       UNSUPPORTED_OPENAI_PARAMS.has(param)
//     );

//     if (unsupportedParams.length > 0) {
//       logger({
//         category: 'groq',
//         message: 'Unsupported OpenAI parameters detected and will be ignored',
//         level: 1,
//         auxiliary: {
//           unsupportedParams: {
//             value: JSON.stringify(unsupportedParams),
//             type: 'object',
//           },
//         },
//       });
//     }

//     // Validate messages array
//     if (!options.messages.length) {
//       throw new Error('Messages array cannot be empty');
//     }

//     // Validate message roles
//     const validRoles = new Set(['system', 'user', 'assistant', 'function']);
//     const invalidRole = options.messages.find((msg) => !validRoles.has(msg.role));
//     if (invalidRole) {
//       throw new Error(`Invalid message role: ${invalidRole.role}`);
//     }

//     // Validate max_tokens against model limits
//     if (options.maxTokens) {
//       const contextLimit = MODEL_TOKEN_LIMITS[this.modelName];
//       const outputLimit = MODEL_MAX_OUTPUT_TOKENS[this.modelName] || contextLimit;
//       const effectiveLimit = Math.min(contextLimit, outputLimit);

//       if (options.maxTokens > effectiveLimit) {
//         logger({
//           category: 'groq',
//           message: `max_tokens (${options.maxTokens}) exceeds model limit (${effectiveLimit}), will be capped`,
//           level: 1,
//           auxiliary: {
//             maxTokens: {
//               value: String(options.maxTokens),
//               type: 'integer',
//             },
//             modelLimit: {
//               value: String(effectiveLimit),
//               type: 'integer',
//             },
//             contextWindow: {
//               value: String(contextLimit),
//               type: 'integer',
//             },
//             maxOutputTokens: {
//               value: String(outputLimit),
//               type: 'integer',
//             },
//           },
//         });
//         options.maxTokens = effectiveLimit;
//       }
//     }
//   }

//   constructor({
//     enableCaching = false,
//     cache,
//     modelName,
//     clientOptions,
//     userProvidedInstructions,
//   }: {
//     logger: (message: LogLine) => void;
//     enableCaching?: boolean;
//     cache?: LLMCache;
//     modelName: AvailableModel;
//     clientOptions?: GroqClientOptions;
//     userProvidedInstructions?: string;
//   }) {
//     super(modelName);
//     this.client = new Groq({
//       apiKey: clientOptions?.apiKey,
//       baseURL: clientOptions?.baseURL,
//       maxRetries: clientOptions?.maxRetries ?? 2,
//       timeout: clientOptions?.timeout ?? 60000,
//     });
//     this.cache = cache;
//     this.enableCaching = enableCaching;
//     this.modelName = modelName;
//     this.clientOptions = clientOptions || {};
//     this.userProvidedInstructions = userProvidedInstructions;
//   }

//   async createChatCompletion<T = LLMResponse>({
//     options,
//     retries = 3,
//     logger,
//   }: CreateChatCompletionOptions): Promise<T> {
//     logger({
//       category: 'groq',
//       message: 'Creating chat completion with Groq',
//       level: 1,
//       auxiliary: {
//         options: {
//           value: JSON.stringify(options),
//           type: 'object',
//         },
//         modelName: {
//           value: this.modelName,
//           type: 'string',
//         },
//       },
//     });

//     try {
//       // Validate parameters before proceeding
//       this.validateParameters(options, logger);

//       // Prepare messages with system prompt and user instructions
//       const messages = this.prepareMessages(options.messages, logger);

//       // Prepare cache options
//       const cacheOptions: Record<string, unknown> = {
//         model: this.modelName,
//         messages: messages,
//         temperature: options.temperature,
//         top_p: options.top_p,
//         frequency_penalty: options.frequency_penalty,
//         presence_penalty: options.presence_penalty,
//         maxTokens: options.maxTokens,
//         tools: options.tools,
//         tool_choice: options.tool_choice,
//       };

//       // Check cache if enabled
//       if (this.enableCaching && this.cache) {
//         const cachedResponse = await this.cache.get<T>(cacheOptions, options.requestId);
//         if (cachedResponse) {
//           logger({
//             category: 'groq_cache',
//             message: 'Returning cached response',
//             level: 1,
//             auxiliary: {
//               response: {
//                 value: JSON.stringify(cachedResponse),
//                 type: 'object',
//               },
//             },
//           });
//           return cachedResponse;
//         }
//       }

//       // Filter out messages with 'name' property as it's not supported by Groq
//       const messagesFiltered = messages.map((msg) => ({
//         role: msg.role,
//         content: Array.isArray(msg.content)
//           ? msg.content
//               .map((c) => {
//                 if (typeof c === 'string') return c;
//                 if ('text' in c) return c.text || '';
//                 if ('image_url' in c && c.image_url) return c.image_url.url;
//                 return '';
//               })
//               .join('\n')
//           : msg.content,
//       }));

//       // Handle response model if provided
//       let functionDefinition;
//       if (options.response_model) {
//         const jsonSchema = zodToJsonSchema(options.response_model.schema);
//         functionDefinition = {
//           name: 'print_extracted_data',
//           description: `Print the extracted data in the following format: ${options.response_model.name}`,
//           parameters: jsonSchema,
//         };
//       }

//       // Prepare tools if provided
//       const tools =
//         options.tools?.map((tool) => ({
//           type: 'function' as const,
//           function: {
//             name: tool.name,
//             description: tool.description,
//             parameters: tool.parameters,
//           },
//         })) || [];

//       if (functionDefinition) {
//         tools.push({
//           type: 'function' as const,
//           function: functionDefinition,
//         });
//       }

//       try {
//         // console.log('sending messages to groq', {
//         //   messagesFiltered,
//         //   temperature: options.temperature,
//         //   top_p: options.top_p,
//         //   frequency_penalty: options.frequency_penalty,
//         //   presence_penalty: options.presence_penalty,
//         // });
//         const completion = await this.client.chat.completions.create({
//           model: this.modelName,
//           messages: messagesFiltered,
//           temperature: options.temperature === 0 ? MIN_TEMPERATURE : options.temperature,
//           top_p: options.top_p ?? 1,
//           frequency_penalty: options.frequency_penalty || 1,
//           presence_penalty: options.presence_penalty || 1,
//           max_tokens: options.maxTokens,
//           ...(this.modelName.includes('r1') ? { reasoning_format: 'hidden' } : {}), // TODO might be worth switching to "parsed" for transparency see https://console.groq.com/docs/reasoning
//           n: 1, // Groq only supports n=1
//           parallel_tool_calls: false,
//           tools,
//           tool_choice: options.response_model
//             ? 'auto'
//             : (options.tool_choice as 'none' | 'auto' | 'required' | undefined),
//         });

//         console.log('grow completion', JSON.stringify(completion, null, 2));

//         // Transform to LLMResponse format
//         const response: LLMResponse = {
//           id: completion.id,
//           object: 'chat.completion',
//           created: Date.now(),
//           model: completion.model,
//           choices: [
//             {
//               index: 0,
//               message: {
//                 role: completion.choices[0].message.role,
//                 content: completion.choices[0].message.content || null,
//                 tool_calls: completion.choices[0].message.tool_calls || [],
//               },
//               finish_reason: completion.choices[0].finish_reason,
//             },
//           ],
//           usage: {
//             prompt_tokens: completion.usage?.prompt_tokens || 0,
//             completion_tokens: completion.usage?.completion_tokens || 0,
//             total_tokens: completion.usage?.total_tokens || 0,
//           },
//         };

//         // Cache the response if caching is enabled
//         if (this.enableCaching && this.cache) {
//           await this.cache.set(cacheOptions, response, options.requestId);
//         }

//         // Handle response model extraction if needed
//         if (options.response_model && response.choices[0].message.tool_calls?.length > 0) {
//           const toolCall = response.choices[0].message.tool_calls[0];
//           if (toolCall.function.name === 'print_extracted_data') {
//             try {
//               return JSON.parse(toolCall.function.arguments) as T;
//             } catch (error) {
//               logger({
//                 category: 'groq',
//                 message: 'Failed to parse structured output',
//                 level: 2,
//                 auxiliary: {
//                   error: {
//                     value: error instanceof Error ? error.message : String(error),
//                     type: 'string',
//                   },
//                   toolCall: {
//                     value: JSON.stringify(toolCall),
//                     type: 'object',
//                   },
//                 },
//               });
//               if (retries > 0) {
//                 return this.createChatCompletion({
//                   options,
//                   retries: retries - 1,
//                   logger,
//                 });
//               }
//               throw new GroqValidationError('Failed to parse structured output');
//             }
//           }
//         }

//         return response as T;
//       } catch (error) {
//         console.error('Error in Groq chat completion 1');

//         if (
//           error instanceof Error &&
//           'error' in error &&
//           typeof error.error === 'object' &&
//           error.error &&
//           'error' in error.error &&
//           typeof error.error.error === 'object' &&
//           error.error.error &&
//           'failed_generation' in error.error.error &&
//           typeof error.error.error.failed_generation === 'string'
//         ) {
//           // this is needed to handle the case where the tool call fails with some groq models
//           try {
//             const result = JSON.parse(error.error.error.failed_generation as string).arguments;
//             return result as T;
//           } catch {
//             const substr = error.error.error.failed_generation
//               .split('```json')[1]
//               .split('```')[0]
//               .trim();
//             const result = JSON.parse(substr).arguments;
//             return result as T;
//           }
//         }

//         // Handle Groq API errors
//         if (error instanceof Error) {
//           logger({
//             category: 'groq',
//             message: 'Error in Groq chat completion',
//             level: 2,
//             auxiliary: {
//               error: {
//                 value: error.message || String(error),
//                 type: 'string',
//               },
//               trace: {
//                 value: error.stack || '',
//                 type: 'string',
//               },
//             },
//           });

//           // Map error types
//           if (error.message.includes('API key')) {
//             throw new GroqAuthenticationError(error.message);
//           }
//           if (error.message.includes('rate limit')) {
//             throw new GroqRateLimitError(error.message);
//           }
//           if (error.message.includes('timeout')) {
//             throw new GroqTimeoutError(error.message);
//           }
//           if (error.message.includes('connect')) {
//             throw new GroqConnectionError(error.message);
//           }

//           // Retry on certain errors if retries remaining
//           if (
//             retries > 0 &&
//             (error.message.includes('timeout') ||
//               error.message.includes('rate limit') ||
//               error.message.includes('connect'))
//           ) {
//             return this.createChatCompletion({
//               options,
//               retries: retries - 1,
//               logger,
//             });
//           }

//           throw new GroqAPIError(error.message, 500, 'internal_error');
//         }
//         throw error;
//       }
//     } catch (error) {
//       console.error(
//         'Error in Groq chat completion 2',
//         typeof error,
//         JSON.stringify(error, null, 2)
//       );
//       // Log the error
//       logger({
//         category: 'groq',
//         message: 'Error in Groq chat completion',
//         level: 2,
//         auxiliary: {
//           error: {
//             value: error instanceof Error && error.message ? error.message : String(error),
//             type: 'string',
//           },
//           trace: {
//             value: error instanceof Error && error.stack ? error.stack : '',
//             type: 'string',
//           },
//         },
//       });
//       throw error;
//     }
//   }
// }
