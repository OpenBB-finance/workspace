export const Document = ({ children }) => (
  <div data-testid="pdf-document">{children}</div>
);
export const Page = () => <div data-testid="pdf-page" />;
export const pdfjs = { GlobalWorkerOptions: { workerSrc: "" } };
