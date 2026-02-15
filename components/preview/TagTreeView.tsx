'use client';

import { useState } from 'react';

interface TagNode {
  tag: string;
  text?: string;
  children: TagNode[];
  pageIndex?: number;
}

interface TagTreeViewProps {
  tree: TagNode | null;
}

function TreeNode({ node, depth = 0 }: { node: TagNode; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div style={{ paddingLeft: `${depth * 16}px` }}>
      <button
        onClick={() => hasChildren && setExpanded(!expanded)}
        className="flex items-center gap-1 py-0.5 text-sm hover:bg-muted/50 rounded px-1 w-full text-left"
        aria-expanded={hasChildren ? expanded : undefined}
      >
        {hasChildren ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`h-3 w-3 transition-transform ${expanded ? 'rotate-90' : ''}`} aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        ) : (
          <span className="w-3" />
        )}
        <span className="font-mono text-xs text-primary">&lt;{node.tag}&gt;</span>
        {node.text && (
          <span className="text-xs text-muted-foreground truncate ml-1 max-w-[200px]">
            {node.text.slice(0, 60)}{node.text.length > 60 ? '...' : ''}
          </span>
        )}
        {node.pageIndex !== undefined && (
          <span className="text-xs text-muted-foreground ml-auto">p.{node.pageIndex + 1}</span>
        )}
      </button>
      {expanded && hasChildren && (
        <div>
          {node.children.map((child, i) => (
            <TreeNode key={`${child.tag}-${i}`} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function TagTreeView({ tree }: TagTreeViewProps) {
  if (!tree) {
    return (
      <div className="text-sm text-muted-foreground p-4">
        No tag tree available. The document may not have structural tags.
      </div>
    );
  }

  return (
    <div className="overflow-auto max-h-[600px] p-2">
      <h3 className="font-semibold text-sm mb-2">Document Structure</h3>
      <TreeNode node={tree} />
    </div>
  );
}
