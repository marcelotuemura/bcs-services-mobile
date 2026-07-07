import { requireCompanyContext, verifyPageAccess } from "@/lib/auth/permissions"

export default async function TeamPage() {
  const context = await requireCompanyContext()
  await verifyPageAccess('team.manage', context)

  return (
    <section>
      <p className="kicker">BCS Services Mobile</p>
      <h1 className="page-title">Team</h1>
      <div className="empty">
        This module is reserved for Sprint 2+. It will only be enabled after the database, permissions, and tests are verified.
      </div>
    </section>
  )
}
