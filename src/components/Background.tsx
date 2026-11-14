/**
 * Decorative hero backdrop: faint grid, soft blue light washes and the two
 * wide arcs with node dots that sweep across the page.
 */

type Node = {
  x: number;
  y: number;
  r?: number;
  tick?: number;
};

// Points sit on the arcs below; see the ellipse geometry in <Arcs />.
const nodes: Node[] = [
  { x: 75, y: 534, r: 4.5 },
  { x: 135, y: 603, r: 5, tick: 54 },
  { x: 340, y: 659, r: 4.5, tick: 44 },
  { x: 1320, y: 638, r: 5, tick: 50 },
  { x: 1530, y: 531, r: 4.5 },
];

export default function Background() {
  return (
    <div className="bg-stage" aria-hidden>
      <div className="bg-wash" />
      <div className="bg-grid" />
      <svg
        className="bg-lines"
        viewBox="0 0 1600 1000"
        preserveAspectRatio="xMidYMid slice"
      >
        <ellipse
          cx="800"
          cy="85"
          rx="1010"
          ry="645"
          fill="none"
          stroke="rgba(142,178,234,0.45)"
          strokeWidth="1.2"
        />
        <ellipse
          cx="800"
          cy="40"
          rx="1120"
          ry="700"
          fill="none"
          stroke="rgba(142,178,234,0.3)"
          strokeWidth="1.2"
        />
        {nodes.map((node) => (
          <g key={`${node.x}-${node.y}`}>
            {node.tick ? (
              <line
                x1={node.x}
                y1={node.y}
                x2={node.x}
                y2={node.y + node.tick}
                stroke="rgba(142,178,234,0.4)"
                strokeWidth="1.2"
              />
            ) : null}
            <circle cx={node.x} cy={node.y} r={node.r} fill="#7fb0f7" />
          </g>
        ))}
      </svg>
      <div className="bg-glow" />
    </div>
  );
}
