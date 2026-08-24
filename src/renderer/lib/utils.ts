import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { countHtmlWords } from '@shared/manuscriptMeta'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function countWords(html: string): number {
  return countHtmlWords(html)
}
