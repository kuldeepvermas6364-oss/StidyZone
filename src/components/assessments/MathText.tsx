import React, { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface KaTeXNodeProps {
  tex: string;
  displayMode: boolean;
}

const KaTeXNode: React.FC<KaTeXNodeProps> = ({ tex, displayMode }) => {
  const elRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const target = elRef.current;
    if (!target) return;
    try {
      katex.render(tex, target, {
        displayMode,
        throwOnError: false,
        strict: false,
        trust: false,
      });
    } catch {
      target.textContent = tex;
    }
  }, [tex, displayMode]);

  return (
    <span
      ref={elRef}
      className={
        displayMode
          ? 'my-2 block overflow-x-auto py-1 text-center'
          : 'inline-block align-middle'
      }
    />
  );
};

interface Segment {
  kind: 'text' | 'inline' | 'display';
  content: string;
}

function splitLatexSegments(input: string): Segment[] {
  if (!input) return [];
  const out: Segment[] = [];
  let i = 0;
  let buf = '';

  while (i < input.length) {
    if (input[i] === '$' && input[i + 1] === '$') {
      const closeIdx = input.indexOf('$$', i + 2);
      if (closeIdx !== -1) {
        if (buf) {
          out.push({ kind: 'text', content: buf });
          buf = '';
        }
        out.push({ kind: 'display', content: input.slice(i + 2, closeIdx).trim() });
        i = closeIdx + 2;
        continue;
      }
    }
    if (input[i] === '$' && input[i - 1] !== '\\') {
      const closeIdx = input.indexOf('$', i + 1);
      if (closeIdx !== -1) {
        if (buf) {
          out.push({ kind: 'text', content: buf });
          buf = '';
        }
        out.push({ kind: 'inline', content: input.slice(i + 1, closeIdx).trim() });
        i = closeIdx + 1;
        continue;
      }
    }
    buf += input[i];
    i += 1;
  }

  if (buf) {
    out.push({ kind: 'text', content: buf });
  }
  return out;
}

export interface MathTextProps {
  text: string;
  className?: string;
}

/**
 * Renders bilingual prose interleaved with inline ($...$) and block ($$...$$) LaTeX equations
 * cleanly via KaTeX DOM API with trust: false and zero raw HTML injection.
 */
export const MathText: React.FC<MathTextProps> = ({ text, className = '' }) => {
  const segments = splitLatexSegments(text);
  return (
    <span className={className}>
      {segments.map((seg, idx) => {
        if (seg.kind === 'display') {
          return <KaTeXNode key={idx} tex={seg.content} displayMode />;
        }
        if (seg.kind === 'inline') {
          return <KaTeXNode key={idx} tex={seg.content} displayMode={false} />;
        }
        return <React.Fragment key={idx}>{seg.content}</React.Fragment>;
      })}
    </span>
  );
};
