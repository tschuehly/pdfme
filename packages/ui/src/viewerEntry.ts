// Viewer-only entry point - excludes Designer and Form dependencies
import ViewerComponent from './Viewer.js';
export type { PreviewProps } from '@pdfme/common';

// Export as both named and default for compatibility
export { ViewerComponent as Viewer };
export default ViewerComponent;
