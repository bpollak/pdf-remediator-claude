import type { AuditFinding } from '@/types/audit';
import type { ParsedPDF } from '@/types/pdf';

/**
 * Metadata rules: META-001 and META-002
 */
export function metadataRules(pdf: ParsedPDF): AuditFinding[] {
  const findings: AuditFinding[] = [];

  // META-001: Check for document description/subject
  if (!pdf.metadata.subject || pdf.metadata.subject.trim().length === 0) {
    findings.push({
      ruleId: 'META-001',
      category: 'metadata',
      severity: 'minor',
      description:
        'Document metadata does not include a subject or description. A description helps users and search engines understand the document purpose.',
      location: {
        pageNumber: 1,
        elementType: 'Document',
        elementDetail: 'Missing subject/description',
      },
      wcagCriterion: '2.4.2 Page Titled',
      recommendation:
        'Add a meaningful subject or description in the document metadata properties.',
      autoFixable: false,
    });
  }

  // META-002: Tab order follows structure
  // We cannot reliably determine the /Tabs /S setting from parsed data.
  // Flag as a reminder if the document has form fields.
  const hasFormFields = pdf.pages.some(
    (page) => page.formFields.length > 0
  );

  if (hasFormFields) {
    findings.push({
      ruleId: 'META-002',
      category: 'metadata',
      severity: 'minor',
      description:
        'Document contains form fields. Verify that the tab order for each page is set to follow the document structure (/Tabs /S) rather than row or column order. Incorrect tab order can cause keyboard users to navigate fields in an unexpected sequence.',
      location: {
        pageNumber: 1,
        elementType: 'Document',
        elementDetail: 'Tab order configuration',
      },
      wcagCriterion: '2.4.3 Focus Order',
      recommendation:
        'Set the tab order for each page to "Use Document Structure" (/Tabs /S) to ensure form fields are navigated in a logical order matching the reading flow.',
      autoFixable: true,
    });
  }

  return findings;
}
