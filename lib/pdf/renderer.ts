import * as pdfjsLib from 'pdfjs-dist';

export async function renderPageToCanvas(
  pdfBytes: ArrayBuffer,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number = 1.5
): Promise<void> {
  const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not get canvas context');

  await page.render({
    canvas: null,
    canvasContext: context,
    viewport,
  }).promise;
}

export async function getPageCount(pdfBytes: ArrayBuffer): Promise<number> {
  const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
  const pdf = await loadingTask.promise;
  return pdf.numPages;
}
