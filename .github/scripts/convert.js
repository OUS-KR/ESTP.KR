#!/usr/bin/env node

/**
 * 마크다운 → HTML 변환 스크립트 (확장 문법 지원)
 * 버튼 너비 옵션 추가 버전
 */

import { marked } from 'marked';

// ============================================
// 1. 마크다운 전처리
// ============================================

function preprocess(markdown) {
  let result = markdown;

  // 1-1. 불필요한 링크 중첩 제거
  result = result.replace(
    /\[([^\]]+)\]\(\[([^\]]+)\]\(([^\]]+)\)\)/g,
    (match, text, nestedUrl, actualUrl) => {
      return `[${text}](${actualUrl})`;
    }
  );

  // 1-2. Featured Section
  result = result.replace(
    /^:::(featured)\s*\n([\s\S]*?)\n:::\s*$/gm,
    (match, type, content) => {
      return `<!--FEATURED_START-->\n${content}\n<!--FEATURED_END-->`;
    }
  );

  // 1-3. Card Section
  result = result.replace(
    /^:::(card)\s*\n([\s\S]*?)\n:::\s*$/gm,
    (match, type, content) => {
      return `<!--CARD_START-->\n${content}\n<!--CARD_END-->`;
    }
  );

  // 1-4. Grid Layout
  result = result.replace(
    /^:::(grid-[2-4])\s*\n([\s\S]*?)\n:::\s*$/gm,
    (match, gridType, content) => {
      const cols = gridType.split('-')[1];
      
      const lines = content.split('\n').filter(line => line.trim());
      const gridItems = lines.map(line => {
        line = line.replace(/^-\s*/, '').trim();
        const tempMarkdown = `${line}\n`;
        const processedHtml = marked(tempMarkdown);
        const innerHtml = processedHtml
          .replace(/<p>([\s\S]*?)<\/p>/g, '$1')
          .trim();
        
        return `<div class="grid-item">${innerHtml}</div>`;
      });
      
      return `\n<!--GRID_START_${cols}-->\n${gridItems.join('\n')}\n<!--GRID_END_${cols}-->\n`;
    }
  );

  // 1-5. Badge
  result = result.replace(
    /::badge\{([\w-]+)\}\s+([^:]+?)\s*::/g,
    (match, type, text) => {
      return `<!--BADGE_${type.toUpperCase()}-->${text.trim()}<!--/BADGE-->`;
    }
  );

  return result;
}

// ============================================
// 2. 클래스 문법 처리 (HTML 후처리)
// ============================================

function processButtonClasses(html) {
  // 버튼 문법: [텍스트](url){.btn .btn-github width=100%}
  // 또는: [텍스트](url){.btn .btn-github w-full}
  
  return html.replace(
    /<a href="([^"]*)"[^>]*>([^<]*)<\/a>\s*\{\.([^}]+)\}/g,
    (match, href, text, classesStr) => {
      const parts = classesStr.split(/\s+/);
      const classes = [];
      let width = '';
      
      for (const part of parts) {
        // 너비 옵션 처리
        if (part.startsWith('width=')) {
          width = part.substring(6); // 'width=' 제거
        } else if (part.startsWith('w-')) {
          // Tailwind 스타일 (w-full, w-50 등)
          width = part;
        } else {
          // 일반 클래스
          const className = part.replace(/^\./, '');
          if (className.length > 0) {
            classes.push(className);
          }
        }
      }
      
      const classList = classes.join(' ');
      let style = '';
      
      // 너비 계산
      if (width) {
        if (width.includes('%')) {
          style = `width: ${width}; `;
        } else if (width === 'full' || width === 'w-full') {
          style = 'width: 100%; ';
        } else if (width.startsWith('w-')) {
          // w-50 → 50%, w-75 → 75% 등
          const percent = width.substring(2);
          if (!isNaN(percent)) {
            style = `width: ${percent}%; `;
          }
        }
      }
      
      const styleAttr = style ? ` style="${style}"` : '';
      
      return `<a href="${href}" class="${classList}" role="button"${styleAttr}>${text}</a>`;
    }
  );
}

// ============================================
// 3. HTML 후처리
// ============================================

function postprocess(html) {
  let result = html;

  // 3-1. FEATURED
  result = result.replace(
    /<!--FEATURED_START-->\n([\s\S]*?)\n<!--FEATURED_END-->/g,
    (match, content) => {
      return `<section class="featured-section">\n${content}\n</section>`;
    }
  );

  // 3-2. CARD
  result = result.replace(
    /<!--CARD_START-->\n([\s\S]*?)\n<!--CARD_END-->/g,
    (match, content) => {
      return `<div class="container-card">\n${content}\n</div>`;
    }
  );

  // 3-3. GRID
  result = result.replace(
    /<!--GRID_START_(\d)-->\n([\s\S]*?)\n<!--GRID_END_\1-->/g,
    (match, cols, items) => {
      return `<div class="grid grid-${cols}" style="grid-template-columns: repeat(${cols}, 1fr);">\n${items}\n</div>`;
    }
  );

  // 3-4. BADGE
  result = result.replace(
    /<!--BADGE_([\w-]+)-->([^<]*?)<!--\/BADGE-->/g,
    (match, type, text) => {
      const badgeType = type.toLowerCase();
      return `<span class="badge badge-${badgeType}">${text}</span>`;
    }
  );

  // 3-5. 불필요한 <p> 제거
  result = result.replace(/<p>\s*<\/p>/g, '');
  result = result.replace(/<p>(<section[\s\S]*?<\/section>)<\/p>/g, '$1');
  result = result.replace(/<p>(<div class="grid[\s\S]*?<\/div>)<\/p>/g, '$1');
  result = result.replace(/<p>(<div class="container[\s\S]*?<\/div>)<\/p>/g, '$1');
  result = result.replace(/<p>(<span class="badge[\s\S]*?<\/span>)<\/p>/g, '$1');
  
  result = result.replace(/<p><br\s*\/?><\/p>/g, '');
  result = result.replace(/<br\s*\/?>\s*<br\s*\/?>/g, '<br />');
  result = result.replace(/>\s+</g, '>\n<');

  return result.trim();
}

// ============================================
// 4. 메인 변환 함수
// ============================================

async function convertMarkdownToHtml(markdown) {
  try {
    const preprocessed = preprocess(markdown);

    marked.setOptions({
      breaks: true,
      gfm: true,
      pedantic: false
    });

    let html = marked(preprocessed);
    html = processButtonClasses(html);
    html = postprocess(html);

    return html;
  } catch (error) {
    throw new Error(`Conversion failed: ${error.message}`);
  }
}

// ============================================
// 5. 실행
// ============================================

(async () => {
  try {
    let markdown = '';

    process.stdin.setEncoding('utf8');

    process.stdin.on('data', (chunk) => {
      markdown += chunk;
    });

    process.stdin.on('end', async () => {
      try {
        const html = await convertMarkdownToHtml(markdown);
        console.log(html);
        process.exit(0);
      } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });

    setTimeout(() => {
      console.error('Timeout');
      process.exit(1);
    }, 5000);

  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
})();
