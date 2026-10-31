import React, { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Compass,
  Maximize2,
  Minimize2,
  Plus,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { EntryDomain, MemoryEntry } from '../types/memory';

interface ConstellationViewProps {
  memories: MemoryEntry[];
  selectedMemoryId: string | null;
  onSelectMemory: (entry: MemoryEntry) => void;
  onOpenReader: (entry: MemoryEntry) => void;
  onToggleConnection: (sourceId: string, targetId: string) => void;
  onOpenCapture: () => void;
}

type LayoutProjection = 'domains' | 'gravity';

const DOMAIN_ANCHORS: Record<EntryDomain, { x: number; y: number; color: string }> = {
  Architecture: { x: 240, y: 170, color: '#74A57F' },
  Philosophy: { x: 520, y: 150, color: '#B58ACE' },
  Design: { x: 740, y: 230, color: '#5E8F69' },
  Nature: { x: 230, y: 400, color: '#74A57F' },
  Science: { x: 520, y: 420, color: '#9F71BA' },
  Literature: { x: 750, y: 410, color: '#B58ACE' },
  Personal: { x: 480, y: 290, color: '#74A57F' },
};

export const ConstellationView: React.FC<ConstellationViewProps> = ({
  memories,
  selectedMemoryId,
  onSelectMemory,
  onOpenReader,
  onToggleConnection,
  onOpenCapture,
}) => {
  const [projection, setProjection] = useState<LayoutProjection>('domains');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [activeDomainFilter, setActiveDomainFilter] = useState<EntryDomain | 'All'>('All');
  const [zoom, setZoom] = useState<number>(1);
  const [linkTargetMode, setLinkTargetMode] = useState<boolean>(false);

  const activeEntry = useMemo(
    () => memories.find((m) => m.id === selectedMemoryId) || memories[0] || null,
    [memories, selectedMemoryId]
  );

  const nodes = useMemo(() => {
    const centerX = 480;
    const centerY = 290;

    return memories.map((entry, idx) => {
      const year = new Date(entry.createdAt).getFullYear() || new Date().getFullYear();
      const angle = (idx / Math.max(1, memories.length)) * Math.PI * 2 - Math.PI / 2;

      let x = centerX;
      let y = centerY;

      if (projection === 'domains') {
        const anchor = DOMAIN_ANCHORS[entry.domain] || { x: centerX, y: centerY };
        const localAngle = ((idx * 137.5) % 360) * (Math.PI / 180);
        const radius = memories.length === 1 ? 0 : 42 + (idx % 3) * 28;
        x = anchor.x + Math.cos(localAngle) * radius;
        y = anchor.y + Math.sin(localAngle) * radius;
      } else {
        const degree = entry.connectedIds.length;
        const gravityRadius = memories.length === 1 ? 0 : Math.max(55, 220 - degree * 34);
        x = centerX + Math.cos(angle) * gravityRadius * 1.3;
        y = centerY + Math.sin(angle) * gravityRadius * 0.85;
      }

      return {
        entry,
        x: Math.max(70, Math.min(890, x)),
        y: Math.max(55, Math.min(525, y)),
        color: DOMAIN_ANCHORS[entry.domain]?.color || '#74A57F',
        year,
      };
    });
  }, [memories, projection]);

  const edges = useMemo(() => {
    const pairSet = new Set<string>();
    const list: Array<{
      id: string;
      source: (typeof nodes)[0];
      target: (typeof nodes)[0];
    }> = [];

    const nodeMap = new Map<string, (typeof nodes)[0]>(nodes.map((n) => [n.entry.id, n]));

    nodes.forEach((sourceNode) => {
      sourceNode.entry.connectedIds.forEach((targetId) => {
        const targetNode = nodeMap.get(targetId);
        if (!targetNode) return;
        const key = [sourceNode.entry.id, targetId].sort().join('--');
        if (!pairSet.has(key)) {
          pairSet.add(key);
          list.push({ id: key, source: sourceNode, target: targetNode });
        }
      });
    });

    return list;
  }, [nodes]);

  const focusId = hoveredId || activeEntry?.id || null;

  const isNodeHighlighted = (id: string, domain: EntryDomain) => {
    if (activeDomainFilter !== 'All' && domain !== activeDomainFilter) return false;
    if (!focusId) return true;
    if (id === focusId) return true;
    const focused = memories.find((m) => m.id === focusId);
    return focused ? focused.connectedIds.includes(id) : true;
  };

  if (memories.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-2xl p-12 text-center space-y-4">
        <h2 className="font-display text-xl text-zinc-900 dark:text-zinc-100">
          Your Constellation is Empty
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
          Add memories, ideas, or daily logs to visualize how your thoughts cluster by category and connect across time.
        </p>
        <div className="pt-2">
          <button
            type="button"
            onClick={onOpenCapture}
            className="px-4 py-2 text-xs font-medium text-white bg-[#74A57F] hover:bg-[#5e8f69] rounded-lg transition-colors inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create First Entry</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h2 className="text-xl font-medium tracking-tight text-zinc-900 dark:text-zinc-100">
            Constellation
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Visualize and connect related memories and ideas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg border border-zinc-200/80 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setProjection('domains')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                projection === 'domains'
                  ? 'bg-[#74A57F] text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              By Category
            </button>
            <button
              type="button"
              onClick={() => setProjection('gravity')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                projection === 'gravity'
                  ? 'bg-[#74A57F] text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              By Connections
            </button>
          </div>

          <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg border border-zinc-200/80 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.8, +(z - 0.15).toFixed(2)))}
              title="Zoom Out"
              className="p-1.5 text-zinc-600 dark:text-zinc-400 hover:text-[#74A57F] rounded-md transition-colors"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 font-mono text-xs text-zinc-600 dark:text-zinc-400 tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(1.45, +(z + 0.15).toFixed(2)))}
              title="Zoom In"
              className="p-1.5 text-zinc-600 dark:text-zinc-400 hover:text-[#74A57F] rounded-md transition-colors"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(1);
                setActiveDomainFilter('All');
              }}
              title="Reset View"
              className="p-1.5 text-zinc-600 dark:text-zinc-400 hover:text-[#74A57F] rounded-md transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-8 flex flex-col justify-between bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800/80 overflow-x-auto">
            <div className="flex items-center gap-1.5">
              {(
                [
                  'All',
                  'Personal',
                  'Design',
                  'Architecture',
                  'Philosophy',
                  'Nature',
                  'Science',
                  'Literature',
                ] as const
              ).map((domain) => (
                <button
                  key={domain}
                  type="button"
                  onClick={() => setActiveDomainFilter(domain)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    activeDomainFilter === domain
                      ? 'bg-[#74A57F] text-white'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  {domain}
                </button>
              ))}
            </div>

            {activeEntry && memories.length > 1 && (
              <button
                type="button"
                onClick={() => setLinkTargetMode((prev) => !prev)}
                className={`px-3 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                  linkTargetMode
                    ? 'bg-[#B58ACE] text-white border-[#B58ACE]'
                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-[#74A57F]'
                }`}
              >
                {linkTargetMode
                  ? `Click a node to link/unlink with ${activeEntry.indexCode}`
                  : 'Link Nodes'}
              </button>
            )}
          </div>

          <div className="relative w-full h-[480px] bg-zinc-50/60 dark:bg-zinc-950/60 overflow-hidden">
            <svg viewBox="0 0 960 580" className="w-full h-full select-none">
              <g
                transform={`translate(${480 * (1 - zoom)}, ${290 * (1 - zoom)}) scale(${zoom})`}
                className="transition-transform duration-200"
              >
                {projection === 'domains' &&
                  Object.entries(DOMAIN_ANCHORS).map(([domain, anchor]) => (
                    <g key={domain}>
                      <circle
                        cx={anchor.x}
                        cy={anchor.y}
                        r={72}
                        fill="none"
                        stroke="currentColor"
                        className="text-zinc-200/70 dark:text-zinc-800/50"
                        strokeDasharray="2 4"
                      />
                      <text
                        x={anchor.x}
                        y={anchor.y - 80}
                        textAnchor="middle"
                        className="fill-zinc-400 dark:fill-zinc-500 font-sans text-[11px] font-medium"
                      >
                        {domain}
                      </text>
                    </g>
                  ))}

                {edges.map((edge) => {
                  const isDirectlyConnected =
                    focusId === edge.source.entry.id || focusId === edge.target.entry.id;

                  return (
                    <line
                      key={edge.id}
                      x1={edge.source.x}
                      y1={edge.source.y}
                      x2={edge.target.x}
                      y2={edge.target.y}
                      stroke={isDirectlyConnected ? '#B58ACE' : 'currentColor'}
                      className={
                        isDirectlyConnected
                          ? 'text-[#B58ACE]'
                          : 'text-zinc-300 dark:text-zinc-800'
                      }
                      strokeWidth={isDirectlyConnected ? 2 : 1}
                      strokeOpacity={isDirectlyConnected ? 0.9 : 0.45}
                    />
                  );
                })}

                {nodes.map((node) => {
                  const isSelected = activeEntry?.id === node.entry.id;
                  const isHighlighted = isNodeHighlighted(node.entry.id, node.entry.domain);
                  const radius = 8 + Math.min(8, node.entry.connectedIds.length * 1.8);

                  return (
                    <g
                      key={node.entry.id}
                      transform={`translate(${node.x}, ${node.y})`}
                      onMouseEnter={() => setHoveredId(node.entry.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      onClick={() => {
                        if (linkTargetMode && activeEntry && activeEntry.id !== node.entry.id) {
                          onToggleConnection(activeEntry.id, node.entry.id);
                        } else {
                          onSelectMemory(node.entry);
                        }
                      }}
                      className="cursor-pointer"
                      style={{ opacity: isHighlighted ? 1 : 0.22 }}
                    >
                      {isSelected && (
                        <circle
                          r={radius + 7}
                          fill="none"
                          stroke="#B58ACE"
                          strokeWidth="2"
                          strokeOpacity="0.8"
                        />
                      )}

                      <circle
                        r={radius}
                        fill={isSelected ? '#B58ACE' : '#74A57F'}
                        className="transition-colors"
                      />

                      <circle
                        r={3}
                        fill="#FFFFFF"
                        fillOpacity={
                          node.entry.kind === 'idea' || node.entry.kind === 'epiphany'
                            ? 0.9
                            : 0.45
                        }
                      />

                      <text
                        y={radius + 14}
                        textAnchor="middle"
                        className="fill-zinc-500 dark:fill-zinc-400 font-mono text-[10px]"
                      >
                        {node.entry.indexCode} · {node.year}
                      </text>
                      <text
                        y={radius + 27}
                        textAnchor="middle"
                        className="fill-zinc-900 dark:fill-zinc-100 font-sans text-[11px] font-medium"
                      >
                        {node.entry.title.length > 26
                          ? `${node.entry.title.slice(0, 26)}…`
                          : node.entry.title}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>

          <div className="px-4 py-2.5 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-4 text-xs text-zinc-500 dark:text-zinc-400">
            <div className="flex items-center gap-3 font-mono tabular-nums">
              <span>{memories.length} nodes</span>
              <span aria-hidden="true">·</span>
              <span>{edges.length} connections</span>
            </div>
            <div>Click a node to inspect or link entries</div>
          </div>
        </div>

        <div className="lg:col-span-4 bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-xl p-6 flex flex-col justify-between">
          {activeEntry ? (
            <div className="space-y-5">
              <div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 font-mono tabular-nums">
                  <span className="text-[#74A57F] font-medium">{activeEntry.indexCode}</span>
                  <span aria-hidden="true">·</span>
                  <span className="capitalize font-sans">{activeEntry.kind}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-sans">{activeEntry.domain}</span>
                  <span aria-hidden="true">·</span>
                  <span>{activeEntry.createdAt}</span>
                </div>

                <h3 className="font-display text-xl font-normal text-zinc-900 dark:text-zinc-100 mt-2 leading-snug">
                  {activeEntry.title}
                </h3>

                {activeEntry.location && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-[#74A57F]" />
                    <span>{activeEntry.location}</span>
                  </p>
                )}
              </div>

              <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                {activeEntry.excerpt}
              </p>

              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80">
                <div className="text-xs text-zinc-400 dark:text-zinc-500 mb-1">Tags</div>
                <div className="text-xs text-[#74A57F] dark:text-[#B58ACE] font-mono">
                  {activeEntry.tags.join(' · ')}
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                  <span>Connected Entries</span>
                  <span className="font-mono tabular-nums">{activeEntry.connectedIds.length}</span>
                </div>

                {activeEntry.connectedIds.length === 0 ? (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 py-1">
                    No connections yet.
                  </p>
                ) : (
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
                    {activeEntry.connectedIds.map((connId) => {
                      const target = memories.find((m) => m.id === connId);
                      if (!target) return null;
                      return (
                        <button
                          key={target.id}
                          type="button"
                          onClick={() => onSelectMemory(target)}
                          className="w-full py-2 text-left group flex items-start justify-between gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 px-2 -mx-2 rounded-lg transition-colors"
                        >
                          <div className="min-w-0">
                            <div className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500 tabular-nums">
                              {target.indexCode} · {target.createdAt}
                            </div>
                            <div className="text-xs font-medium text-zinc-800 dark:text-zinc-200 group-hover:text-[#74A57F] truncate mt-0.5">
                              {target.title}
                            </div>
                          </div>
                          <ArrowUpRight className="w-3.5 h-3.5 text-zinc-400 group-hover:text-[#74A57F] shrink-0 mt-1" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {activeEntry && (
            <div className="pt-5 mt-5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-3">
              <div className="text-xs text-zinc-400 font-mono tabular-nums">
                Revisited {activeEntry.revisitedCount}×
              </div>
              <button
                type="button"
                onClick={() => onOpenReader(activeEntry)}
                className="px-4 py-2 text-xs font-medium text-white bg-[#74A57F] hover:bg-[#5e8f69] rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Open Entry</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
