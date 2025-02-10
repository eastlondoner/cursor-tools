import type { Command, CommandGenerator, CommandOptions } from '../types.ts';
import type { Config } from '../config.ts';
import { loadConfig, loadEnv } from '../config.ts';
import { createEventSource } from 'eventsource-client';

const MAX_RETRIES = 2;

export class WebCommand implements Command {
  private config: Config;

  constructor() {
    loadEnv();
    this.config = loadConfig();
  }

  private async *fetchPerplexityResponse(
    query: string,
    options?: CommandOptions
  ): AsyncGenerator<string, void, unknown> {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      throw new Error('PERPLEXITY_API_KEY environment variable is not set');
    }

    let maxRetriesReached = false;
    let someMessageReceived = false;
    let endMessageReceived = false;

    let fetchAttempts = 0;
    const es = createEventSource({
      url: 'https://api.perplexity.ai/chat/completions',
      onDisconnect: () => {
        if (endMessageReceived) {
          return;
        }
        if (someMessageReceived) {
          // This is supposed to happen but perplexity doesn't always send a finish_reason so we have to assume it's the end of the stream
          // this is not ideal because it could be a network problem we should retry
          console.error(
            '\nPerplexity disconnected without sending a finish_reason, we will close the connection'
          );
          es.close();
        } else {
          // no messages were received so we should retry
          console.error(
            `\nConnection disconnected without recieving any messages, we will retry ${MAX_RETRIES} times (attempt ${fetchAttempts})`
          );
          es.close();
        }
      },
      fetch: async (url, init) => {
        if (fetchAttempts++ > MAX_RETRIES) {
          maxRetriesReached = true;
          console.error('\nMax retries reached. Giving up.');
          // we're going to fake a response to stop the event source from trying to reconnect
          return {
            body: null,
            url: url.toString(),
            status: 204,
            redirected: false,
          };
        }
        const response = await fetch(url, {
          ...init,
          method: 'POST',
          headers: {
            ...(init?.headers || {}),
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            model: options?.model || this.config.perplexity.model,
            messages: [
              {
                role: 'system',
                content:
                  'Search the web to produce answers to questions. Your responses are for an automated system and should be precise, specific and concise. Avoid unnecessary chat and formatting. Include code and examples.',
              },
              {
                role: 'user',
                content: query,
              },
            ],
            stream: true,
            max_tokens: options?.maxTokens || this.config.perplexity.maxTokens,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Perplexity API error', errorText);
          throw new Error(`API Error (${response.status}): ${errorText}`);
        }

        return response;
      },
    });

    try {
      for await (const { data, event } of es) {
        try {
          const json = JSON.parse(data);
          const content = json.choices[0]?.delta?.content;
          if (content !== undefined) {
            someMessageReceived = true;
            yield content;
          }
          if ('finish_reason' in json.choices[0] && !!json.choices[0].finish_reason) {
            endMessageReceived = true;
            if (json.citations && json.citations.length > 0) {
              yield '\n\ncitations:\n' +
                json.citations?.map((c: any, i: number) => `${i + 1}. ${c}`).join('\n');
            }
            break;
          }
          if (event?.toLowerCase() === 'end' || event?.toLowerCase() === 'done') {
            endMessageReceived = true;
            break;
          }
        } catch (e) {
          console.error('Error parsing event data:', e);
          throw e;
        }
        if (maxRetriesReached) {
          break;
        }
      }
    } finally {
      es.close();
    }
  }

  async *execute(query: string, options?: CommandOptions): CommandGenerator {
    try {
      const model = options?.model || this.config.perplexity.model;
      yield `Querying Perplexity AI using ${model} for: ${query}\n`;
      yield* this.fetchPerplexityResponse(query, options);
    } catch (error) {
      if (error instanceof Error) {
        yield `Error: ${error.message}`;
      } else {
        yield 'An unknown error occurred';
      }
    }
  }
}
