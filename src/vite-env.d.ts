/// <reference types="vite/client" />

declare module "*.md?html" {
  const html: string;
  export default html;
}
