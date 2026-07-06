export interface RobotsDecision {
  allowed: boolean;
  reason: "allowed" | "disallowed" | "not_applicable";
  matchedRule?: string;
}

interface RobotsRule {
  directive: "allow" | "disallow";
  path: string;
}

interface RobotsGroup {
  agents: string[];
  rules: RobotsRule[];
}

export function robotsUrlFor(target: URL): string {
  return `${target.origin}/robots.txt`;
}

export function evaluateRobotsTxt(robotsTxt: string, targetPath: string, userAgent: string): RobotsDecision {
  const groups = parseRobotsTxt(robotsTxt);
  const normalizedAgent = userAgent.toLowerCase();
  const selected = selectGroups(groups, normalizedAgent);
  if (!selected.length) return { allowed: true, reason: "allowed" };

  const rules = selected.flatMap((group) => group.rules).filter((rule) => rule.path.length > 0);
  if (!rules.length) return { allowed: true, reason: "allowed" };

  const target = targetPath.startsWith("/") ? targetPath : `/${targetPath}`;
  const matches = rules
    .filter((rule) => target.startsWith(rule.path))
    .sort((a, b) => b.path.length - a.path.length || (a.directive === "allow" ? -1 : 1));

  const winner = matches[0];
  if (!winner) return { allowed: true, reason: "allowed" };
  return {
    allowed: winner.directive === "allow",
    reason: winner.directive === "allow" ? "allowed" : "disallowed",
    matchedRule: `${winner.directive}: ${winner.path}`,
  };
}

function parseRobotsTxt(robotsTxt: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  let sawRule = false;

  for (const rawLine of robotsTxt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    if (!line) continue;
    const match = /^([^:]+):\s*(.*)$/i.exec(line);
    if (!match) continue;
    const key = match[1].trim().toLowerCase();
    const value = match[2].trim();

    if (key === "user-agent") {
      if (!current || sawRule) {
        current = { agents: [], rules: [] };
        groups.push(current);
        sawRule = false;
      }
      current.agents.push(value.toLowerCase());
      continue;
    }

    if ((key === "allow" || key === "disallow") && current) {
      sawRule = true;
      current.rules.push({
        directive: key,
        path: value,
      });
    }
  }

  return groups;
}

function selectGroups(groups: RobotsGroup[], userAgent: string): RobotsGroup[] {
  const exact = groups.filter((group) =>
    group.agents.some((agent) => agent !== "*" && (userAgent.includes(agent) || agent.includes(userAgent))),
  );
  if (exact.length) return exact;
  return groups.filter((group) => group.agents.includes("*"));
}
