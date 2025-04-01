import type { Command, CommandGenerator } from '../../types';
import { loadEnv } from '../../config';
import { getClickUpHeaders } from './clickupAuth';
import { formatDate, formatStatus, type ClickUpOptions } from './utils';

export class TaskCommand implements Command {
  constructor() {
    loadEnv();
  }

  private async fetchComments(taskId: string): Promise<any[]> {
    const url = `https://api.clickup.com/api/v2/task/${taskId}/comment`;
    try {
      const response = await fetch(url, {
        headers: getClickUpHeaders(),
      });

      if (!response.ok) {
        return [];
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching comments:', error);
      return [];
    }
  }

  async *execute(query: string, options?: ClickUpOptions): CommandGenerator {
    const taskId = query.trim();

    if (!taskId) {
      yield 'Please specify a task ID (e.g., vibe-tools clickup task "task_id")';
      return;
    }

    try {
      const response = await fetch(`https://api.clickup.com/api/v2/task/${taskId}`, {
        headers: getClickUpHeaders(),
      });

      if (!response.ok) {
        yield `ClickUp API Error: ${response.status} - ${response.statusText}`;
        if (response.status === 404) {
          yield `  (Task ${taskId} not found)`;
        } else if (response.status === 401) {
          yield '\nAuthentication failed. Please check your CLICKUP_API_TOKEN.';
        }
        return;
      }

      const task = await response.json();

      // Task header
      yield `## Task\n`;
      yield `[${task.id}] ${task.name}\n`;
      yield `Status: ${formatStatus(task.status)}\n`;
      yield `URL: ${task.url}\n\n`;

      // Description
      yield `## Description\n`;
      yield `${task.description || 'No description provided.'}\n\n`;

      // Task metadata
      yield `Created by: ${task.creator.username}\n`;
      yield `Created on: ${formatDate(task.date_created)}\n`;
      if (task.date_updated) {
        yield `Updated on: ${formatDate(task.date_updated)}\n`;
      }
      if (task.date_closed) {
        yield `Closed on: ${formatDate(task.date_closed)}\n`;
      }

      // Comments
      const commentsRes = await this.fetchComments(taskId);
      if (
        'comments' in commentsRes &&
        Array.isArray(commentsRes.comments) &&
        commentsRes.comments.length > 0
      ) {
        const comments = commentsRes.comments;
        yield `\n## Comments, newest to oldest (${comments.length})\n\n`;
        for (const comment of comments) {
          yield `**@${comment.user.username}** commented on ${formatDate(comment.date)}\n`;
          yield `> ${comment.comment_text || 'No content'}\n`;
        }
      }

      // Additional metadata
      yield `---\n`;
      if (task.assignees?.length > 0) {
        yield `Assignees: ${task.assignees.map((a: any) => '@' + a.username).join(', ')}\n`;
      }
      if (task.tags?.length > 0) {
        yield `Tags: ${task.tags.map((t: any) => t.name).join(', ')}\n`;
      }
      if (task.priority) {
        yield `Priority: ${task.priority.priority}\n`;
      }
      if (task.due_date) {
        yield `Due date: ${formatDate(task.due_date)}\n`;
      }
    } catch (error) {
      yield `Error fetching task: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
}
