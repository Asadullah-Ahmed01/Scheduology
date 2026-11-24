"""
ReportFix - server + rules layer.

Split of responsibility (the "Approach" answer):
  engine.py  = AI: understands English / Roman Urdu text, typos, safety,
               location matching, injection filtering.
  app.py     = regular code: counting, weighting, permissions, state machine.
               A report cannot change ANY of these by what it says - the API
               never accepts department/priority/status from report text.

Run:   python3 server.py      (stdlib only, no pip installs)
Open:  http://localhost:8000
"""

import json
import os
import re
import sqlite3
import threading
import time
from datetime import datetime, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

import engine

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "reportfix.db")
LOCK = threading.Lock()

DEPARTMENTS = ["EE", "CSE", "IS", "LIBRARY", "CAFETERIA", "LABS"]
PRIORITY_ORDER = {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1}


# ------------------------------------------------------------------ helpers
def now():
    return datetime.now()


def fmt(ts):
    return ts.strftime("%Y-%m-%d %H:%M")


def weight(trust):
    """Vote/report weight from trust score. A single 100-trust student = 2.0."""
    if trust < 30:
        return 0.5
    if trust < 70:
        return 1.0
    if trust < 85:
        return 1.5
    return 2.0


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


SCHEMA = """
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY, name TEXT, login_id TEXT, role TEXT, dept TEXT,
  trust REAL DEFAULT 50, created_at TEXT, fresh INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS issues(
  id INTEGER PRIMARY KEY, title TEXT, category TEXT, category_label TEXT,
  dept TEXT, status TEXT, priority TEXT, location TEXT, confidential INTEGER DEFAULT 0,
  impact REAL DEFAULT 0, alert TEXT, created_at TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS reports(
  id INTEGER PRIMARY KEY, issue_id INTEGER, user_id INTEGER, text TEXT,
  reason TEXT, priority TEXT, injection TEXT DEFAULT '', spam INTEGER DEFAULT 0,
  created_at TEXT);
CREATE TABLE IF NOT EXISTS joins!(
  id INTEGER PRIMARY KEY, issue_id INTEGER, user_id INTEGER, created_at TEXT);
CREATE TABLE IF NOT EXISTS votes(
  id INTEGER PRIMARY KEY, issue_id INTEGER, user_id INTEGER, verdict TEXT,
  weight REAL, flagged INTEGER DEFAULT 0, created_at TEXT);
CREATE TABLE IF NOT EXISTS timeline(
  id INTEGER PRIMARY KEY, issue_id INTEGER, ts TEXT, text TEXT);
CREATE TABLE IF NOT EXISTS trust_events(
  id INTEGER PRIMARY KEY, user_id INTEGER, delta REAL, reason TEXT, created_at TEXT);
""".replace("joins!(", "joins(")


def init_db():
    conn = get_db()
    conn.executescript(SCHEMA)
    conn.commit()
    conn.close()


def drop_db():
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)


def add_trust(conn, user_id, delta, reason):
    conn.execute("UPDATE users SET trust = MAX(0, MIN(100, trust + ?)) WHERE id=?",
                 (delta, user_id))
    conn.execute("INSERT INTO trust_events(user_id, delta, reason, created_at) VALUES(?,?,?,?)",
                 (user_id, delta, reason, fmt(now())))


def timeline_add(conn, issue_id, text):
    conn.execute("INSERT INTO timeline(issue_id, ts, text) VALUES(?,?,?)",
                 (issue_id, fmt(now()), text))


def affected_users(conn, issue_id):
    rows = conn.execute(
        """SELECT DISTINCT u.id, u.name, u.trust, u.created_at FROM users u
           WHERE u.id IN (SELECT user_id FROM reports WHERE issue_id=? AND spam=0
                          UNION SELECT user_id FROM joins WHERE issue_id=?)""",
        (issue_id, issue_id)).fetchall()
    return rows


def recompute_impact(conn, issue_id):
    total = sum(weight(r["trust"]) for r in affected_users(conn, issue_id))
    conn.execute("UPDATE issues SET impact=? WHERE id=?", (total, issue_id))
    return total


def maybe_bump_priority(conn, issue_id):
    """Crowd rule 9: many credible students raise priority. One high-trust
    student maxes at weight 2.0 and can never reach the bump thresholds."""
    row = conn.execute("SELECT impact, priority FROM issues WHERE id=?",
                       (issue_id,)).fetchone()
    impact, priority = row["impact"], row["priority"]
    new = priority
    if impact >= 6 and priority in ("LOW", "MEDIUM"):
        new = "HIGH"
    elif impact >= 4 and priority == "LOW":
        new = "MEDIUM"
    if new != priority:
        conn.execute("UPDATE issues SET priority=? WHERE id=?", (new, issue_id))
        timeline_add(conn, issue_id,
                     f"Crowd impact reached {impact:.1f} -> priority raised to {new}")
    return new


def title_for(analysis, location):
    place = location or "Unknown campus place"
    return f"{analysis['category_label'].split(' / ')[0]} - {place}"


def match_open_issue(conn, category, location, status_ok):
    row = conn.execute(
        """SELECT id FROM issues WHERE category=? AND location=? AND
           status IN (%s) LIMIT 1""" % ",".join("?" * len(status_ok)),
        (category, location, *status_ok)).fetchone()
    return row["id"] if row else None


# -------------------------------------------------------------- brigading
def check_brigading(conn, issue_id):
    """Rule 10 bonus: many brand-new accounts voting together."""
    votes = conn.execute(
        """SELECT v.*, u.created_at AS account_created, u.fresh
           FROM votes v JOIN users u ON u.id=v.user_id WHERE v.issue_id=?""",
        (issue_id,)).fetchall()
    by_verdict = {}
    for v in votes:
        if v["flagged"]:
            continue
        by_verdict.setdefault(v["verdict"], []).append(v)
    for verdict, group in by_verdict.items():
        suspicious = [v for v in group
                      if v["fresh"] == 1 or
                      (now() - datetime.strptime(v["account_created"], "%Y-%m-%d %H:%M"))
                      .total_seconds() / 3600 <= 2]
        if len(suspicious) >= 3:
            for v in suspicious:
                conn.execute("UPDATE votes SET flagged=1 WHERE id=?", (v["id"],))
            conn.execute("UPDATE issues SET alert=? WHERE id=?",
                         (f"{len(suspicious)} brand-new accounts voted '{verdict}' "
                          f"together - votes flagged for review", issue_id))
            timeline_add(conn, issue_id,
                         f"Brigading alert: {len(suspicious)} brand-new accounts "
                         f"voted '{verdict}' - their votes were zero-weighted")
            return True
    return False


# --------------------------------------------------------------- mutations
def create_or_join(conn, user, analysis, text):
    """Rule 2: group by meaning. Same problem + same place = one issue."""
    cat = analysis["category"]
    dept = analysis["dept"]
    priority = analysis["priority"]
    confidential = bool(analysis.get("confidential"))
    injection = " || ".join(analysis.get("injection_flags", []))

    joined = False
    if analysis["needs_clarification"]:
        # Rule 6: no guessing - park the report, ask which place.
        cur = conn.execute(
            """INSERT INTO issues(title, category, category_label, dept, status,
               priority, location, confidential, impact, created_at, updated_at)
               VALUES(?,?,?,?,?,?,?,?,0,?,?)""",
            (title_for(analysis, None), cat, analysis["category_label"], dept,
             "NEEDS_CLARIFICATION", priority, None, int(confidential),
             fmt(now()), fmt(now())))
        issue_id = cur.lastrowid
        sugg = ", ".join(analysis.get("suggestions", [])) or "none - please type/pick one"
        timeline_add(conn, issue_id,
                     f"Report held for clarification. Unrecognized place: '{analysis.get('location_hint', '')}' "
                     f"Suggestions: {sugg}")
    else:
        location = analysis["location"]
        existing = None
        if cat and not confidential:
            # try word-for-word same category + same place, still-open issues
            existing = match_open_issue(
                conn, cat, location, ("OPEN", "IN_PROGRESS", "RESOLVED"))
        if existing:
            issue_id = existing
            joined = True
            dup = conn.execute(
                "SELECT 1 FROM reports WHERE issue_id=? AND user_id=? AND spam=0",
                (issue_id, user["id"])).fetchone()
            if not dup:
                conn.execute("INSERT INTO joins(issue_id, user_id, created_at) VALUES(?,?,?)",
                             (issue_id, user["id"], fmt(now())))
                impact = recompute_impact(conn, issue_id)
                timeline_add(conn, issue_id,
                             f"'Me too' joined by {user['name']} (credibility weight "
                             f"{weight(user['trust']):.1f}) - impact now {impact:.1f}")
                maybe_bump_priority(conn, issue_id)
        else:
            cur = conn.execute(
                """INSERT INTO issues(title, category, category_label, dept, status,
                   priority, location, confidential, impact, created_at, updated_at)
                   VALUES(?,?,?,?,?,?,?,?,?, ?, ?)""",
                (title_for(analysis, analysis["location"]), cat,
                 analysis["category_label"], dept, "OPEN", priority,
                 analysis["location"], int(confidential), 0, fmt(now()), fmt(now())))
            issue_id = cur.lastrowid
            timeline_add(conn, issue_id, "Issue opened and routed")

    conn.execute(
        """INSERT INTO reports(issue_id, user_id, text, reason, priority, injection, created_at)
           VALUES(?,?,?,?,?,?,?)""",
        (issue_id, user["id"], text, analysis["reason"], analysis["priority"],
         injection, fmt(now())))
    recompute_impact(conn, issue_id)
    if not analysis["needs_clarification"]:
        maybe_bump_priority(conn, issue_id)
    return issue_id, joined


def finalize_clarification(conn, user, issue_id, location):
    issue = conn.execute("SELECT * FROM issues WHERE id=?", (issue_id,)).fetchone()
    if issue["status"] != "NEEDS_CLARIFICATION":
        return None
    from engine import LOCATIONS
    if location not in LOCATIONS:
        return None
    conn.execute("UPDATE issues SET location=?, status='OPEN', updated_at=? WHERE id=?",
                 (location, fmt(now()), issue_id))
    conn.execute("UPDATE issues SET title=? WHERE id=?",
                 (f"{issue['category_label'].split(' / ')[0]} - {location}", issue_id))
    timeline_add(conn, issue_id, f"Location clarified: {location}. Issue opened and routed")
    recompute_impact(conn, issue_id)
    return True


def vote_resolution(conn, user, issue_id, verdict):
    issue = conn.execute("SELECT * FROM issues WHERE id=?", (issue_id,)).fetchone()
    if verdict not in ("confirm", "dispute"):
        return None
    if not issue or issue["confidential"]:
        return None
    if issue["status"] not in ("RESOLVED", "CONFIRMED", "REOPENED"):
        return "Voting is only open on resolved issues"
    aff = {r["id"] for r in affected_users(conn, issue_id)}
    if user["id"] not in aff:
        return "Only students affected by this issue (reported or joined) may vote"
    dup = conn.execute("SELECT 1 FROM votes WHERE issue_id=? AND user_id=?",
                       (issue_id, user["id"])).fetchone()
    if dup:
        return "You already voted on this issue"
    w = weight(user["trust"])
    conn.execute("INSERT INTO votes(issue_id, user_id, verdict, weight, created_at) "
                 "VALUES(?,?,?,?,?)", (issue_id, user["id"], verdict, w, fmt(now())))
    timeline_add(conn, issue_id, f"{user['name']} voted to {verdict} (weight {w:.1f})")
    check_brigading(conn, issue_id)
    evaluate_resolution(conn, issue_id)
    return None


def evaluate_resolution(conn, issue_id):
    issue = conn.execute("SELECT * FROM issues WHERE id=?", (issue_id,)).fetchone()
    votes = conn.execute("SELECT * FROM votes WHERE issue_id=? AND flagged=0",
                         (issue_id,)).fetchall()
    cw = sum(v["weight"] for v in votes if v["verdict"] == "confirm")
    dw = sum(v["weight"] for v in votes if v["verdict"] == "dispute")
    n_confirm = len([v for v in votes if v["verdict"] == "confirm"])
    n_dispute = len([v for v in votes if v["verdict"] == "dispute"])
    if issue["status"] in ("RESOLVED", "CONFIRMED"):
        if dw >= 3 and dw > cw:
            was_confirmed = issue["status"] == "CONFIRMED"
            conn.execute("UPDATE issues SET status='REOPENED', updated_at=? WHERE id=?",
                         (fmt(now()), issue_id))
            timeline_add(conn, issue_id,
                         f"REOPENED by student disputes (dispute weight {dw:.1f} vs "
                         f"confirm {cw:.1f}). Back to {issue['dept']} queue.")
            for v in votes:
                if v["verdict"] == "dispute":
                    add_trust(conn, v["user_id"], +2, "Dispute proved right (issue reopened)")
                elif v["verdict"] == "confirm" and was_confirmed:
                    add_trust(conn, v["user_id"], -2,
                              "Vote proved wrong (confirmed fix was disputed away)")
            return
        if cw >= 1 and cw > dw:
            conn.execute("UPDATE issues SET status='CONFIRMED', updated_at=? WHERE id=?",
                         (fmt(now()), issue_id))
            timeline_add(conn, issue_id, "Fix CONFIRMED by affected students. Trust reward going out.")
            rep = conn.execute(
                "SELECT user_id FROM reports WHERE issue_id=? AND spam=0 LIMIT 1",
                (issue_id,)).fetchone()
            for v in votes:
                if v["verdict"] == "confirm":
                    add_trust(conn, v["user_id"], +2, "Vote proved right (fix confirmed)")
            if rep:
                add_trust(conn, rep["user_id"], +3, "Report proved real (issue confirmed resolved)")
            return
    if issue["status"] == "REOPENED" and cw > dw and n_confirm >= 2:
        conn.execute("UPDATE issues SET status='CONFIRMED', updated_at=? WHERE id=?",
                     (fmt(now()), issue_id))
        timeline_add(conn, issue_id, "Second fix CONFIRMED by affected students.")
        for v in votes:
            if v["verdict"] == "confirm":
                add_trust(conn, v["user_id"], +2, "Vote proved right (re-fix confirmed)")
        return


def set_status(conn, user, issue_id, new_status, note):
    issue = conn.execute("SELECT * FROM issues WHERE id=?", (issue_id,)).fetchone()
    if not issue:
        return "No such issue"
    if new_status not in ("IN_PROGRESS", "RESOLVED", "OPEN"):
        return "Bad status"
    if issue["confidential"] and user["role"] != "admin":
        return None  # never reached: gated earlier
    if user["role"] != "admin" and issue["dept"] != user.get("dept"):
        return "You can only update your own department's queue"
    conn.execute("UPDATE issues SET status=?, updated_at=? WHERE id=?",
                 (new_status, fmt(now()), issue_id))
    timeline_add(conn, issue_id,
                 f"{user['name']} ({user['dept'] or user['role']}) set status to "
                 f"{new_status}" + (f": {note}" if note else ""))
    if new_status == "RESOLVED":
        timeline_add(conn, issue_id,
                     "Waiting for affected students to confirm or dispute this fix. "
                     "Enough credible disputes will reopen it.")
    return None


def flag_spam(conn, admin, issue_id):
    issue = conn.execute("SELECT * FROM issues WHERE id=?", (issue_id,)).fetchone()
    if not issue:
        return "No such issue"
    reps = conn.execute("SELECT * FROM reports WHERE issue_id=?", (issue_id,)).fetchall()
    seen_users = set()
    for r in reps:
        if r["user_id"] in seen_users:
            continue
        seen_users.add(r["user_id"])
        conn.execute("UPDATE reports SET spam=1 WHERE id=?", (r["id"],))
        add_trust(conn, r["user_id"], -10, "Report marked as fake/spam by admin")
    conn.execute("UPDATE issues SET status='SPAM', priority='LOW', alert=NULL WHERE id=?",
                 (issue_id,))
    timeline_add(conn, issue_id, "Admin marked this issue as SPAM. Reporters' trust reduced.")
    recompute_impact(conn, issue_id)
    return None


# ---------------------------------------------------------------- summary
def admin_summary(conn):
    issues = conn.execute("SELECT * FROM issues").fetchall()
    open_i = [i for i in issues if i["status"] in ("OPEN", "IN_PROGRESS", "REOPENED")]
    conf = [i for i in issues if i["confidential"]]
    crit = [i for i in open_i if i["priority"] == "CRITICAL"]
    by_dept = {}
    for i in open_i:
        by_dept.setdefault(i["dept"], []).append(i)
    trend = sorted(open_i, key=lambda i: -i["impact"])[:3]
    alerts = conn.execute("SELECT * FROM issues WHERE alert IS NOT NULL").fetchall()
    lines = ["REPORTFIX - ADMIN SITUATION SUMMARY (auto-generated from live data)", ""]
    lines.append(f"{len(open_i)} open issues across "
                 f"{len(by_dept)} departments; {len(crit)} are CRITICAL safety items. "
                 f"{len(conf)} confidential report(s) are held admin-only and never "
                 f"appear on any public board.")
    for d in DEPARTMENTS:
        items = by_dept.get(d, [])
        if items:
            lines.append(f"- {d}: {len(items)} open. Oldest: '{items[0]['title']}' "
                         f"({items[0]['status']}, priority {items[0]['priority']}).")
    if crit:
        lines.append("")
        lines.append("ACT NOW: " + "; ".join(f"{i['title']} ({i['location']})"
                                             for i in crit))
    if trend:
        lines.append("")
        lines.append("Most crowded (highest verify-by-many impact): " +
                     "; ".join(f"{i['title']} (impact {i['impact']:.1f})" for i in trend))
    if alerts:
        lines.append("")
        lines.append("Integrity alerts: " + "; ".join(a["alert"] for a in alerts))
    return "\n".join(lines)


# ------------------------------------------------------------------- seed
def seed():
    drop_db()
    init_db()
    conn = get_db()
    t = now()

    def U(name, role, dept=None, trust=50, mins=0, fresh=0, lid=None):
        c = conn.execute(
            "INSERT INTO users(name, login_id, role, dept, trust, created_at, fresh) "
            "VALUES(?,?,?,?,?,?,?)",
            (name, lid, role, dept, trust, fmt(t - timedelta(minutes=mins)), fresh))
        return c.lastrowid

    admin = U("Registrar Admin", "admin", None, 100, 60*24*90, 0, "ADMIN-01")
    staff_ids = {"EE": "STAFF-EE", "CSE": "STAFF-CSE", "IS": "STAFF-IS",
                 "LIBRARY": "STAFF-LIB", "CAFETERIA": "STAFF-CAFE",
                 "LABS": "STAFF-LABS"}
    staff_names = {"EE": "EE", "CSE": "CSE", "IS": "IS", "LIBRARY": "Library",
                   "CAFETERIA": "Cafeteria", "LABS": "Labs"}
    staff = {d: U(staff_names[d] + " Staff", "staff", d, 100, 60*24*90, 0, staff_ids[d])
             for d in DEPARTMENTS}
    ali = U("Ali Raza", "student", None, 88, 60*24*60, 0, "STU-001")
    fatima = U("Fatima Khan", "student", None, 72, 60*24*55, 0, "STU-002")
    bilal = U("Bilal Ahmed", "student", None, 31, 60*24*40, 0, "STU-003")
    ayesha = U("Ayesha Siddiqui", "student", None, 55, 60*24*30, 0, "STU-004")
    hamza = U("Hamza Tariq", "student", None, 20, 60*24*20, 0, "STU-005")
    zainab = U("Zainab Malik", "student", None, 91, 60*24*15, 0, "STU-006")
    usman = U("Usman Ghani", "student", None, 50, 60*24*3, 0, "STU-007")

    def TE(uid, delta, reason, mins):
        conn.execute("INSERT INTO trust_events(user_id, delta, reason, created_at) "
                     "VALUES(?,?,?,?)", (uid, delta, reason,
                                         fmt(t - timedelta(minutes=mins))))

    TE(ali, +3, "Report proved real (issue confirmed resolved)", 60*24*3)
    TE(ali, +2, "Vote proved right (fix confirmed)", 60*24*3)
    TE(fatima, +2, "Dispute proved right (issue reopened)", 60*24*5)
    TE(bilal, -10, "Report marked as fake/spam by admin", 60*24*6)
    TE(bilal, -9, "Report marked as fake/spam by admin", 60*24*6)
    TE(hamza, -10, "Report marked as fake/spam by admin", 60*24*8)
    TE(hamza, -10, "Report marked as fake/spam by admin", 60*24*8)
    TE(hamza, +2, "Dispute proved right (issue reopened)", 60*24*5)
    TE(zainab, +3, "Report proved real (issue confirmed resolved)", 60*24*2)
    TE(ayesha, +2, "Vote proved right (fix confirmed)", 60*24*4)

    def issue(title, cat, label, dept, status, prio, loc, conf, created_min, impact=0):
        c = conn.execute(
            """INSERT INTO issues(title, category, category_label, dept, status,
               priority, location, confidential, impact, created_at, updated_at)
               VALUES(?,?,?,?,?,?,?,?,?,?,?)""",
            (title, cat, label, dept, status, prio, loc, int(conf),
             impact, fmt(t - timedelta(minutes=created_min)),
             fmt(t - timedelta(minutes=created_min // 2))))
        tid = c.lastrowid
        return tid

    # 1. WiFi down in CSE Lab 3, four students
    i1 = issue("WLAN / Internet down - CSE Lab 3", "wifi", "WLAN / Internet down",
               "IS", "OPEN", "HIGH", "CSE Lab 3", 0, 260, 4.0)
    for uid, txt in ((ali, "lab 3 ka wifi chal nahi raha"),
                     (fatima, "CSE Lab3 wifi not working since morning"),
                     (bilal, "wifi down in cse lab 3, nobody can connect"),
                     (ayesha, "net nahi chal raha cse lab 3")):
        conn.execute("INSERT INTO reports(issue_id,user_id,text,reason,priority,created_at)"
                     "VALUES(?,?,?,?,?,?)",
                     (i1, uid, txt, "Understood as: WLAN / Internet down. "
                      "priority HIGH (crowd of credible reporters). location: CSE Lab 3.",
                      "HIGH", fmt(t - timedelta(minutes=260))))
    conn.execute("UPDATE issues SET impact=4.0 WHERE id=?", (i1,))

    # 2. Library AC
    i2 = issue("AC / cooling not working - Library", "ac", "AC / cooling not working",
               "EE", "IN_PROGRESS", "MEDIUM", "Library", 0, 200, 3.0)
    for uid, txt in ((fatima, "AC kharab hai library mein, bohat garmi"),
                     (zainab, "Library reading hall AC not cooling")):
        conn.execute("INSERT INTO reports(issue_id,user_id,text,reason,priority,created_at)"
                     "VALUES(?,?,?,?,?,?)",
                     (i2, uid, txt, "Understood as: AC / cooling. priority MEDIUM. "
                      "location: Library.", "MEDIUM", fmt(t - timedelta(minutes=200))))
    timeline_add(conn, i2, "EE Staff set status to IN_PROGRESS: technician assigned")
    conn.execute("UPDATE issues SET impact=2*1.5+.5 WHERE id=?", (i2,))  # weight zainab 2 + fatima 1

    # 3. Cafeteria food
    i3 = issue("Food quality / hygiene - Main Cafeteria", "food",
               "Food quality / hygiene", "CAFETERIA", "OPEN", "MEDIUM",
               "Main Cafeteria", 0, 150, 1.0)
    conn.execute("INSERT INTO reports(issue_id,user_id,text,reason,priority,created_at)"
                 "VALUES(?,?,?,?,?,?)",
                 (i3, bilal, "canteen ka khana basi lag raha hai",
                  "Understood as: Food quality. priority MEDIUM. location: Main Cafeteria.",
                  "MEDIUM", fmt(t - timedelta(minutes=150))))
    conn.execute("UPDATE issues SET impact=1.0 WHERE id=?", (i3,))

    # 4. Projector resolved, awaiting confirmation votes
    i4 = issue("Projector not working - CSE Lab 2", "projector",
               "Projector not working", "LABS", "RESOLVED", "MEDIUM",
               "CSE Lab 2", 0, 480, 2.0)
    conn.execute("INSERT INTO reports(issue_id,user_id,text,reason,priority,created_at)"
                 "VALUES(?,?,?,?,?,?)",
                 (i4, ali, "projector nahi chal raha CSE lab 2 mein, class cancel ho gayi",
                  "Understood as: Projector not working. priority MEDIUM. location: CSE Lab 2.",
                  "MEDIUM", fmt(t - timedelta(minutes=480))))
    timeline_add(conn, i4, "Labs Staff set status to IN_PROGRESS: replacement issued")
    timeline_add(conn, i4, "Labs Staff set status to RESOLVED: new projector installed")
    timeline_add(conn, i4, "Waiting for affected students to confirm or dispute this fix. "
                            "Enough credible disputes will reopen it.")
    conn.execute("UPDATE issues SET impact=2.0 WHERE id=?", (i4,))

    # 5. Confidential ragging - admin only, anonymous
    i5 = issue("Harassment / ragging (confidential) - Block B", "harassment",
               "Harassment / ragging (confidential)", "ADMIN", "OPEN", "HIGH",
               "Block B", 1, 90, 0)
    conn.execute("INSERT INTO reports(issue_id,user_id,text,reason,priority,created_at)"
                 "VALUES(?,?,?,?,?,?)",
                 (i5, usman, "seniors are ragging first years in block b basement, "
                  "please keep it private",
                  "Understood as: Harassment / ragging (confidential). "
                  "priority HIGH. location: Block B. Handling confidentially; "
                  "reporter hidden, no department board.", "HIGH",
                  fmt(t - timedelta(minutes=90))))

    conn.commit()
    conn.close()


# -------------------------------------------------------------------- api
class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code, data, ctype="application/json"):
        body = data if isinstance(data, bytes) else json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _body(self):
        try:
            n = int(self.headers.get("Content-Length", 0))
            return json.loads(self.rfile.read(n) or b"{}")
        except Exception:
            return {}

    def do_GET(self):
        parts = urlparse(self.path)
        path = parts.path
        qs = dict(p.split("=", 1) for p in parts.query.split("&") if "=" in p)
        if path == "/":
            return self._send(200, open(STATIC("index.html"), "rb").read(),
                              "text/html; charset=utf-8")
        if path in ("/app.js", "/style.css"):
            ctype = "application/javascript" if path.endswith(".js") else "text/css"
            return self._send(200, open(STATIC(path.lstrip("/")), "rb").read(), ctype)
        if path == "/api/state":
            return self._send(200, self.state(qs.get("as")))
        if path == "/api/summary":
            me = user_by_id(int(qs.get("as", 0))) if qs.get("as", "").isdigit() else None
            if not me or me["role"] != "admin":
                return self._send(403, {"error": "admin only"})
            return self._send(200, {"summary": self.admin_summary()})
        self._send(404, {"error": "not found"})

    def do_POST(self):
        path = urlparse(self.path).path
        b = self._body()
        try:
            with LOCK:
                if path == "/api/reset":
                    seed()
                    return self._send(200, {"ok": True, "me": first_admin()})
                if path == "/api/login":
                    u = login(b.get("login_id"))
                    if u:
                        return self._send(200, {"ok": True, "me": u})
                    return self._send(200, {"ok": False,
                        "error": "No account with that ID. Students: use your STU-xxx ID. "
                                 "Staff/admin: use the staff sign-in below."})
                if path == "/api/switch":
                    return self._send(200, {"ok": True, "me": user_by_id(b.get("user_id"))})
                if path == "/api/new_student":
                    return self._send(200, {"ok": True, "me": new_student()})
                if path == "/api/report":
                    return self._send(200, self.api_report(b))
                if path == "/api/clarify":
                    return self._send(200, self.api_clarify(b))
                if path == "/api/join":
                    return self._send(200, self.api_join(b))
                if path == "/api/vote":
                    return self._send(200, self.api_vote(b))
                if path == "/api/status":
                    return self._send(200, self.api_status(b))
                if path == "/api/spam":
                    return self._send(200, self.api_spam(b))
            return self._send(404, {"error": "not found"})
        except Exception as e:
            import traceback
            traceback.print_exc()
            return self._send(500, {"error": str(e)})

    # ---------------- state
    def state(self, as_id):
        conn = get_db()
        users = [dict(r) for r in conn.execute("SELECT * FROM users ORDER BY role, id")]
        me = None
        if as_id and str(as_id).isdigit():
            row = conn.execute("SELECT * FROM users WHERE id=?", (int(as_id),)).fetchone()
            me = dict(row) if row else None
        issues = [dict(r) for r in conn.execute(
            "SELECT * FROM issues WHERE status != 'SPAM' ORDER BY id DESC")]
        names = {u["id"]: u["name"] for u in users}
        out_issues = []
        for i in issues:
            if i["confidential"] and (not me or me["role"] != "admin"):
                # Confidential issues reach NO other department and no public view.
                # A reporter gets only a status card with zero details.
                is_reporter = me is not None and conn.execute(
                    "SELECT 1 FROM reports WHERE issue_id=? AND user_id=?",
                    (i["id"], me["id"])).fetchone() is not None
                if is_reporter:
                    out_issues.append({
                        "id": i["id"], "mine": True,
                        "title": "Your confidential report - details hidden",
                        "dept": "ADMIN", "priority": "--",
                        "status": i["status"], "location": "",
                        "impact": 0, "affected": [], "affected_count": 0,
                        "reports": [], "votes": [], "timeline": []})
                continue
            d = dict(i)
            reps = [dict(r) for r in conn.execute(
                "SELECT * FROM reports WHERE issue_id=? ORDER BY id", (i["id"],))]
            d["reports"] = [{
                "id": r["id"], "text": r["text"], "reason": r["reason"],
                "spam": r["spam"], "injection": r["injection"],
                "by": ("Anonymous" if i["confidential"] else
                       names.get(r["user_id"], "Unknown")),
                "created_at": r["created_at"]} for r in reps]
            aff = affected_users(conn, i["id"])
            d["affected"] = ["Anonymous" if i["confidential"] else a["name"] for a in aff]
            d["affected_ids"] = [a["id"] for a in aff]
            d["affected_count"] = len(aff)
            d["votes"] = [dict(v) for v in conn.execute(
                "SELECT v.*, u.name FROM votes v JOIN users u ON u.id=v.user_id "
                "WHERE v.issue_id=?", (i["id"],))]
            for v in d["votes"]:
                if i["confidential"]:
                    v["name"] = "Anonymous"
            d["timeline"] = [dict(t) for t in conn.execute(
                "SELECT * FROM timeline WHERE issue_id=? ORDER BY id", (i["id"],))]
            out_issues.append(d)
        trust_log = [dict(r) for r in conn.execute(
            """SELECT t.*, u.name FROM trust_events t JOIN users u ON u.id=t.user_id
               ORDER BY t.id DESC LIMIT 200""")]
        conn.close()
        return {"users": users, "issues": out_issues, "trust_log": trust_log}

    def admin_summary(self):
        parts = urlparse(self.path)
        qs = dict(p.split("=", 1) for p in parts.query.split("&") if "=" in p)
        me = user_by_id(int(qs.get("as", 0))) if qs.get("as", "").isdigit() else None
        conn = get_db()
        s = admin_summary(conn) if me and me["role"] == "admin" else "admin only"
        conn.close()
        return s

    # ---------------- api actions
    def api_report(self, b):
        text = (b.get("text") or "").strip()
        me = user_by_id(b.get("user_id"))
        if not me or me["role"] != "student":
            return {"ok": False, "error": "Only students report issues"}
        if len(text) < 5:
            return {"ok": False, "error": "Please describe the problem"}
        conn = get_db()
        analysis = engine.analyze(text)
        # anti-spam: same student, same text twice -> treat as dup, refuse
        dup = conn.execute("SELECT 1 FROM reports WHERE user_id=? AND text=?",
                           (me["id"], text)).fetchone()
        if dup:
            conn.close()
            return {"ok": False, "error": "You already submitted this exact report"}
        issue_id, joined = create_or_join(conn, me, analysis, text)
        conn.commit()
        out = {"ok": True, "analysis": analysis, "issue_id": issue_id}
        if analysis["needs_clarification"]:
            out["message"] = ("We need a location before routing. " +
                              analysis.get("location_hint", ""))
        else:
            out["message"] = ("Joined existing issue as 'me too' (grouped by meaning)."
                              if joined else "Report logged.")
        conn.close()
        return out

    def api_clarify(self, b):
        me = user_by_id(b.get("user_id"))
        conn = get_db()
        r = finalize_clarification(conn, me, b.get("issue_id"), (b.get("location") or "").strip())
        conn.commit()
        conn.close()
        if r is None:
            return {"ok": False, "error": "Pick one of the listed campus locations"}
        return {"ok": True}

    def api_join(self, b):
        me = user_by_id(b.get("user_id"))
        conn = get_db()
        issue = conn.execute("SELECT * FROM issues WHERE id=?", (b.get("issue_id"),)).fetchone()
        if not issue or issue["confidential"]:
            conn.close()
            return {"ok": False, "error": "Joinable only for public issues"}
        if me["role"] != "student":
            conn.close()
            return {"ok": False, "error": "Students only"}
        dup = conn.execute("SELECT 1 FROM joins WHERE issue_id=? AND user_id=?",
                           (issue["id"], me["id"])).fetchone()
        dup2 = conn.execute("SELECT 1 FROM reports WHERE issue_id=? AND user_id=? AND spam=0",
                            (issue["id"], me["id"])).fetchone()
        if dup or dup2:
            conn.close()
            return {"ok": False, "error": "You are already part of this issue"}
        status_ok = issue["status"] in ("OPEN", "IN_PROGRESS", "RESOLVED")
        if not status_ok:
            conn.close()
            return {"ok": False, "error": "Joining closed for this status"}
        conn.execute("INSERT INTO joins(issue_id,user_id,created_at) VALUES(?,?,?)",
                     (issue["id"], me["id"], fmt(now())))
        impact = recompute_impact(conn, issue["id"])
        timeline_add(conn, issue["id"], f"'Me too' joined by {me['name']} "
                     f"(credibility weight {weight(me['trust']):.1f}) - impact now {impact:.1f}")
        maybe_bump_priority(conn, issue["id"])
        conn.commit()
        conn.close()
        return {"ok": True}

    def api_vote(self, b):
        me = user_by_id(b.get("user_id"))
        conn = get_db()
        err = vote_resolution(conn, me, b.get("issue_id"), b.get("verdict"))
        conn.commit()
        out = {"ok": err is None}
        if err:
            out["error"] = err
        conn.close()
        return out

    def api_status(self, b):
        me = user_by_id(b.get("user_id"))
        if not me or me["role"] not in ("staff", "admin"):
            return {"ok": False, "error": "Staff or admin only"}
        conn = get_db()
        issue = conn.execute("SELECT * FROM issues WHERE id=?",
                             (b.get("issue_id"),)).fetchone()
        if issue and issue["confidential"] and me["role"] != "admin":
            conn.close()
            return {"ok": False, "error": "Confidential reports are admin-only"}
        if issue and me["role"] == "staff" and issue["dept"] != me["dept"]:
            conn.close()
            return {"ok": False, "error": "You can only update your own department's queue"}
        err = set_status(conn, me, b.get("issue_id"), b.get("status"),
                         (b.get("note") or "").strip())
        conn.commit()
        conn.close()
        out = {"ok": err is None}
        if err:
            out["error"] = err
        return out

    def api_spam(self, b):
        me = user_by_id(b.get("user_id"))
        if not me or me["role"] != "admin":
            return {"ok": False, "error": "Admin only"}
        conn = get_db()
        err = flag_spam(conn, me, b.get("issue_id"))
        conn.commit()
        conn.close()
        out = {"ok": err is None}
        if err:
            out["error"] = err
        return out


def STATIC(name):
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), "static", name)


def user_by_id(uid):
    conn = get_db()
    row = conn.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
    conn.close()
    return dict(row) if row else None


def first_admin():
    conn = get_db()
    row = conn.execute("SELECT * FROM users WHERE role='admin' LIMIT 1").fetchone()
    conn.close()
    return dict(row)


def login(login_id):
    conn = get_db()
    row = conn.execute("SELECT * FROM users WHERE UPPER(login_id)=UPPER(?)",
                       ((login_id or "").strip(),)).fetchone()
    conn.close()
    return dict(row) if row else None


def new_student():
    conn = get_db()
    n = conn.execute("SELECT COUNT(*) c FROM users WHERE role='student'").fetchone()["c"] + 1
    c = conn.execute("INSERT INTO users(name, login_id, role, dept, trust, created_at, fresh) "
                     "VALUES(?,?,?,?,?,?,1)",
                     (f"New Student {n}", f"STU-{100 + n}", "student", None, 50, fmt(now())))
    conn.commit()
    uid = c.lastrowid
    conn.close()
    return user_by_id(uid)


def main():
    seed()
    port = int(os.environ.get("PORT", 8000))
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"ReportFix running on http://localhost:{port}  (Ctrl+C to stop)")
    server.serve_forever()


if __name__ == "__main__":
    main()
