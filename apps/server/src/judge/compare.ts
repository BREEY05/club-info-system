/** 输出比对：忽略行末空白、按 token、按行、精确、浮点误差。移植自 bluebridge-judge/bbjudge/compare.py */

import type { CompareMode } from './types.ts';

function clip(text: string, limit = 60): string {
  const flat = text.replace(/\n/g, '\\n');
  return flat.length <= limit ? flat : flat.slice(0, limit) + '…';
}

function normalizedLines(text: string): string[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').map((line) => line.replace(/\s+$/, ''));
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

function tokens(text: string): string[] {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split(/\s+/).filter(Boolean);
}

function tokenMessage(want: string[], got: string[]): string {
  const len = Math.min(want.length, got.length);
  for (let i = 0; i < len; i += 1) {
    if (want[i] !== got[i]) return `第 ${i + 1} 个数据不一致：期望 ${clip(want[i]!)}，实际 ${clip(got[i]!)}`;
  }
  if (got.length < want.length) {
    return `输出数据过少：期望 ${want.length} 个，实际 ${got.length} 个，缺少 ${clip(want[got.length] ?? '')} 等`;
  }
  return `输出数据过多：期望 ${want.length} 个，实际 ${got.length} 个，多出 ${clip(got[want.length] ?? '')} 等`;
}

function lineMessage(want: string[], got: string[]): string {
  const len = Math.min(want.length, got.length);
  for (let i = 0; i < len; i += 1) {
    if (want[i] !== got[i]) return `第 ${i + 1} 行不一致：期望 ${clip(want[i]!)}，实际 ${clip(got[i]!)}`;
  }
  if (got.length < want.length) return `输出行数过少：期望 ${want.length} 行，实际 ${got.length} 行`;
  return `输出行数过多：期望 ${want.length} 行，实际 ${got.length} 行`;
}

function compareFloat(expected: string, actual: string, tolerance: number): { ok: boolean; message: string } {
  const want = tokens(expected);
  const got = tokens(actual);
  if (want.length !== got.length) return { ok: false, message: tokenMessage(want, got) };
  for (let i = 0; i < want.length; i += 1) {
    const w = Number(want[i]);
    const g = Number(got[i]);
    if (Number.isFinite(w) && Number.isFinite(g)) {
      const limit = tolerance * Math.max(1, Math.abs(w));
      if (Math.abs(w - g) > limit) {
        return { ok: false, message: `第 ${i + 1} 个数据超出误差范围：期望 ${want[i]}，实际 ${got[i]}（允许误差 ${tolerance}）` };
      }
    } else if (want[i] !== got[i]) {
      return { ok: false, message: `第 ${i + 1} 个数据不一致：期望 ${clip(want[i]!)}，实际 ${clip(got[i]!)}` };
    }
  }
  return { ok: true, message: '' };
}

export function compareOutput(mode: CompareMode, expected: string, actual: string, tolerance = 1e-6): { ok: boolean; message: string } {
  if (mode === 'exact') {
    return expected.replace(/\r\n/g, '\n').replace(/\r/g, '\n') === actual.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      ? { ok: true, message: '' }
      : { ok: false, message: '输出与标准答案不完全一致（精确比对）' };
  }
  const empty = actual.trim() === '';
  if (empty && expected.trim() === '') return { ok: true, message: '' };
  if (empty) return { ok: false, message: '程序没有输出任何内容' };

  if (mode === 'line') {
    const want = normalizedLines(expected);
    const got = normalizedLines(actual);
    const ok = want.length === got.length && want.every((line, i) => line === got[i]);
    return { ok, message: ok ? '' : lineMessage(want, got) };
  }
  if (mode === 'float') return compareFloat(expected, actual, tolerance);

  const want = tokens(expected);
  const got = tokens(actual);
  const ok = want.length === got.length && want.every((token, i) => token === got[i]);
  return { ok, message: ok ? '' : tokenMessage(want, got) };
}
