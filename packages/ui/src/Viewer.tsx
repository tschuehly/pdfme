import React from 'react';
import { render as reactDomRender } from 'react-dom';
import { PreviewProps } from '@pdfme/common';
import { PreviewUI } from './class.js';
import { DESTROYED_ERR_MSG } from './constants.js';
import Preview from './components/Preview.js';
import AppContextProvider from './components/AppContextProvider.js';

class Viewer extends PreviewUI {
  private onPageChangeCallback?: (pageInfo: { currentPage: number; totalPages: number }) => void;
  private pageCursor: number = 0;

  public onPageChange(cb: (pageInfo: { currentPage: number; totalPages: number }) => void) {
    this.onPageChangeCallback = cb;
  }

  public getPageCursor() {
    return this.pageCursor;
  }

  public getTotalPages() {
    if (!this.domContainer) throw Error(DESTROYED_ERR_MSG);
    return this.template.schemas.length;
  }

  protected render() {
    if (!this.domContainer) throw Error(DESTROYED_ERR_MSG);
    reactDomRender(
      <AppContextProvider
        lang={this.getLang()}
        font={this.getFont()}
        plugins={this.getPluginsRegistry()}
        options={this.getOptions()}
      >
        <Preview
          template={this.template}
          size={this.size}
          inputs={this.inputs}
          showControls={false}
          onPageChange={(pageInfo) => {
            this.pageCursor = pageInfo.currentPage;
            if (this.onPageChangeCallback) {
              this.onPageChangeCallback(pageInfo);
            }
          }}
        />
      </AppContextProvider>,
      this.domContainer,
    );
  }
}

export default Viewer;
