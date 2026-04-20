// Auto-generated project-wide shims to satisfy TypeScript during repair
// NOTE: These are minimal fallbacks to unblock diagnostics. Replace with
// proper `@types/*` packages in the environment when available.

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
