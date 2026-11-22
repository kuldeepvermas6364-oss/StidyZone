import React from 'react';
import { MathText } from '../assessments/MathText';

/**
 * Renders inline Markdown emphasis (**bold**, `code`, *italic*) + KaTeX math ($...$ / $$...$$)
 * cleanly using React elements only (zero dangerouslySetInnerHTML).
 */
function renderInlineTokens(text: string): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(<MathText key={`t-${keyIdx++}`} text={text.slice(lastIndex, match.index)} />);
    }
    const raw = match[0];
    if (raw.startsWith('**') && raw.endsWith('**')) {
      tokens.push(
        <strong key={`b-${keyIdx++}`} className="font-semibold text-slate-900 dark:text-white">
          <MathText text={raw.slice(2, -2)} />
        </strong>
      );
    } else if (raw.startsWith('`') && raw.endsWith('`')) {
      tokens.push(
        <code
          key={`c-${keyIdx++}`}
          className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[12px] text-blue-700 dark:bg-slate-800 dark:text-blue-300"
        >
          {raw.slice(1, -1)}
        </code>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push(<MathText key={`t-${keyIdx++}`} text={text.slice(lastIndex)} />);
  }
  return tokens;
}

export interface AiMarkdownMathProps {
  content: string;
  className?: string;
}

export const AiMarkdownMath: React.FC<AiMarkdownMathProps> = ({ content, className = '' }) => {
  if (!content) return null;

  const blocks: React.ReactNode[] = [];
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  let i = 0;
  let blockKey = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code blocks
    if (line.trim().startsWith('```')) {
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push(
        <pre
          key={`pre-${blockKey++}`}
          className="my-2 overflow-x-auto rounded-xl border border-slate-200 bg-slate-900 p-3 font-mono text-xs leading-relaxed text-slate-100 dark:border-slate-700"
        >
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    // Markdown headings
    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(line.trim());
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      const cls =
        level === 1
          ? 'mt-3 mb-1.5 font-display text-base font-bold text-slate-900 dark:text-white'
          : level === 2
          ? 'mt-3 mb-1 font-display text-sm font-bold text-slate-900 dark:text-white'
          : 'mt-2.5 mb-1 text-xs font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300';
      blocks.push(
        <div key={`h-${blockKey++}`} className={cls}>
          {renderInlineTokens(headingText)}
        </div>
      );
      i += 1;
      continue;
    }

    // Blockquote
    if (line.trim().startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('> ')) {
        quoteLines.push(lines[i].trim().slice(2));
        i += 1;
      }
      blocks.push(
        <blockquote
          key={`q-${blockKey++}`}
          className="my-2 border-l-2 border-blue-500 bg-blue-50/50 px-3 py-2 text-xs leading-relaxed text-slate-700 dark:bg-blue-950/30 dark:text-slate-200"
        >
          {renderInlineTokens(quoteLines.join(' '))}
        </blockquote>
      );
      continue;
    }

    // Markdown table
    if (line.trim().startsWith('|') && i + 1 < lines.length && /^\|[\s:|-]+\|/.test(lines[i + 1].trim())) {
      const parseRow = (r: string) =>
        r
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => c.trim());
      const headers = parseRow(line);
      i += 2; // skip header + separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(parseRow(lines[i]));
        i += 1;
      }
      blocks.push(
        <div key={`tbl-${blockKey++}`} className="my-2 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="min-w-full border-collapse text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                {headers.map((h, hIdx) => (
                  <th
                    key={hIdx}
                    className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-800 dark:border-slate-700 dark:text-slate-100"
                  >
                    {renderInlineTokens(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((row, rIdx) => (
                <tr key={rIdx}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3 py-1.5 text-slate-700 dark:text-slate-300">
                      {renderInlineTokens(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Bullet list
    if (/^\s*[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*•]\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ul key={`ul-${blockKey++}`} className="my-1.5 list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
          {items.map((item, idx) => (
            <li key={idx}>{renderInlineTokens(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ol key={`ol-${blockKey++}`} className="my-1.5 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
          {items.map((item, idx) => (
            <li key={idx}>{renderInlineTokens(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Display math standalone block $$ ... $$
    if (line.trim().startsWith('$$')) {
      let mathBuf = line;
      while (!mathBuf.trim().slice(2).includes('$$') && i + 1 < lines.length) {
        i += 1;
        mathBuf += '\n' + lines[i];
      }
      i += 1;
      blocks.push(
        <div key={`m-${blockKey++}`} className="my-1.5 text-sm text-slate-900 dark:text-white">
          <MathText text={mathBuf} />
        </div>
      );
      continue;
    }

    if (!line.trim()) {
      i += 1;
      continue;
    }

    // Regular paragraph (group adjacent non-special lines)
    const paraLines: string[] = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,3}\s+|>\s+|\s*[-*•]\s+|\s*\d+[.)]\s+|```|\||\$\$)/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i += 1;
    }

    blocks.push(
      <p key={`p-${blockKey++}`} className="my-1.5 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
        {renderInlineTokens(paraLines.join(' '))}
      </p>
    );
  }

  return <div className={`space-y-1 ${className}`}>{blocks}</div>;
};
