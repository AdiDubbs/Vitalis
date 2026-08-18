/* Ranked confidence, drawn in the shared sage-to-terracotta gradient. */
function ConfidenceDial({ value, size = 164, id = "confidence-dial" }) {
  const percent = Math.round(value * 100);
  const center = size / 2;
  const stroke = size * 0.11;
  const radius = center - stroke;
  const circumference = 2 * Math.PI * radius;

  return (
    <svg
      className="confidence-dial"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${percent}% diagnostic confidence`}
    >
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8abab2" />
          <stop offset="100%" stopColor="#c9917b" />
        </linearGradient>
      </defs>
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="rgba(255, 255, 255, 0.08)"
        strokeWidth={stroke}
      />
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={`url(#${id}-fill)`}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${(percent / 100) * circumference} ${circumference}`}
        transform={`rotate(-90 ${center} ${center})`}
      />
      <text
        x={center}
        y={center}
        className="confidence-dial-value"
        style={{ fontSize: size * 0.21 }}
      >
        {percent}%
      </text>
    </svg>
  );
}

export default ConfidenceDial;
