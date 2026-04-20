// Workspace-wide minimal type shims to help TypeScript diagnostics
// These are temporary fallbacks until proper types are installed.

declare module '*.css';

declare module 'react' {
  const React: any;
  export default React;
  export * from 'react';
}

declare module 'react-dom' {
  const ReactDOM: any;
  export default ReactDOM;
}

declare module 'react-markdown' {
  const md: any;
  export default md;
}

declare module 'remark-gfm';
declare module 'rehype-raw';
declare module 'shiki';
declare module '@shikijs/rehype';

declare module 'astro/jsx-runtime' {
  export type JSX = any;
}

interface ImportMeta {
  env: Record<string, any>;
}

declare namespace JSX {
  interface IntrinsicElements {
    [key: string]: any;
  }
}

declare global {
  interface Window {
    __whitepapperCopyInit?: boolean;
    __whitepapperBindCopyButtons?: (() => void) | undefined;
  }
}

export {};
