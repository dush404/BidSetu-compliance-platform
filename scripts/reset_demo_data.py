import sqlite3
import os
import sys

def reset_all_demo_data():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    strapi_db = os.path.join(base_dir, "backend", ".tmp", "data.db")
    prisma_db = os.path.join(base_dir, "frontend", "db", "custom.db")

    print("==================================================================")
    print("      RESETTING PLATFORM VERIFICATION CACHE & DEMO DATA           ")
    print("==================================================================")
    print("This will reset all bidder statuses to 'Pending' and clear audit logs,")
    print("while keeping ALL tenders, bidders, and government registries intact.\n")

    # 1. Strapi Database
    if os.path.exists(strapi_db):
        try:
            conn = sqlite3.connect(strapi_db)
            cur = conn.cursor()

            # Reset bidder applications
            cur.execute("""
                UPDATE bidder_applications
                SET verification_status = 'Pending',
                    compliance_score = NULL,
                    risk_level = NULL,
                    ai_recommendation = NULL,
                    verification_result = NULL,
                    last_verified_at = NULL;
            """)
            b_count = cur.rowcount

            # Clear verification logs
            cur.execute("DELETE FROM verification_logs;")
            l_count = cur.rowcount

            # Clear link table if present
            try:
                cur.execute("DELETE FROM verification_logs_bidder_lnk;")
            except Exception:
                pass

            conn.commit()
            t_count = cur.execute("SELECT count(*) FROM tenders").fetchone()[0]
            conn.close()

            print(f"[OK] Strapi CMS Database ({strapi_db}):")
            print(f"     - Kept {t_count} Tenders intact.")
            print(f"     - Reset {b_count} Bidders back to 'Pending'.")
            print(f"     - Cleared {l_count} verification/audit logs.")
        except Exception as e:
            print(f"[ERROR] Strapi reset error: {e}")
    else:
        print(f"[SKIP] Strapi DB not found at {strapi_db}")

    # 2. Prisma Database
    if os.path.exists(prisma_db):
        try:
            conn = sqlite3.connect(prisma_db)
            cur = conn.cursor()

            cur.execute("""
                UPDATE Bidder
                SET status = 'PENDING',
                    score = 0,
                    risk = NULL,
                    recommendation = NULL,
                    aiSummary = NULL,
                    confidence = 0,
                    lastCheckedAt = NULL,
                    failedChecks = 0,
                    verificationResult = NULL;
            """)
            b_count = cur.rowcount

            cur.execute("DELETE FROM AuditEntry;")
            a_count = cur.rowcount

            cur.execute("DELETE FROM ComplianceCheck;")
            c_count = cur.rowcount

            conn.commit()
            t_count = cur.execute("SELECT count(*) FROM Tender").fetchone()[0]
            conn.close()

            print(f"\n[OK] Frontend Cache Database ({prisma_db}):")
            print(f"     - Kept {t_count} Tenders intact.")
            print(f"     - Reset {b_count} Bidders back to 'PENDING'.")
            print(f"     - Cleared {a_count} audit entries and {c_count} cached checks.")
        except Exception as e:
            print(f"[ERROR] Prisma reset error: {e}")
    else:
        print(f"[SKIP] Prisma DB not found at {prisma_db}")

    print("\n==================================================================")
    print("      SUCCESS: Platform is reset to a completely fresh state!    ")
    print("      You can now search any tender and verify any bidder fresh.  ")
    print("==================================================================")

if __name__ == "__main__":
    reset_all_demo_data()
