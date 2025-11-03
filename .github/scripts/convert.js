#!/usr/bin/env node

/**
 * 마크다운 → HTML 변환 스크립트 (확장 문법 지원)
 * Grid Scrolling - Gap 추가 버전
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

  // 1-2. YouTube 영상 삽입
  result = result.replace(
    /^:::youtube\{([^}]+)\}\s*$/gm,
    (match, videoId) => {
      return `<!--YOUTUBE_${videoId}-->`;
    }
  );

  // 1-3. Featured Section
  result = result.replace(
    /^:::featured\s*\n([\s\S]*?)\n^:::\s*$/gm,
    (match, content) => {
      return `<!--FEATURED_START-->\n${content}\n<!--FEATURED_END-->`;
    }
  );

  // 1-4. Card Section
  result = result.replace(
    /^:::card\s*\n([\s\S]*?)\n^:::\s*$/gm,
    (match, content) => {
      return `<!--CARD_START-->\n${content}\n<!--CARD_END-->`;
    }
  );

  // 1-5. Grid Layout
  result = result.replace(
    /^:::(grid-(?:[1-4](?:-scroll)?))(?:\{([^}]+)\})?\s*\n([\s\S]*?)\n^:::\s*$/gm,
    (match, gridType, gridOptions, content) => {
      // padding 파싱
      let padding = '15px';
      if (gridOptions) {
        const paddingMatch = gridOptions.match(/(?:p|padding)=([^\s}]+)/);
        if (paddingMatch) {
          padding = paddingMatch[1];
        }
      }

      // - 로 시작하는 라인만 필터링
      const lines = content
        .split('\n')
        .filter(line => line.trim().startsWith('-'));

      // 각 라인을 grid-item으로 변환
      const gridItems = lines.map(line => {
        // 앞의 - 제거
        let itemContent = line.replace(/^-\s*/, '').trim();
        
        // marked.parseInline 사용
        let html = marked.parseInline(itemContent);
        
        const innerHtml = html.trim();

        return `<div class="grid-item" data-padding="${padding}">${innerHtml}</div>`;
      });

      return `<!--GRID_START_${gridType}|${gridItems.join('|')}|GRID_END_${gridType}-->`;
    }
  );

  // 1-6. Badge
  result = result.replace(
    /::badge\{([\w-]+)\}\s+([^:]+?)\s*::/g,
    (match, type, text) => {
      return `<!--BADGE_${type.toUpperCase()}-->${text.trim()}<!--/BADGE-->`;
    }
  );

  return result;
}

// ============================================
// 2. 클래스 문법 처리
// ============================================

function processButtonClasses(html) {
  return html.replace(
    /<a href="([^"]*)"[^>]*>([^<]*)<\/a>\s*\{\.([^}]+)\}/g,
    (match, href, text, classesStr) => {
      const parts = classesStr.split(/\s+/);
      const classes = [];
      let width = '';

      for (const part of parts) {
        if (part.startsWith('width=')) {
          width = part.substring(6);
        } else if (part.startsWith('w-')) {
          width = part;
        } else {
          const className = part.replace(/^\./, '');
          if (className.length > 0) {
            classes.push(className);
          }
        }
      }

      const classList = classes.join(' ');
      let style = '';

      if (width) {
        if (width.includes('%')) {
          style = `width: ${width}; `;
        } else if (width === 'full' || width === 'w-full') {
          style = 'width: 100%; ';
        } else if (width.startsWith('w-')) {
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

  // 3-1. YouTube 영상
  result = result.replace(
    /<!--YOUTUBE_([^-]+)-->/g,
    (match, videoId) => {
      return `<div class="youtube-embed">
  <iframe 
    src="https://www.youtube.com/embed/${videoId}" 
    title="YouTube video player" 
    frameborder="0" 
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
    allowfullscreen>
  </iframe>
</div>`;
    }
  );

  // 3-2. FEATURED
  result = result.replace(
    /<!--FEATURED_START-->\n([\s\S]*?)\n<!--FEATURED_END-->/g,
    (match, content) => {
      return `<section class="featured-section">\n${content}\n</section>`;
    }
  );

  // 3-3. CARD
  result = result.replace(
    /<!--CARD_START-->\n([\s\S]*?)\n<!--CARD_END-->/g,
    (match, content) => {
      return `<div class="container-card">\n${content}\n</div>`;
    }
  );

  // 3-4. GRID - 정렬 모드 (grid-1, grid-2, grid-3, grid-4)
  result = result.replace(
    /<!--GRID_START_(grid-[1-4])\|(.*?)\|GRID_END_\1-->/g,
    (match, gridClass, itemsStr) => {
      const items = itemsStr.split('|').join('\n');
      const cols = gridClass.split('-')[1];

      return `<div class="${gridClass} grid" style="display: grid; grid-template-columns: repeat(${cols}, 1fr);">
${items}
</div>`;
    }
  );

  // 3-5. GRID - 스크롤 모드 (grid-1-scroll, grid-2-scroll, grid-3-scroll, grid-4-scroll)
  // ✅ 수정: gap 추가
  result = result.replace(
    /<!--GRID_START_(grid-[1-4]-scroll)\|(.*?)\|GRID_END_\1-->/g,
    (match, gridClass, itemsStr) => {
      const items = itemsStr.split('|').join('\n');
      const cols = gridClass.split('-')[1];
      const itemWidth = `calc(${100 / cols}% - 16px)`;  // 16px는 양쪽 margin 합 (8px + 8px)

      return `<div class="${gridClass} grid-scroll" style="display: flex; overflow-x: auto; gap: 16px; width: 100%; padding-bottom: 10px;">
${items}
</div>
<style>
.${gridClass} .grid-item {
  flex-shrink: 0;
  width: ${itemWidth};
}
</style>`;
    }
  );

  // 3-6. BADGE
  result = result.replace(
    /<!--BADGE_([\w-]+)-->([^<]*?)<!--\/BADGE-->/g,
    (match, type, text) => {
      const badgeType = type.toLowerCase();
      return `<span class="badge badge-${badgeType}">${text}</span>`;
    }
  );

  // 3-7. 불필요한 <p> 제거
  result = result.replace(/<p>\s*<\/p>/g, '');
  result = result.replace(/<p>(<section[\s\S]*?<\/section>)<\/p>/g, '$1');
  result = result.replace(/<p>(<div class="grid[\s\S]*?<\/div>)<\/p>/g, '$1');
  result = result.replace(/<p>(<div class="container[\s\S]*?<\/div>)<\/p>/g, '$1');
  result = result.replace(/<p>(<div class="youtube-embed[\s\S]*?<\/div>)<\/p>/g, '$1');
  result = result.replace(/<p>(<span class="badge[\s\S]*?<\/span>)<\/p>/g, '$1');

  result = result.replace(/<p><br\s*\/?><\/p>/g, '');
  result = result.replace(/<br\s*\/?>\s*<br\s*\/?>/g, '<br />');

  return result.trim();
}

// ============================================
// 4. 메인 변환 함수
// ============================================

async function convertMarkdownToHtml(markdown) {
  try {
    // Step 1: 전처리
    const preprocessed = preprocess(markdown);

    // Step 2: marked 설정
    marked.setOptions({
      breaks: true,
      gfm: true,
      pedantic: false
    });

    // Step 3: marked로 변환
    let html = marked(preprocessed);

    // Step 4: 버튼 클래스 처리
    html = processButtonClasses(html);

    // Step 5: 후처리
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
