import type { Command, CommandGenerator, CommandOptions, VideoAnalysisOptions } from '../../types';
import { loadConfig, loadEnv } from '../../config';
import type { Config } from '../../types';
import { ApiKeyMissingError, ProviderError, NetworkError } from '../../errors';
import { createProvider } from '../../providers/base';

interface YouTubeCommandOptions extends CommandOptions {
  type?: 'summary' | 'transcript' | 'plan' | 'review' | 'custom';
  duration?: 'short' | 'medium' | 'full';
  format?: 'markdown' | 'json' | 'text';
}

export class YouTubeCommand implements Command {
  private config: Config;

  constructor() {
    loadEnv();
    this.config = loadConfig();
  }

  async *execute(query: string, options: YouTubeCommandOptions): CommandGenerator {
    try {
      // Extract YouTube URL from query
      const urlRegex =
        /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/i;
      const urlMatch = query.match(urlRegex);

      if (!urlMatch) {
        yield 'Please provide a valid YouTube URL.';
        return;
      }

      let youtubeUrl = urlMatch[0];
      // Ensure the URL is properly formatted
      if (!youtubeUrl.startsWith('http')) {
        // Ensure it has proper protocol
        const videoId = urlMatch[1];
        if (videoId) {
          // Construct a proper YouTube URL
          if (youtubeUrl.includes('youtu.be')) {
            youtubeUrl = `https://youtu.be/${videoId}`;
          } else {
            youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
          }
        }
      }

      const remainingQuery = query.replace(urlMatch[0], '').trim();

      // Make sure we have a GEMINI_API_KEY
      if (!process.env.GEMINI_API_KEY) {
        throw new ApiKeyMissingError('Gemini');
      }

      // Create Gemini provider
      const provider = createProvider('gemini');

      // Get model, default to gemini-2.0-flash which supports video
      const model = options?.model || this.config.youtube?.model || 'gemini-2.5-pro-exp-03-25';

      // Get max tokens, default to 8192 for detailed responses
      const maxTokens = options?.maxTokens || this.config.youtube?.maxTokens || 8192;

      yield `Analyzing YouTube video: ${youtubeUrl}\n`;

      // Convert the Gemini provider to GoogleGenerativeLanguageProvider to access video methods
      const geminiProvider = provider as any;
      if (!geminiProvider.executeVideoPrompt) {
        throw new Error('The selected provider does not support video analysis');
      }

      // Determine the type of analysis based on options or config
      const analysisType = options?.type || this.config.youtube?.defaultType || 'summary';

      // Determine output format
      const outputFormat = options?.format || this.config.youtube?.defaultFormat || 'markdown';

      // Create system prompt based on analysis type
      let systemPrompt = '';
      let userPrompt = '';

      switch (analysisType) {
        case 'summary':
          systemPrompt = `You are a specialist generating detailed and accurate summaries of YouTube videos. Provide structured, comprehensive summaries that capture the key points and content. Format the output in ${outputFormat} format with proper headings and structure.`;
          userPrompt = remainingQuery || 'Provide a comprehensive summary of this video.';
          break;
        case 'transcript':
          systemPrompt = `You are a highly accurate transcription service for YouTube videos. Focus on producing a verbatim transcript of the spoken content, including proper formatting and speaker attribution when possible. If the video doesn't have audible speech or lacks sufficient spoken content, indicate this clearly. Format the output in ${outputFormat} format.`;
          userPrompt = remainingQuery || 'Generate a detailed transcript of this video.';
          break;
        case 'plan':
          systemPrompt = `You are an expert implementation planner. Your task is to watch tutorials and educational content and convert them into detailed, actionable step-by-step implementation plans. Format the output in ${outputFormat} format with proper headings, numbered steps, and structure.`;
          userPrompt =
            remainingQuery ||
            'Watch this video and generate a detailed plan on how to implement something similar.';
          break;
        case 'review':
          systemPrompt = `You are a thoughtful critic and analyzer of video content. Provide balanced, insightful reviews that consider both strengths and areas for improvement. Format the output in ${outputFormat} format with proper headings and structure.`;
          userPrompt = remainingQuery || 'Provide a critical review and analysis of this video.';
          break;
        case 'custom':
          systemPrompt = `You are an AI assistant specialized in analyzing YouTube videos and providing detailed insights based on their content. Format the output in ${outputFormat} format with proper structure.`;
          // Use the user's query as is
          userPrompt = remainingQuery || 'Analyze this video and provide your insights.';
          break;
      }

      yield `Using analysis type: ${analysisType}\n`;
      yield `Processing with model: ${model}\n`;
      yield `Output format: ${outputFormat}\n`;
      yield `Starting video analysis, this may take a moment...\n`;

      try {
        const response = await geminiProvider.executeVideoPrompt(userPrompt, {
          videoUrl: youtubeUrl,
          model,
          maxTokens,
          systemPrompt,
          debug: options?.debug,
        });

        yield response;
      } catch (error) {
        if (error instanceof NetworkError) {
          if (error.message.includes('fileData.fileUri is not a valid YouTube video URL')) {
            yield 'The provided URL is not a valid YouTube video URL. Please check the URL and try again.';
          } else if (
            error.message.includes('video is too long') ||
            error.message.includes('exceeds the maximum supported duration')
          ) {
            yield 'The video is too long for analysis. Gemini has limitations on video length. Try using a shorter video or a specific clip.';
          } else if (error.message.includes('403') || error.message.includes('permission')) {
            yield 'Unable to access this video. The video might be private, age-restricted, or not available in your region.';
          } else if (error.message.includes('404') || error.message.includes('not found')) {
            yield 'Video not found. The video might have been removed or the URL is incorrect.';
          } else if (error.message.includes('429') || error.message.includes('quota')) {
            yield 'API quota exceeded. Please try again later or check your Gemini API key limits.';
          } else if (error.message.includes('500') || error.message.includes('server error')) {
            yield 'Server error occurred while analyzing the video. Please try again later.';
          } else if (
            error.message.includes('no audio') ||
            error.message.includes('no transcript')
          ) {
            yield 'Unable to generate transcript. The video might not have audible speech or the speech is unclear.';
          } else {
            yield `Error: ${error.message}`;
          }

          // Provide some troubleshooting suggestions
          yield '\nTroubleshooting suggestions:';
          yield '- Ensure your GEMINI_API_KEY is valid and has sufficient quota';
          yield '- Try a different video or a shorter clip';
          yield '- Check if the video is publicly accessible';
          yield '- If using transcript mode, ensure the video has clear, audible speech';
          yield '- Try a different analysis type (--type=summary, --type=review, etc.)';
        } else {
          throw error;
        }
      }
    } catch (error) {
      if (error instanceof ProviderError || error instanceof ApiKeyMissingError) {
        yield error.formatUserMessage(options?.debug);
      } else if (error instanceof Error) {
        yield `Error: ${error.message}\n`;
      } else {
        yield 'An unknown error occurred\n';
      }
    }
  }
}
