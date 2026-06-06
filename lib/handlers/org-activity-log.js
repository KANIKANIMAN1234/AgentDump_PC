const { getSupabaseAdmin } = require("../supabase-admin");
const { requireLineMember } = require("../require-member");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const ctx = await requireLineMember(req, res);
  if (!ctx) return;

  if (ctx.legacy) {
    return res.status(403).json({ error: "法人メンバー登録後に利用できます" });
  }

  if (ctx.member.role !== "org_admin") {
    return res.status(403).json({ error: "org_admin のみ閲覧できます" });
  }

  const supabase = getSupabaseAdmin();
  const orgId = ctx.member.organization_id;
  const limit = Math.min(Number(req.query.limit) || 50, 100);

  const [companiesRes, seekersRes, memosRes, membersRes] = await Promise.all([
    supabase
      .from("m_client_companies")
      .select("id, name, updated_at, updated_by_member_id")
      .eq("organization_id", orgId)
      .order("updated_at", { ascending: false })
      .limit(30),
    supabase
      .from("m_job_seekers")
      .select("id, name, updated_at, member_id")
      .eq("organization_id", orgId)
      .order("updated_at", { ascending: false })
      .limit(30),
    supabase
      .from("t_company_memos")
      .select("id, title, updated_at, created_by_member_id, client_company_id")
      .eq("organization_id", orgId)
      .order("updated_at", { ascending: false })
      .limit(30),
    supabase
      .from("m_members")
      .select("id, display_name")
      .eq("organization_id", orgId),
  ]);

  if (companiesRes.error) return res.status(500).json({ error: companiesRes.error.message });
  if (seekersRes.error) return res.status(500).json({ error: seekersRes.error.message });
  if (memosRes.error) return res.status(500).json({ error: memosRes.error.message });
  if (membersRes.error) return res.status(500).json({ error: membersRes.error.message });

  const nameMap = Object.fromEntries((membersRes.data || []).map((m) => [m.id, m.display_name || "不明"]));
  const companyMap = Object.fromEntries((companiesRes.data || []).map((c) => [c.id, c.name]));

  const events = [];

  (companiesRes.data || []).forEach((c) => {
    events.push({
      at: c.updated_at,
      kind: "company",
      label: `採用企業「${c.name}」を更新`,
      actor: nameMap[c.updated_by_member_id] || "不明",
    });
  });

  (seekersRes.data || []).forEach((s) => {
    events.push({
      at: s.updated_at,
      kind: "seeker",
      label: `転職者「${s.name}」を更新`,
      actor: nameMap[s.member_id] || "不明",
    });
  });

  (memosRes.data || []).forEach((m) => {
    const companyName = companyMap[m.client_company_id] || "企業";
    events.push({
      at: m.updated_at,
      kind: "memo",
      label: `企業メモ「${m.title || "（無題）"}」(${companyName})`,
      actor: nameMap[m.created_by_member_id] || "不明",
    });
  });

  events.sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));

  return res.status(200).json({ events: events.slice(0, limit) });
};
