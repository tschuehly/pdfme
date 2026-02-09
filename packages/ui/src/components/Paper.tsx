import React, { MutableRefObject, ReactNode, useContext } from 'react';
import { ZOOM, SchemaForUI, Size, getFallbackFontName } from '@pdfme/common';
import { FontContext } from '../contexts.js';
import { RULER_HEIGHT, PAGE_GAP } from '../constants.js';

const Paper = (props: {
  paperRefs: MutableRefObject<HTMLDivElement[]>;
  scale: number;
  size: Size;
  schemasList: SchemaForUI[][];
  pageSizes: Size[];
  backgrounds: string[];
  renderPaper: (arg: { index: number; paperSize: Size }) => ReactNode;
  renderSchema: (arg: { index: number; schema: SchemaForUI }) => ReactNode;
  hasRulers?: boolean;
}) => {
  const {
    paperRefs,
    scale,
    size,
    schemasList,
    pageSizes,
    backgrounds,
    renderPaper,
    renderSchema,
    hasRulers,
  } = props;
  const font = useContext(FontContext);
  const rulerHeight = hasRulers ? RULER_HEIGHT : 0;

  if (pageSizes.length !== backgrounds.length || pageSizes.length !== schemasList.length) {
    return null;
  }

  // Compute total unscaled content height for proper layout sizing
  const maxPaperWidth = Math.max(...pageSizes.map(ps => ps.width * ZOOM));
  const totalPaperHeight = pageSizes.reduce((sum, ps, i) => {
    const h = ps.height * ZOOM;
    const top = i > 0 ? (rulerHeight + PAGE_GAP) * (i + 1) : rulerHeight;
    return Math.max(sum, top + h);
  }, 0);

  return (
    <div
      style={{
        width: maxPaperWidth * scale,
        height: totalPaperHeight * scale,
        overflow: 'visible',
      }}
    >
    <div
      style={{
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        width: maxPaperWidth,
        height: totalPaperHeight,
      }}
    >
      {backgrounds.map((background, paperIndex) => {
        const pageSize = pageSizes[paperIndex];
        const paperSize = { width: pageSize.width * ZOOM, height: pageSize.height * ZOOM };

        // We want to center the content within the available viewport, but transform: scale()
        // must be done from the top-left or CSS crops off left-hand content as you zoom in.
        // However, we want to display the content centrally, so we apply a left indent for
        // when the content does not exceed its container
        const leftCenteringIndent =
          paperSize.width * scale + rulerHeight < size.width
            ? `${(size.width / scale - paperSize.width) / 2}px`
            : `${rulerHeight}px`;

        // Rulers are drawn above/before the top of each page, so each Paper div must have
        // a top offset considering them.
        let pageTop = paperIndex > 0 ? (rulerHeight + PAGE_GAP) * (paperIndex + 1) : rulerHeight;

        if (!hasRulers) {
          // No extra gap for Preview/Form — keep content flush
        }

        return (
          <div
            key={String(paperIndex) + JSON.stringify(paperSize)}
            ref={(e) => {
              if (e) {
                paperRefs.current[paperIndex] = e;
              }
            }}
            onMouseDown={(e) => {
              if (
                e.currentTarget === e.target &&
                document &&
                document.hasFocus() &&
                document.activeElement instanceof HTMLElement
              ) {
                document.activeElement.blur();
              }
            }}
            style={{
              fontFamily: `'${getFallbackFontName(font)}'`,
              top: `${pageTop}px`,
              left: leftCenteringIndent,
              position: 'relative',
              backgroundImage: `url(${background})`,
              backgroundSize: `${paperSize.width}px ${paperSize.height}px`,
              boxShadow: '4px 4px 16px 4px rgba(0, 0, 0, 0.08)',
              padding: '1rem',
              borderRadius: 24,
              overflow: 'hidden',
              ...paperSize,
            }}
          >
            {renderPaper({ paperSize, index: paperIndex })}
            {schemasList[paperIndex].map((schema, schemaIndex) => {
              return (
                <div key={schema.id}>
                  {renderSchema({
                    schema,
                    index:
                      paperIndex === 0
                        ? schemaIndex
                        : schemaIndex + schemasList[paperIndex - 1].length,
                  })}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
    </div>
  );
};

export default Paper;
