/**
 * @linkme/templates — Server HTML Renderer
 *
 * Renders the React template to an isolated HTML document for the PDF worker.
 * Injects local font declarations and CSS @page print rules.
 */

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SingleColumnTemplate } from "./SingleColumnTemplate.js";
import type { ResumeDocument } from "./types.js";

export function renderResumeToHtml(resume: ResumeDocument): string {
  const bodyMarkup = renderToStaticMarkup(
    React.createElement(SingleColumnTemplate, { resume }),
  );

  const paperSize = resume.style.paperFormat === "Letter" ? "letter" : "A4";

  return `<!DOCTYPE html>
<html lang="${resume.language}" dir="${resume.direction}">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(resume.title)}</title>
  <style>
    @page {
      size: ${paperSize};
      margin: 0;
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 0;
      background-color: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .linkme-resume-sheet {
      margin: 0 auto;
    }
  </style>
</head>
<body>
  ${bodyMarkup}
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
