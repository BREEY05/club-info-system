import type { JudgeLanguage, JudgeVerdict } from '../../../api/judge';

export const VERDICT_META: Record<JudgeVerdict, { label: string; short: string; tone: 'mint' | 'danger' | 'amber' | 'neutral' }> = {
  AC: { label: '通过', short: 'AC', tone: 'mint' },
  WA: { label: '答案错误', short: 'WA', tone: 'danger' },
  TLE: { label: '运行超时', short: 'TLE', tone: 'amber' },
  RE: { label: '运行错误', short: 'RE', tone: 'danger' },
  CE: { label: '编译错误', short: 'CE', tone: 'neutral' },
  SE: { label: '系统错误', short: 'SE', tone: 'neutral' },
};

export const LANGUAGE_META: { key: JudgeLanguage; name: string; ext: string }[] = [
  { key: 'cpp', name: 'C++', ext: '.cpp' },
  { key: 'c', name: 'C', ext: '.c' },
  { key: 'java', name: 'Java', ext: '.java' },
  { key: 'python', name: 'Python', ext: '.py' },
];

export const DEFAULT_CODE: Record<string, string> = {
  cpp: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    // 在这里写你的代码
    return 0;
}
`,
  c: `#include <stdio.h>

int main(void) {
    // 在这里写你的代码
    return 0;
}
`,
  java: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        // 在这里写你的代码
    }
}
`,
  python: `import sys


def main() -> None:
    data = sys.stdin.read().split()
    # 在这里写你的代码


if __name__ == "__main__":
    main()
`,
  text: '',
};

export function difficultyLabel(value: string): string {
  if (value === 'easy') return '简单';
  if (value === 'medium') return '中等';
  if (value === 'hard') return '困难';
  return '未标注';
}
