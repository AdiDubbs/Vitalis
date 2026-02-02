import { Badge } from "@mantine/core";
import { formatContributionPercent } from "../utils/symptomHelpers.js";

function EvidenceBadge({
  category,
  contribution,
  label,
  size = "md",
  variant = "light",
  className = "",
  ...props
}) {
  const categoryClass = `badge-evidence badge-evidence-${category}`;
  const contributionType = contribution >= 0 ? "positive" : "negative";

  return (
    <Badge
      size={size}
      variant={variant}
      className={`${categoryClass} badge-compact ${className}`.trim()}
      data-contribution={contributionType}
      {...props}
    >
      {label}
      <span style={{ marginLeft: '4px', fontWeight: 500, opacity: 0.6, fontSize: '0.9em' }}>
        {formatContributionPercent(contribution)}
      </span>
    </Badge>
  );
}

export default EvidenceBadge;
