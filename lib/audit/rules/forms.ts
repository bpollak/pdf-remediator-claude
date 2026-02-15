import type { AuditFinding } from '@/types/audit';
import type { ParsedPDF } from '@/types/pdf';

/**
 * Form rules: FRM-001 and FRM-002
 */
export function formRules(pdf: ParsedPDF): AuditFinding[] {
  const findings: AuditFinding[] = [];

  // Collect all form fields across pages
  const allFields = pdf.pages.flatMap((page) => page.formFields);

  if (allFields.length === 0) {
    // No form fields in the document - rules are not applicable.
    return findings;
  }

  // FRM-001: Check form fields have labels
  for (const field of allFields) {
    const hasLabel = field.label && field.label.trim().length > 0;
    const hasTooltip = field.tooltip && field.tooltip.trim().length > 0;

    if (!hasLabel && !hasTooltip) {
      findings.push({
        ruleId: 'FRM-001',
        category: 'forms',
        severity: 'critical',
        description: `Form field "${field.name || '(unnamed)'}" of type "${field.type}" on page ${field.pageIndex + 1} has no label or tooltip. Screen reader users will not know what information to enter.`,
        location: {
          pageNumber: field.pageIndex + 1,
          elementType: 'FormField',
          elementDetail: `${field.type} field: "${field.name || '(unnamed)'}"`,
        },
        wcagCriterion: '1.3.1 Info and Relationships',
        recommendation:
          'Add a descriptive label or tooltip to the form field so that assistive technologies can identify its purpose.',
        autoFixable: false,
      });
    }
  }

  // FRM-002: Check if required fields are programmatically indicated
  const requiredFields = allFields.filter((field) => field.required);

  if (requiredFields.length > 0) {
    findings.push({
      ruleId: 'FRM-002',
      category: 'forms',
      severity: 'minor',
      description: `Document contains ${requiredFields.length} required form field(s). Verify that the required status is programmatically communicated and visually indicated beyond just color (e.g., asterisk with legend, "required" text).`,
      location: {
        pageNumber: requiredFields[0].pageIndex + 1,
        elementType: 'FormField',
        elementDetail: `${requiredFields.length} required field(s)`,
      },
      wcagCriterion: '3.3.2 Labels or Instructions',
      recommendation:
        'Ensure required fields are clearly indicated both visually (e.g., asterisk with a legend) and programmatically (via field properties). Do not rely solely on color to indicate required status.',
      autoFixable: false,
    });
  }

  return findings;
}
