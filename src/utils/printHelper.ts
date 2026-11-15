/**
 * Reliably prints a specific DOM sheet element (e.g. receipt or bank info card)
 * using an isolated hidden print iframe with cloned stylesheets so modal
 * backdrop-blur / overflow containers never clip or hide the printed output.
 */
export function printSheetElement(
  element: HTMLElement | null,
  documentTitle = 'Al-Furqaan'
): void {
  if (!element || typeof document === 'undefined') {
    if (typeof window !== 'undefined') window.print();
    return;
  }

  try {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const frameDoc = iframe.contentDocument || iframe.contentWindow?.document;
    const frameWin = iframe.contentWindow;
    if (!frameDoc || !frameWin) {
      iframe.remove();
      window.print();
      return;
    }

    const headMarkup = Array.from(
      document.querySelectorAll('link[rel="stylesheet"], style')
    )
      .map((node) => node.outerHTML)
      .join('\n');

    frameDoc.open();
    frameDoc.write(`<!doctype html>
<html lang="om">
  <head>
    <meta charset="UTF-8" />
    <title>${documentTitle}</title>
    ${headMarkup}
    <style>
      @page { margin: 12mm; }
      html, body {
        background: #ffffff !important;
        color: #0f172a !important;
        margin: 0 !important;
        padding: 0 !important;
        height: auto !important;
        overflow: visible !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .print-receipt-sheet {
        position: static !important;
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        box-shadow: none !important;
      }
      .no-print { display: none !important; }
    </style>
  </head>
  <body>
    ${element.outerHTML}
  </body>
</html>`);
    frameDoc.close();

    const triggerPrint = () => {
      try {
        frameWin.focus();
        frameWin.print();
      } catch {
        window.print();
      } finally {
        setTimeout(() => {
          iframe.remove();
        }, 1500);
      }
    };

    const images = Array.from(frameDoc.images);
    if (images.length === 0) {
      setTimeout(triggerPrint, 120);
      return;
    }

    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      setTimeout(triggerPrint, 80);
    };

    let remaining = images.length;
    images.forEach((img) => {
      if (img.complete) {
        remaining -= 1;
        if (remaining === 0) done();
      } else {
        const onStep = () => {
          remaining -= 1;
          if (remaining === 0) done();
        };
        img.addEventListener('load', onStep, { once: true });
        img.addEventListener('error', onStep, { once: true });
      }
    });

    setTimeout(done, 1200);
  } catch {
    window.print();
  }
}
