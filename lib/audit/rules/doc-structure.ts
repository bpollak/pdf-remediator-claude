import type { AuditFinding } from '@/types/audit';
import type { ParsedPDF } from '@/types/pdf';

/**
 * Document structure rules: DOC-001 through DOC-005
 * Checks fundamental PDF/UA and document-level accessibility requirements.
 */
export function docStructureRules(pdf: ParsedPDF): AuditFinding[] {
  const findings: AuditFinding[] = [];

  // DOC-001: Check PDF/UA identifier
  if (!pdf.metadata.isPdfUa) {
    findings.push({
      ruleId: 'DOC-001',
      category: 'document-structure',
      severity: 'critical',
      description:
        'Document does not have a PDF/UA identifier. PDF/UA (ISO 14289) conformance is required for universal accessibility.',
      location: { pageNumber: 1, elementType: 'Document' },
      wcagCriterion: '4.1.1 Parsing',
      recommendation:
        'Add a PDF/UA identifier to the document metadata to declare conformance with the PDF/UA standard.',
      autoFixable: true,
    });
  }

  // DOC-002: Check for tag tree (StructTreeRoot)
  if (!pdf.metadata.hasStructTree || pdf.tagTree === null) {
    findings.push({
      ruleId: 'DOC-002',
      category: 'document-structure',
      severity: 'critical',
      description:
        'Document is missing a structure tree (StructTreeRoot). Without tags, assistive technologies cannot interpret the document structure.',
      location: { pageNumber: 1, elementType: 'Document' },
      wcagCriterion: '1.3.1 Info and Relationships',
      recommendation:
        'Tag the document with a proper structure tree. Use Adobe Acrobat or an automated remediation tool to add tags.',
      autoFixable: true,
    });
  }

  // DOC-003: Check document language
  if (!pdf.metadata.language) {
    findings.push({
      ruleId: 'DOC-003',
      category: 'document-structure',
      severity: 'critical',
      description:
        'Document language is not set. Screen readers need the language to select the correct pronunciation rules.',
      location: { pageNumber: 1, elementType: 'Document' },
      wcagCriterion: '3.1.1 Language of Page',
      recommendation:
        'Set the document language in the metadata (e.g., "en" for English, "fr" for French).',
      autoFixable: true,
    });
  }

  // DOC-004: Check document title
  if (!pdf.metadata.title) {
    findings.push({
      ruleId: 'DOC-004',
      category: 'document-structure',
      severity: 'major',
      description:
        'Document title is not set in the metadata. Users and assistive technologies rely on the title to identify the document.',
      location: { pageNumber: 1, elementType: 'Document' },
      wcagCriterion: '2.4.2 Page Titled',
      recommendation:
        'Set a meaningful document title in the PDF metadata properties.',
      autoFixable: true,
    });
  } else if (!pdf.metadata.displayDocTitle) {
    findings.push({
      ruleId: 'DOC-004',
      category: 'document-structure',
      severity: 'minor',
      description:
        'Document has a title but "Display Document Title" is not enabled. The title bar will show the filename instead of the document title.',
      location: { pageNumber: 1, elementType: 'Document' },
      wcagCriterion: '2.4.2 Page Titled',
      recommendation:
        'Enable "Display Document Title" in the document viewer preferences so the title appears in the title bar.',
      autoFixable: true,
    });
  }

  // DOC-005: Reading order
  // If the tag tree exists, we assume reading order follows the tag order.
  // If there is no tag tree, DOC-002 already flags that issue.
  if (pdf.tagTree !== null && pdf.pages.length > 0) {
    // Simplified check: verify the tag tree has child nodes.
    // A tag tree with no children implies an empty/malformed structure.
    if (pdf.tagTree.children.length === 0) {
      findings.push({
        ruleId: 'DOC-005',
        category: 'document-structure',
        severity: 'major',
        description:
          'The tag tree exists but contains no child elements. Reading order cannot be determined from an empty structure tree.',
        location: { pageNumber: 1, elementType: 'Document' },
        wcagCriterion: '1.3.2 Meaningful Sequence',
        recommendation:
          'Ensure the tag tree is fully populated with the correct structure reflecting the logical reading order of the document.',
        autoFixable: false,
      });
    }
    // If the tag tree has children, DOC-005 passes (reading order is assumed correct).
  }

  return findings;
}
