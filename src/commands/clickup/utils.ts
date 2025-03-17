import type { CommandOptions } from '../../types';

export type ClickUpOptions = CommandOptions;

export function formatDate(timestamp: unknown): string {
  return new Date(Number(timestamp)).toLocaleString();
}

export function formatStatus(status: { status: string; color: string }): string {
  return `${status.status} (${status.color})`;
}
