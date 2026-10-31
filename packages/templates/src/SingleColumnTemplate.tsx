/**
 * @linkme/templates — Single Column ATS Template
 *
 * Designed for 100% ATS readability, clean typography, and bilingual LTR/RTL support.
 * - Arabic: text-align start, no kashida (tatweel).
 * - Contact info: isolated with <bdi dir="ltr">.
 * - Fonts: strictly bundled open fonts.
 * - React DOM escaped nodes (no dangerouslySetInnerHTML, zero DOMPurify required).
 */

import React from "react";
import type { ResumeDocument } from "./types.js";

export interface SingleColumnTemplateProps {
  resume: ResumeDocument;
  className?: string;
}

export const SingleColumnTemplate: React.FC<SingleColumnTemplateProps> = ({
  resume,
  className = "",
}) => {
  const isRtl = resume.direction === "rtl";
  const fontFamily = resume.style.fontFamily;
  const fontSize = resume.style.fontSize;
  const primaryColor = resume.style.primaryColor;
  const lineSpacing = resume.style.lineSpacing;
  const margins = `${resume.style.margins}mm`;

  return (
    <div
      className={`linkme-resume-sheet ${className}`}
      dir={resume.direction}
      lang={resume.language}
      style={{
        fontFamily: `"${fontFamily}", system-ui, sans-serif`,
        fontSize: `${fontSize}pt`,
        lineHeight: lineSpacing,
        color: "#1e293b",
        padding: margins,
        boxSizing: "border-box",
        width: resume.style.paperFormat === "Letter" ? "8.5in" : "210mm",
        minHeight: resume.style.paperFormat === "Letter" ? "11in" : "297mm",
        backgroundColor: "#ffffff",
        textAlign: "start",
      }}
    >
      {/* Header Section */}
      <header
        style={{
          borderBottom: `2px solid ${primaryColor}`,
          paddingBottom: "12px",
          marginBottom: "16px",
        }}
      >
        <h1
          style={{
            fontSize: `${fontSize * 1.8}pt`,
            fontWeight: 700,
            color: primaryColor,
            margin: 0,
            textAlign: "start",
          }}
        >
          {resume.fullName}
        </h1>

        {resume.headline && (
          <p
            style={{
              fontSize: `${fontSize * 1.2}pt`,
              fontWeight: 600,
              color: "#475569",
              margin: "4px 0 0 0",
              textAlign: "start",
            }}
          >
            {resume.headline}
          </p>
        )}

        {/* Contact Strip — LTR isolated */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            marginTop: "8px",
            fontSize: `${fontSize * 0.9}pt`,
            color: "#64748b",
          }}
        >
          {resume.contact.email && (
            <span>
              <bdi dir="ltr">{resume.contact.email}</bdi>
            </span>
          )}
          {resume.contact.phone && (
            <span>
              • <bdi dir="ltr">{resume.contact.phone}</bdi>
            </span>
          )}
          {resume.contact.location && <span>• {resume.contact.location}</span>}
          {resume.contact.website && (
            <span>
              • <bdi dir="ltr">{resume.contact.website}</bdi>
            </span>
          )}
        </div>
      </header>

      {/* Summary */}
      {resume.summary && (
        <section style={{ marginBottom: "16px" }}>
          <h2
            style={{
              fontSize: `${fontSize * 1.15}pt`,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: isRtl ? "0" : "0.05em",
              color: primaryColor,
              borderBottom: "1px solid #e2e8f0",
              paddingBottom: "4px",
              marginBottom: "8px",
              textAlign: "start",
            }}
          >
            {isRtl ? "الملخص المهني" : "Professional Summary"}
          </h2>
          <p style={{ margin: 0, textAlign: "start" }}>{resume.summary}</p>
        </section>
      )}

      {/* Experience */}
      {resume.experiences.length > 0 && (
        <section style={{ marginBottom: "16px" }}>
          <h2
            style={{
              fontSize: `${fontSize * 1.15}pt`,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: isRtl ? "0" : "0.05em",
              color: primaryColor,
              borderBottom: "1px solid #e2e8f0",
              paddingBottom: "4px",
              marginBottom: "8px",
              textAlign: "start",
            }}
          >
            {isRtl ? "الخبرات العملية" : "Work Experience"}
          </h2>

          {resume.experiences.map((exp) => (
            <div
              key={exp.id}
              style={{
                marginBottom: "12px",
                breakInside: "avoid",
                pageBreakInside: "avoid",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                }}
              >
                <span style={{ fontWeight: 700, color: "#0f172a" }}>
                  {exp.role}
                </span>
                <span
                  style={{
                    fontSize: `${fontSize * 0.85}pt`,
                    color: "#64748b",
                  }}
                >
                  <bdi dir="ltr">
                    {exp.startDate} –{" "}
                    {exp.isCurrent ? (isRtl ? "الآن" : "Present") : exp.endDate}
                  </bdi>
                </span>
              </div>

              <div
                style={{
                  fontSize: `${fontSize * 0.95}pt`,
                  color: "#334155",
                  fontStyle: "italic",
                  marginBottom: "4px",
                }}
              >
                {exp.company}
                {exp.location ? ` — ${exp.location}` : ""}
              </div>

              {exp.bullets.length > 0 && (
                <ul
                  style={{
                    margin: "4px 0 0 0",
                    paddingInlineStart: "20px",
                    textAlign: "start",
                  }}
                >
                  {exp.bullets.map((bullet, idx) => (
                    <li key={idx} style={{ marginBottom: "2px" }}>
                      {bullet}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Education */}
      {resume.educations.length > 0 && (
        <section style={{ marginBottom: "16px" }}>
          <h2
            style={{
              fontSize: `${fontSize * 1.15}pt`,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: isRtl ? "0" : "0.05em",
              color: primaryColor,
              borderBottom: "1px solid #e2e8f0",
              paddingBottom: "4px",
              marginBottom: "8px",
              textAlign: "start",
            }}
          >
            {isRtl ? "التعليم والمؤهلات" : "Education"}
          </h2>

          {resume.educations.map((edu) => (
            <div
              key={edu.id}
              style={{
                marginBottom: "8px",
                breakInside: "avoid",
                pageBreakInside: "avoid",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                }}
              >
                <span style={{ fontWeight: 700 }}>{edu.degree}</span>
                {edu.graduationYear && (
                  <span
                    style={{
                      fontSize: `${fontSize * 0.85}pt`,
                      color: "#64748b",
                    }}
                  >
                    <bdi dir="ltr">{edu.graduationYear}</bdi>
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: `${fontSize * 0.95}pt`,
                  color: "#334155",
                }}
              >
                {edu.institution}
                {edu.location ? ` — ${edu.location}` : ""}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Skills */}
      {resume.skills.length > 0 && (
        <section style={{ marginBottom: "16px" }}>
          <h2
            style={{
              fontSize: `${fontSize * 1.15}pt`,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: isRtl ? "0" : "0.05em",
              color: primaryColor,
              borderBottom: "1px solid #e2e8f0",
              paddingBottom: "4px",
              marginBottom: "8px",
              textAlign: "start",
            }}
          >
            {isRtl ? "المهارات" : "Skills"}
          </h2>

          {resume.skills.map((cat) => (
            <div key={cat.id} style={{ marginBottom: "4px" }}>
              <span style={{ fontWeight: 700, color: "#1e293b" }}>
                {cat.category}:{" "}
              </span>
              <span style={{ color: "#334155" }}>{cat.skills.join(" • ")}</span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
};
