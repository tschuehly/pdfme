import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  PreviewProps,
  SchemaForUI,
  Size,
  Template,
  getDynamicTemplate,
  replacePlaceholders,
} from '@pdfme/common';
import { getDynamicHeightsForTable } from '@pdfme/schemas/tables';
import Root from './Root.js';
import StaticSchema from './StaticSchema.js';
import ErrorScreen from './ErrorScreen.js';
import Paper from './Paper.js';
import Renderer from './Renderer.js';
import { useUIPreProcessor, useScrollPageCursor } from '../hooks.js';
import { FontContext, OptionsContext } from '../contexts.js';
import { template2SchemasList, useMaxZoom } from '../helper.js';

const _cache = new Map<string | number, unknown>();

const ViewerPreview = ({
  template,
  inputs,
  size,
  onPageChange,
}: Omit<PreviewProps, 'domContainer'> & {
  onPageChange?: (pageInfo: { currentPage: number; totalPages: number }) => void;
  size: Size;
}) => {
  const font = useContext(FontContext);
  const options = useContext(OptionsContext);
  const maxZoom = useMaxZoom();

  const containerRef = useRef<HTMLDivElement>(null);
  const paperRefs = useRef<HTMLDivElement[]>([]);

  const [pageCursor, setPageCursor] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(options.zoomLevel ?? 1);
  const [schemasList, setSchemasList] = useState<SchemaForUI[][]>([[]] as SchemaForUI[][]);

  const { backgrounds, pageSizes, scale, error, refresh } = useUIPreProcessor({
    template,
    size,
    zoomLevel,
    maxZoom,
  });

  const input = inputs[0];
  const latestFontRef = useRef(font);
  const latestInputRef = useRef(input);
  const latestRefreshRef = useRef(refresh);
  const isMountedRef = useRef(true);
  const initRequestIdRef = useRef(0);

  useEffect(() => {
    latestFontRef.current = font;
  }, [font]);

  useEffect(() => {
    latestInputRef.current = input;
  }, [input]);

  useEffect(() => {
    latestRefreshRef.current = refresh;
  }, [refresh]);

  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    [],
  );

  const init = useCallback((nextTemplate: Template) => {
    const requestId = ++initRequestIdRef.current;
    const currentInput = latestInputRef.current;
    const currentRefresh = latestRefreshRef.current;
    getDynamicTemplate({
      template: nextTemplate,
      input: currentInput,
      options: { font: latestFontRef.current },
      _cache,
      getDynamicHeights: (value, args) => {
        switch (args.schema.type) {
          case 'table':
            return getDynamicHeightsForTable(value, args);
          default:
            return Promise.resolve([args.schema.height]);
        }
      },
    })
      .then(async (dynamicTemplate) => {
        const nextSchemasList = await template2SchemasList(dynamicTemplate);
        if (!isMountedRef.current || requestId !== initRequestIdRef.current) {
          return;
        }
        setSchemasList(nextSchemasList);
        await currentRefresh(dynamicTemplate);
      })
      .catch((err) => console.error(`[@pdfme/ui] `, err));
  }, []);

  useEffect(() => {
    if (typeof options.zoomLevel === 'number') {
      setZoomLevel(options.zoomLevel);
    }
  }, [options.zoomLevel]);

  useEffect(() => {
    init(template);
  }, [init, inputs, size, template]);

  useScrollPageCursor({
    ref: containerRef,
    pageSizes,
    scale,
    pageCursor,
    onChangePageCursor: (nextPageCursor) => {
      setPageCursor(nextPageCursor);
      onPageChange?.({ currentPage: nextPageCursor, totalPages: schemasList.length });
    },
  });

  if (error) {
    return <ErrorScreen size={size} error={error} />;
  }

  return (
    <Root size={size} scale={scale}>
      <div ref={containerRef} style={{ ...size, position: 'relative', overflow: 'auto' }}>
        <Paper
          paperRefs={paperRefs}
          scale={scale}
          size={size}
          schemasList={schemasList}
          pageSizes={pageSizes}
          backgrounds={backgrounds}
          renderSchema={({ schema, index }) => {
            const value = schema.readOnly
              ? replacePlaceholders({
                  content: schema.content || '',
                  variables: { ...input, totalPages: schemasList.length, currentPage: index + 1 },
                  schemas: schemasList,
                })
              : String((input && input[schema.name]) || '');
            return (
              <Renderer
                key={schema.id}
                schema={schema}
                basePdf={template.basePdf}
                value={value}
                mode="viewer"
                placeholder={schema.content}
                tabIndex={index + 100}
                onChange={() => {}}
                outline="transparent"
                scale={scale}
              />
            );
          }}
          renderPaper={({ index }) => (
            <StaticSchema
              template={template}
              scale={scale}
              input={input}
              totalPages={schemasList.length}
              currentPage={index + 1}
            />
          )}
        />
      </div>
    </Root>
  );
};

export default ViewerPreview;
