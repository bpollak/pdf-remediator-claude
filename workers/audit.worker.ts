/// <reference lib="webworker" />

const ctx = self as unknown as DedicatedWorkerGlobalScope;

// Since web workers can't use TypeScript path aliases easily,
// we'll implement a simplified version of the audit engine inline

interface AuditRequest {
  type: 'RUN_AUDIT';
  fileId: string;
  parsedData: any; // ParsedPDF - using any to avoid import issues in worker
}

function runAuditRules(parsedData: any): any {
  const findings: any[] = [];
  const metadata = parsedData.metadata;
  const pages = parsedData.pages;
  const tagTree = parsedData.tagTree;
  const outlines = parsedData.outlines;

  // === DOC STRUCTURE RULES ===

  // DOC-001: PDF/UA identifier
  if (!metadata.isPdfUa) {
    findings.push({
      ruleId: 'DOC-001',
      category: 'document-structure',
      severity: 'critical',
      description: 'Document does not have a PDF/UA identifier.',
      location: { pageNumber: 1, elementType: 'Document' },
      wcagCriterion: '4.1.1 Parsing',
      recommendation: 'Add PDF/UA identifier to document metadata.',
      autoFixable: true,
    });
  }

  // DOC-002: Tag tree / StructTreeRoot
  if (!metadata.hasStructTree && !tagTree) {
    findings.push({
      ruleId: 'DOC-002',
      category: 'document-structure',
      severity: 'critical',
      description: 'Document is not tagged. No structure tree (StructTreeRoot) found.',
      location: { pageNumber: 1, elementType: 'Document' },
      wcagCriterion: '1.3.1 Info and Relationships',
      recommendation: 'Add a complete tag structure to the document.',
      autoFixable: true,
    });
  }

  // DOC-003: Document language
  if (!metadata.language) {
    findings.push({
      ruleId: 'DOC-003',
      category: 'document-structure',
      severity: 'critical',
      description: 'Document language is not set.',
      location: { pageNumber: 1, elementType: 'Document' },
      wcagCriterion: '3.1.1 Language of Page',
      recommendation: 'Set the document language (e.g., "en-US") in document properties.',
      autoFixable: true,
    });
  }

  // DOC-004: Document title
  if (!metadata.title) {
    findings.push({
      ruleId: 'DOC-004',
      category: 'document-structure',
      severity: 'major',
      description: 'Document title is not set in metadata.',
      location: { pageNumber: 1, elementType: 'Document' },
      wcagCriterion: '2.4.2 Page Titled',
      recommendation: 'Set a descriptive document title in document properties.',
      autoFixable: true,
    });
  } else if (!metadata.displayDocTitle) {
    findings.push({
      ruleId: 'DOC-004',
      category: 'document-structure',
      severity: 'minor',
      description: 'Document is not set to display the document title (shows filename instead).',
      location: { pageNumber: 1, elementType: 'Document' },
      wcagCriterion: '2.4.2 Page Titled',
      recommendation: 'Set ViewerPreferences to display document title instead of filename.',
      autoFixable: true,
    });
  }

  // DOC-005: Reading order (simplified - just check if tags exist)
  // If no tags, already flagged by DOC-002

  // === HEADING RULES ===

  // Collect heading tags from tag tree
  const headingTags: { type: string; pageIndex: number; hasContent: boolean }[] = [];
  function walkTree(node: any) {
    if (!node) return;
    const type = node.type || node.tag || '';
    if (/^H[1-6]$/i.test(type)) {
      headingTags.push({
        type: type.toUpperCase(),
        pageIndex: node.pageIndex ?? 0,
        hasContent: !!(node.text || (node.children && node.children.length > 0)),
      });
    }
    if (node.children) {
      for (const child of node.children) {
        walkTree(child);
      }
    }
  }
  if (tagTree) walkTree(tagTree);

  // HDG-001: Heading hierarchy
  if (headingTags.length > 0) {
    const levels = headingTags.map(h => parseInt(h.type.charAt(1)));
    for (let i = 1; i < levels.length; i++) {
      if (levels[i] > levels[i - 1] + 1) {
        findings.push({
          ruleId: 'HDG-001',
          category: 'headings',
          severity: 'major',
          description: `Heading hierarchy skips levels: ${headingTags[i-1].type} followed by ${headingTags[i].type} without intermediate level.`,
          location: { pageNumber: headingTags[i].pageIndex + 1, elementType: headingTags[i].type },
          wcagCriterion: '1.3.1 Info and Relationships',
          recommendation: 'Ensure headings follow a logical hierarchy without skipping levels.',
          autoFixable: false,
        });
        break; // Report once
      }
    }
  }

  // HDG-002: No headings in multi-page document
  if (headingTags.length === 0 && metadata.pageCount > 4) {
    findings.push({
      ruleId: 'HDG-002',
      category: 'headings',
      severity: 'major',
      description: 'Document has no heading tags despite having multiple pages.',
      location: { pageNumber: 1, elementType: 'Document' },
      wcagCriterion: '2.4.6 Headings and Labels',
      recommendation: 'Add headings to organize document content into logical sections.',
      autoFixable: true,
    });
  }

  // HDG-003: Empty headings
  for (const h of headingTags) {
    if (!h.hasContent) {
      findings.push({
        ruleId: 'HDG-003',
        category: 'headings',
        severity: 'minor',
        description: `Empty heading tag (${h.type}) found with no text content.`,
        location: { pageNumber: h.pageIndex + 1, elementType: h.type },
        wcagCriterion: '1.3.1 Info and Relationships',
        recommendation: 'Remove empty heading tags or add appropriate content.',
        autoFixable: false,
      });
    }
  }

  // === IMAGE RULES ===

  // Collect Figure tags
  const figureTags: { altText?: string; pageIndex: number }[] = [];
  function walkForFigures(node: any) {
    if (!node) return;
    const type = (node.type || node.tag || '').toLowerCase();
    if (type === 'figure') {
      figureTags.push({
        altText: node.altText || node.attributes?.Alt,
        pageIndex: node.pageIndex ?? 0,
      });
    }
    if (node.children) {
      for (const child of node.children) {
        walkForFigures(child);
      }
    }
  }
  if (tagTree) walkForFigures(tagTree);

  // IMG-001: Missing alt text
  for (const fig of figureTags) {
    if (!fig.altText) {
      findings.push({
        ruleId: 'IMG-001',
        category: 'images',
        severity: 'critical',
        description: 'Image (Figure tag) is missing alternative text.',
        location: { pageNumber: fig.pageIndex + 1, elementType: 'Figure' },
        wcagCriterion: '1.1.1 Non-text Content',
        recommendation: 'Add descriptive alternative text to this image.',
        autoFixable: false,
      });
    }
  }

  // IMG-002: Suspicious alt text
  const suspiciousPatterns = [
    /\.(png|jpg|jpeg|gif|bmp|tiff|svg)$/i,
    /^image\d*$/i,
    /^photo$/i,
    /^picture$/i,
    /^untitled$/i,
    /^IMG_\d+/,
    /^DSC_?\d+/i,
    /^screenshot/i,
  ];
  for (const fig of figureTags) {
    if (fig.altText) {
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(fig.altText.trim())) {
          findings.push({
            ruleId: 'IMG-002',
            category: 'images',
            severity: 'major',
            description: `Image has suspicious alt text: "${fig.altText}". This appears to be a filename or generic placeholder.`,
            location: { pageNumber: fig.pageIndex + 1, elementType: 'Figure' },
            wcagCriterion: '1.1.1 Non-text Content',
            recommendation: 'Replace with meaningful descriptive text that conveys the image content.',
            autoFixable: false,
          });
          break;
        }
      }
    }
  }

  // IMG-003: Images not tagged
  const totalImages = pages.reduce((sum: number, p: any) => sum + (p.imageItems?.length || 0), 0);
  if (totalImages > 0 && figureTags.length === 0 && tagTree) {
    findings.push({
      ruleId: 'IMG-003',
      category: 'images',
      severity: 'minor',
      description: `Document contains ${totalImages} image(s) that are not tagged as Figure or Artifact.`,
      location: { pageNumber: 1, elementType: 'Image' },
      wcagCriterion: '1.1.1 Non-text Content',
      recommendation: 'Tag images as Figure (with alt text) or Artifact (if decorative).',
      autoFixable: true,
    });
  }

  // === TABLE RULES ===

  const tableTags: { hasHeaders: boolean; hasCaption: boolean; wellFormed: boolean; pageIndex: number }[] = [];
  function walkForTables(node: any) {
    if (!node) return;
    const type = (node.type || node.tag || '').toLowerCase();
    if (type === 'table') {
      let hasHeaders = false;
      let hasCaption = false;
      let wellFormed = true;

      function checkTableChildren(n: any) {
        if (!n?.children) return;
        for (const child of n.children) {
          const ct = (child.type || child.tag || '').toLowerCase();
          if (ct === 'th') hasHeaders = true;
          if (ct === 'caption') hasCaption = true;
          if (ct === 'tr') {
            // Check TR has TH or TD children
            if (child.children) {
              for (const cc of child.children) {
                const cct = (cc.type || cc.tag || '').toLowerCase();
                if (cct === 'th') hasHeaders = true;
              }
            }
          }
          checkTableChildren(child);
        }
      }
      checkTableChildren(node);

      // Check well-formed: Table should contain TR
      if (node.children) {
        const childTypes = node.children.map((c: any) => (c.type || c.tag || '').toLowerCase());
        if (!childTypes.includes('tr') && !childTypes.includes('thead') && !childTypes.includes('tbody')) {
          wellFormed = false;
        }
      }

      tableTags.push({ hasHeaders, hasCaption, wellFormed, pageIndex: node.pageIndex ?? 0 });
    }
    if (node.children) {
      for (const child of node.children) {
        walkForTables(child);
      }
    }
  }
  if (tagTree) walkForTables(tagTree);

  for (const table of tableTags) {
    if (!table.wellFormed) {
      findings.push({
        ruleId: 'TBL-001',
        category: 'tables',
        severity: 'major',
        description: 'Table does not use proper Table/TR/TH/TD tag structure.',
        location: { pageNumber: table.pageIndex + 1, elementType: 'Table' },
        wcagCriterion: '1.3.1 Info and Relationships',
        recommendation: 'Restructure table using proper Table, TR, TH, and TD tags.',
        autoFixable: true,
      });
    }
    if (!table.hasHeaders) {
      findings.push({
        ruleId: 'TBL-002',
        category: 'tables',
        severity: 'major',
        description: 'Data table does not have header cells (TH).',
        location: { pageNumber: table.pageIndex + 1, elementType: 'Table' },
        wcagCriterion: '1.3.1 Info and Relationships',
        recommendation: 'Mark the first row or column cells as table headers (TH) with Scope attribute.',
        autoFixable: true,
      });
    }
    if (!table.hasCaption) {
      findings.push({
        ruleId: 'TBL-003',
        category: 'tables',
        severity: 'minor',
        description: 'Table is missing a caption or summary.',
        location: { pageNumber: table.pageIndex + 1, elementType: 'Table' },
        wcagCriterion: '1.3.1 Info and Relationships',
        recommendation: 'Add a caption or summary to describe the table purpose.',
        autoFixable: false,
      });
    }
  }

  // === LIST RULES ===

  // Check for list-like content in text
  let hasListPatterns = false;
  const bulletPatterns = /^[\s]*[•●○■□▪\-–—]\s/;
  const orderedPatterns = /^[\s]*(\d+[.)]\s|[a-zA-Z][.)]\s|\([0-9a-zA-Z]+\)\s)/;

  for (const page of pages) {
    for (const item of page.textItems || []) {
      if (bulletPatterns.test(item.text) || orderedPatterns.test(item.text)) {
        hasListPatterns = true;
        break;
      }
    }
    if (hasListPatterns) break;
  }

  let hasListTags = false;
  function walkForLists(node: any) {
    if (!node) return;
    const type = (node.type || node.tag || '').toLowerCase();
    if (type === 'l') hasListTags = true;
    if (node.children) {
      for (const child of node.children) {
        walkForLists(child);
      }
    }
  }
  if (tagTree) walkForLists(tagTree);

  if (hasListPatterns && !hasListTags) {
    findings.push({
      ruleId: 'LST-001',
      category: 'lists',
      severity: 'major',
      description: 'Document contains list-like content (bullets or numbered items) that is not tagged with proper list structure (L/LI/Lbl/LBody).',
      location: { pageNumber: 1, elementType: 'List' },
      wcagCriterion: '1.3.1 Info and Relationships',
      recommendation: 'Tag list content using L, LI, Lbl, and LBody tags.',
      autoFixable: true,
    });
  }

  // === LINK RULES ===

  const poorLinkTexts = ['click here', 'here', 'read more', 'more', 'link', 'learn more', 'details'];

  for (const page of pages) {
    for (const link of page.links || []) {
      const text = (link.text || '').toLowerCase().trim();
      if (poorLinkTexts.includes(text) || /^https?:\/\//i.test(text)) {
        findings.push({
          ruleId: 'LNK-001',
          category: 'links',
          severity: 'major',
          description: `Link has non-descriptive text: "${link.text || link.url}".`,
          location: { pageNumber: page.pageIndex + 1, elementType: 'Link', elementDetail: link.url },
          wcagCriterion: '2.4.4 Link Purpose (In Context)',
          recommendation: 'Use descriptive link text that indicates the purpose or destination of the link.',
          autoFixable: false,
        });
      }
    }
  }

  // LNK-002: Bookmarks for long documents
  if (metadata.pageCount > 4 && (!outlines || outlines.length === 0)) {
    findings.push({
      ruleId: 'LNK-002',
      category: 'links',
      severity: 'minor',
      description: 'Document has more than 4 pages but no bookmarks/outlines for navigation.',
      location: { pageNumber: 1, elementType: 'Document' },
      wcagCriterion: '2.4.5 Multiple Ways',
      recommendation: 'Add bookmarks/outlines for easier document navigation.',
      autoFixable: true,
    });
  }

  // === COLOR RULES ===

  // CLR-001: Contrast check (simplified - check against white background)
  const checkedColors = new Set<string>();
  for (const page of pages) {
    for (const item of page.textItems || []) {
      const color = item.color || { r: 0, g: 0, b: 0 };
      const key = `${color.r}-${color.g}-${color.b}`;
      if (checkedColors.has(key)) continue;
      checkedColors.add(key);

      // Calculate contrast against white
      const sRGBtoLinear = (c: number) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      const fgL = 0.2126 * sRGBtoLinear(color.r) + 0.7152 * sRGBtoLinear(color.g) + 0.0722 * sRGBtoLinear(color.b);
      const bgL = 1.0; // white
      const ratio = (Math.max(fgL, bgL) + 0.05) / (Math.min(fgL, bgL) + 0.05);

      const fontSize = item.fontSize || 12;
      const isBold = item.isBold || false;
      const isLarge = isBold ? fontSize >= 14 : fontSize >= 18;
      const threshold = isLarge ? 3.0 : 4.5;

      if (ratio < threshold) {
        findings.push({
          ruleId: 'CLR-001',
          category: 'color',
          severity: 'major',
          description: `Text color rgb(${color.r}, ${color.g}, ${color.b}) has insufficient contrast ratio of ${ratio.toFixed(2)}:1 against white background (requires ${threshold}:1).`,
          location: { pageNumber: page.pageIndex + 1, elementType: 'Text' },
          wcagCriterion: '1.4.3 Contrast (Minimum)',
          recommendation: 'Use a darker text color to meet minimum contrast requirements.',
          autoFixable: false,
        });
      }
    }
  }

  // CLR-002: Color-only information (simplified heuristic)
  let hasColoredText = false;
  for (const page of pages) {
    for (const item of page.textItems || []) {
      const c = item.color || { r: 0, g: 0, b: 0 };
      // Check if text is not black/very dark and not white/very light
      if ((c.r > 30 || c.g > 30 || c.b > 30) && (c.r < 225 && c.g < 225 && c.b < 225)) {
        hasColoredText = true;
        break;
      }
    }
    if (hasColoredText) break;
  }

  if (hasColoredText) {
    findings.push({
      ruleId: 'CLR-002',
      category: 'color',
      severity: 'minor',
      description: 'Document contains colored text. Verify that color is not the only means of conveying information.',
      location: { pageNumber: 1, elementType: 'Text' },
      wcagCriterion: '1.4.1 Use of Color',
      recommendation: 'Ensure information conveyed by color is also available through other means (text, patterns, etc.).',
      autoFixable: false,
    });
  }

  // === FORM RULES ===

  const allFormFields = pages.flatMap((p: any) => p.formFields || []);

  for (const field of allFormFields) {
    if (!field.label && !field.tooltip) {
      findings.push({
        ruleId: 'FRM-001',
        category: 'forms',
        severity: 'critical',
        description: `Form field "${field.name || 'unnamed'}" does not have an associated label or tooltip.`,
        location: { pageNumber: field.pageIndex + 1, elementType: 'Form', elementDetail: field.name },
        wcagCriterion: '1.3.1 Info and Relationships',
        recommendation: 'Add a label or tooltip (TU) to describe the form field purpose.',
        autoFixable: false,
      });
    }
  }

  if (allFormFields.some((f: any) => f.required)) {
    findings.push({
      ruleId: 'FRM-002',
      category: 'forms',
      severity: 'minor',
      description: 'Document contains required form fields. Verify they are programmatically indicated.',
      location: { pageNumber: 1, elementType: 'Form' },
      wcagCriterion: '3.3.2 Labels or Instructions',
      recommendation: 'Ensure required fields are indicated both visually and programmatically.',
      autoFixable: false,
    });
  }

  // === METADATA RULES ===

  if (!metadata.subject) {
    findings.push({
      ruleId: 'META-001',
      category: 'metadata',
      severity: 'minor',
      description: 'Document description/subject metadata is not set.',
      location: { pageNumber: 1, elementType: 'Document' },
      wcagCriterion: '2.4.2 Page Titled',
      recommendation: 'Add a subject/description to the document metadata.',
      autoFixable: false,
    });
  }

  if (allFormFields.length > 0) {
    findings.push({
      ruleId: 'META-002',
      category: 'metadata',
      severity: 'minor',
      description: 'Document contains form fields. Verify tab order follows document structure.',
      location: { pageNumber: 1, elementType: 'Document' },
      wcagCriterion: '2.4.3 Focus Order',
      recommendation: 'Set tab order to follow document structure (/Tabs /S on each page).',
      autoFixable: true,
    });
  }

  // Calculate results
  const allRuleIds = [
    'DOC-001', 'DOC-002', 'DOC-003', 'DOC-004', 'DOC-005',
    'HDG-001', 'HDG-002', 'HDG-003',
    'IMG-001', 'IMG-002', 'IMG-003',
    'TBL-001', 'TBL-002', 'TBL-003',
    'LST-001',
    'LNK-001', 'LNK-002',
    'CLR-001', 'CLR-002',
    'FRM-001', 'FRM-002',
    'META-001', 'META-002',
  ];

  const failedRuleIds = Array.from(new Set(findings.map(f => f.ruleId)));
  const passedRuleIds = allRuleIds.filter(id => !failedRuleIds.includes(id));

  const criticalCount = findings.filter(f => f.severity === 'critical').length;
  const majorCount = findings.filter(f => f.severity === 'major').length;
  const minorCount = findings.filter(f => f.severity === 'minor').length;

  const complianceScore = allRuleIds.length > 0
    ? Math.round((passedRuleIds.length / allRuleIds.length) * 1000) / 10
    : 100;

  return {
    findings,
    totalIssues: findings.length,
    criticalCount,
    majorCount,
    minorCount,
    passedRules: passedRuleIds,
    failedRules: failedRuleIds,
    totalApplicableRules: allRuleIds.length,
    complianceScore,
    timestamp: new Date().toISOString(),
  };
}

ctx.addEventListener('message', async (event: MessageEvent<AuditRequest>) => {
  const { type, fileId, parsedData } = event.data;

  if (type !== 'RUN_AUDIT') return;

  try {
    ctx.postMessage({
      type: 'AUDIT_PROGRESS',
      fileId,
      progress: 10,
      message: 'Starting accessibility audit...',
    });

    ctx.postMessage({
      type: 'AUDIT_PROGRESS',
      fileId,
      progress: 30,
      message: 'Checking document structure...',
    });

    ctx.postMessage({
      type: 'AUDIT_PROGRESS',
      fileId,
      progress: 50,
      message: 'Analyzing content accessibility...',
    });

    const result = runAuditRules(parsedData);

    ctx.postMessage({
      type: 'AUDIT_PROGRESS',
      fileId,
      progress: 90,
      message: 'Compiling audit results...',
    });

    ctx.postMessage({
      type: 'AUDIT_PROGRESS',
      fileId,
      progress: 100,
      message: 'Audit complete',
    });

    ctx.postMessage({
      type: 'AUDIT_COMPLETE',
      fileId,
      result,
    });

  } catch (err: any) {
    ctx.postMessage({
      type: 'AUDIT_ERROR',
      fileId,
      error: err.message || 'Unknown audit error',
    });
  }
});
