import type { ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Button } from "../components/Button";
import { useAccessRequests, useCorrections, useOrganization, useStores } from "../hooks/queries";
import { useAuthStore } from "../stores/authStore";
import { roleLabel } from "../utils/format";
import styles from "./AppShell.module.css";
import { IconPulse } from "./icons";
import { organizationAdminNav, superAdminNav, type NavGroup } from "./navigation";

function SmallScreenNotice() {
  return (
    <div className={styles.smallScreen}>
      <span className={styles.brandMark}>
        <IconPulse />
      </span>
      <p className={styles.smallScreenTitle}>WorkPulse Web works best on a larger screen</p>
      <p className={styles.smallScreenBody}>
        Administration screens are built for a desktop display. On a phone, use the WorkPulse mobile app.
      </p>
    </div>
  );
}

interface ShellProps {
  nav: NavGroup[];
  contextName: string;
  contextMeta: string;
  badges?: Partial<Record<"pendingCorrections" | "pendingAccessRequests", number>>;
  topBarMeta?: ReactNode;
}

function Shell({ nav, contextName, contextMeta, badges, topBarMeta }: ShellProps) {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const location = useLocation();

  return (
    <>
      <div className={styles.shell}>
        <aside className={styles.sidebar}>
          <div className={styles.brand}>
            <span className={styles.brandMark}>
              <IconPulse />
            </span>
            <span className={styles.brandName}>WorkPulse</span>
          </div>

          <div className={styles.contextCard}>
            <span className={styles.contextMark}>{contextName.slice(0, 1).toUpperCase()}</span>
            <div className={styles.contextText}>
              <div className={styles.contextName}>{contextName}</div>
              <div className={styles.contextMeta}>{contextMeta}</div>
            </div>
          </div>

          <nav className={styles.nav}>
            {nav.map((group) => (
              <div key={group.label} className={styles.group}>
                <p className={styles.groupLabel}>{group.label}</p>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const badge = item.badgeKey ? badges?.[item.badgeKey] : undefined;
                  const isActive = item.matchPrefix
                    ? location.pathname.startsWith(item.matchPrefix)
                    : location.pathname === item.to;

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={!item.matchPrefix}
                      className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
                      title={item.label}
                    >
                      <span className={styles.navIcon}>
                        <Icon />
                      </span>
                      <span className={styles.navLabel}>{item.label}</span>
                      {badge ? <span className={styles.navBadge}>{badge}</span> : null}
                    </NavLink>
                  );
                })}
              </div>
            ))}
          </nav>

          <Link to="/account" className={styles.userCard}>
            <span className={styles.contextMark}>{(user?.email ?? "?").slice(0, 1).toUpperCase()}</span>
            <div className={styles.userText}>
              <div className={styles.userName}>{user?.email}</div>
              <div className={styles.userRole}>{user ? roleLabel(user.role) : ""}</div>
            </div>
          </Link>
        </aside>

        <div className={styles.main}>
          <header className={styles.topBar}>
            <div className={styles.topBarMeta}>{topBarMeta}</div>
            <div className={styles.topBarActions}>
              <Button size="small" variant="ghost" onClick={() => void logout()}>
                Sign out
              </Button>
            </div>
          </header>
          <main className={styles.content}>
            <Outlet />
          </main>
        </div>
      </div>
      <SmallScreenNotice />
    </>
  );
}

export function OrganizationAdminShell() {
  const user = useAuthStore((state) => state.user);
  const organizationQuery = useOrganization(user?.organizationId);
  const storesQuery = useStores();
  const pendingCorrections = useCorrections({ status: "PENDING" });
  const pendingRequests = useAccessRequests("PENDING");

  const storeCount = storesQuery.data?.length ?? 0;

  return (
    <Shell
      nav={organizationAdminNav}
      contextName={organizationQuery.data?.name ?? "Your organization"}
      contextMeta={storesQuery.isSuccess ? `${storeCount} ${storeCount === 1 ? "store" : "stores"}` : "—"}
      badges={{
        pendingCorrections: pendingCorrections.data?.length ?? 0,
        pendingAccessRequests: pendingRequests.data?.length ?? 0,
      }}
      topBarMeta={organizationQuery.data ? `Signed in to ${organizationQuery.data.name}` : null}
    />
  );
}

export function SuperAdminShell() {
  return (
    <Shell
      nav={superAdminNav}
      contextName="WorkPulse"
      contextMeta="Platform administration"
      topBarMeta="Platform administration"
    />
  );
}

/** Account is the one screen both web roles share, so it renders inside
 *  whichever shell the signed-in role belongs to. */
export function RoleAwareShell() {
  const role = useAuthStore((state) => state.user?.role);
  return role === "SUPER_ADMIN" ? <SuperAdminShell /> : <OrganizationAdminShell />;
}
